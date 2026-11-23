import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { resolveEffectivePaths } from './config.mjs';
import {
  buildSyncBlock,
  formatIsoDate,
  mergeSyncBlockIntoMarkdown,
  toBeijingDateParts,
} from './formatter.mjs';
import { getCredentialStatus, runBuptAgentCli } from './keychain-bridge.mjs';

function formatBeijingNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(date).replace(/\//g, '-');
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeAtomic(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpPath, content, 'utf8');
  renameSync(tmpPath, filePath);
}

async function callTool(paths, toolName, params = {}, cliRunner = runBuptAgentCli) {
  return cliRunner(paths, 'call', [toolName, '--args', JSON.stringify(params)], 60000);
}

async function resolveMissingCourseNames(paths, todos, courseMap, cliRunner) {
  const unresolvedIds = todos
    .filter((t) => !t.course_name && t.id && !courseMap[String(t.id)])
    .map((t) => String(t.id));

  if (unresolvedIds.length > 0) {
    const coursesRes = await callTool(paths, 'ucloud.courses', { page: 1, page_size: 100 }, cliRunner);
    if (coursesRes.ok && Array.isArray(coursesRes.data?.items)) {
      const pending = new Set(unresolvedIds);
      for (const course of coursesRes.data.items) {
        if (pending.size === 0) break;
        const cid = String(course.id || '');
        const cname = String(course.name || '').trim();
        if (!cid || !cname) continue;
        const worksRes = await callTool(
          paths,
          'ucloud.assignments',
          { course_id: cid, page: 1, page_size: 100 },
          cliRunner,
        );
        if (worksRes.ok && Array.isArray(worksRes.data?.items)) {
          for (const w of worksRes.data.items) {
            const wid = String(w.id || '');
            if (wid && pending.has(wid)) {
              courseMap[wid] = cname;
              pending.delete(wid);
            }
          }
        }
      }
    }
  }

  return todos.map((t) => {
    if (t.course_name) return t;
    const mapped = t.id ? courseMap[String(t.id)] : null;
    return mapped ? { ...t, course_name: mapped } : t;
  });
}

async function fetchUcloudBundle(paths, cfg, prevState, cliRunner) {
  const todosRes = await callTool(paths, 'ucloud.todos', {}, cliRunner);
  if (!todosRes.ok) {
    const code = todosRes.error?.code || 'UNKNOWN';
    if (code === 'NOT_CONFIGURED') {
      return { ok: false, configured: false, warning: '', todos: [], upcomingAssignments: [] };
    }
    return {
      ok: false,
      configured: true,
      warning: `本次刷新失败（${code}：${todosRes.error?.message || '未知错误'}）${
        prevState.ucloud?.syncedAt ? `，已保留 ${prevState.ucloud.syncedAt} 的缓存` : ''
      }`,
      todos: prevState.ucloud?.todos || [],
      upcomingAssignments: prevState.ucloud?.upcomingAssignments || [],
    };
  }

  const courseMap = { ...(prevState.activityCourseMap || {}) };
  const rawTodos = Array.isArray(todosRes.data?.items) ? todosRes.data.items : [];
  const enrichedTodos = await resolveMissingCourseNames(paths, rawTodos, courseMap, cliRunner);

  let upcomingAssignments = [];
  if (cfg.ucloudSync?.includeUpcoming !== false) {
    upcomingAssignments = prevState.ucloud?.upcomingAssignments || [];
    const upcomingRes = await callTool(
      paths,
      'ucloud.upcoming_assignments',
      { page: 1, page_size: 50, max_pages: 3 },
      cliRunner,
    );
    if (upcomingRes.ok && Array.isArray(upcomingRes.data?.items)) {
      upcomingAssignments = upcomingRes.data.items;
    }
  }

  return {
    ok: true,
    configured: true,
    warning: '',
    todos: enrichedTodos,
    upcomingAssignments,
    courseMap,
  };
}

async function fetchAcademicBundle(paths, prevState, cliRunner) {
  const schedRes = await callTool(paths, 'academic.schedule', {}, cliRunner);
  const examsRes = await callTool(paths, 'academic.exams', {}, cliRunner);

  if (!schedRes.ok && !examsRes.ok) {
    const code = schedRes.error?.code || examsRes.error?.code || 'UNKNOWN';
    if (code === 'NOT_CONFIGURED') {
      return { ok: false, configured: false, warning: '', scheduleData: null, exams: [] };
    }
    return {
      ok: false,
      configured: true,
      warning: `本次刷新失败（${code}：${schedRes.error?.message || examsRes.error?.message || '未知错误'}）${
        prevState.academic?.syncedAt ? `，已保留 ${prevState.academic.syncedAt} 的缓存` : ''
      }`,
      scheduleData: prevState.academic?.scheduleData || null,
      exams: prevState.academic?.exams || [],
    };
  }

  const warnings = [];
  let scheduleData = prevState.academic?.scheduleData || null;
  if (schedRes.ok && schedRes.data) {
    scheduleData = schedRes.data;
  } else if (!schedRes.ok) {
    warnings.push(`课表刷新失败（${schedRes.error?.code || 'ERROR'}）`);
  }

  let exams = prevState.academic?.exams || [];
  if (examsRes.ok && Array.isArray(examsRes.data?.items)) {
    exams = examsRes.data.items;
  } else if (!examsRes.ok) {
    warnings.push(`考试刷新失败（${examsRes.error?.code || 'ERROR'}）`);
  }

  return {
    ok: true,
    configured: true,
    warning: warnings.join('，'),
    scheduleData,
    exams,
  };
}

export function extractRadarPreview(scheduleFile) {
  try {
    if (!scheduleFile || !existsSync(scheduleFile)) {
      return { syncedAt: null, radarLines: [], hasFile: false };
    }
    const content = readFileSync(scheduleFile, 'utf8');
    const syncMatch = content.match(/自动同步面板（更新于\s*([^）]+)）/);
    const syncedAt = syncMatch ? syncMatch[1].trim() : null;
    const radarMatch = content.match(/### ⚡ 近期提醒雷达\s*\n([\s\S]*?)(?:\n### |\n<!-- AUTO:ASSISTANT-SYNC-END -->|$)/);
    const radarLines = radarMatch
      ? radarMatch[1]
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.startsWith('- '))
      : [];
    return { syncedAt, radarLines, hasFile: true };
  } catch {
    return { syncedAt: null, radarLines: [], hasFile: false };
  }
}

export function createSyncEngine({
  getConfig,
  cliRunner = runBuptAgentCli,
  credStatusFn = getCredentialStatus,
  nowFn = () => new Date(),
  logger = console,
} = {}) {
  let inFlight = null;
  let lastSummary = null;
  let timer = null;
  let activeIntervalMs = null;

  async function executeSync({ reason = 'manual' } = {}) {
    const cfg = getConfig();
    const paths = resolveEffectivePaths(cfg);
    const now = nowFn();
    const nowMs = now.getTime();
    const todayIso = formatIsoDate(toBeijingDateParts(now));
    const syncedAtText = formatBeijingNow(now);

    const prevState = readJsonSafe(paths.stateFile, {
      activityCourseMap: {},
      ucloud: null,
      academic: null,
    });

    // 1. Check credential status so unconfigured services skip cleanly
    const credStatus = await credStatusFn(paths);

    // 2. UCloud sync
    let ucloudBundle;
    if (!cfg.ucloudSync?.enabled) {
      ucloudBundle = {
        ok: false,
        configured: Boolean(credStatus.ucloud?.configured),
        warning: '教学云同步开关已关闭',
        todos: prevState.ucloud?.todos || [],
        upcomingAssignments: prevState.ucloud?.upcomingAssignments || [],
      };
    } else if (!credStatus.ucloud?.configured) {
      ucloudBundle = { ok: false, configured: false, warning: '', todos: [], upcomingAssignments: [] };
    } else {
      ucloudBundle = await fetchUcloudBundle(paths, cfg, prevState, cliRunner);
    }

    // 4. Academic sync
    let academicBundle;
    if (!cfg.academicSync?.enabled) {
      academicBundle = {
        ok: false,
        configured: Boolean(credStatus.academic?.configured),
        warning: '教务同步开关已关闭',
        scheduleData: prevState.academic?.scheduleData || null,
        exams: prevState.academic?.exams || [],
      };
    } else if (!credStatus.academic?.configured) {
      academicBundle = { ok: false, configured: false, warning: '', scheduleData: null, exams: [] };
    } else {
      academicBundle = await fetchAcademicBundle(paths, prevState, cliRunner);
    }

    // 5. Render & atomically merge into 待办与日程.md
    const syncBlock = buildSyncBlock({
      nowMs,
      todayIso,
      syncedAtText,
      ucloudStatus: ucloudBundle,
      academicStatus: academicBundle,
      todos: ucloudBundle.todos,
      upcomingAssignments: ucloudBundle.upcomingAssignments,
      scheduleData: academicBundle.scheduleData,
      exams: academicBundle.exams,
    });

    const existingScheduleMd = existsSync(paths.scheduleFile)
      ? readFileSync(paths.scheduleFile, 'utf8')
      : '# 待办与日程\n\n## ✍️ 个人手记待办与日程\n\n- （平时随手记在这里，自动同步不会覆盖这一区）\n';

    const mergedMarkdown = mergeSyncBlockIntoMarkdown(existingScheduleMd, syncBlock);
    writeAtomic(paths.scheduleFile, mergedMarkdown);

    const nextState = {
      lastRunAt: syncedAtText,
      activityCourseMap: ucloudBundle.courseMap || prevState.activityCourseMap || {},
      ucloud: ucloudBundle.ok
        ? {
            syncedAt: syncedAtText,
            todos: ucloudBundle.todos,
            upcomingAssignments: ucloudBundle.upcomingAssignments,
          }
        : prevState.ucloud,
      academic: academicBundle.ok
        ? {
            syncedAt: syncedAtText,
            scheduleData: academicBundle.scheduleData,
            exams: academicBundle.exams,
          }
        : prevState.academic,
    };
    writeAtomic(paths.stateFile, `${JSON.stringify(nextState, null, 2)}\n`);

    const radar = extractRadarPreview(paths.scheduleFile);
    lastSummary = {
      ok: true,
      reason,
      syncedAt: syncedAtText,
      ucloud: {
        configured: ucloudBundle.configured,
        refreshed: ucloudBundle.ok,
        todoCount: ucloudBundle.todos.length,
        upcomingCount: ucloudBundle.upcomingAssignments.length,
        warning: ucloudBundle.warning || null,
      },
      academic: {
        configured: academicBundle.configured,
        refreshed: academicBundle.ok,
        hasSchedule: Boolean(academicBundle.scheduleData),
        examCount: academicBundle.exams.length,
        warning: academicBundle.warning || null,
      },
      radarLines: radar.radarLines,
      scheduleFile: paths.scheduleFile,
    };
    return lastSummary;
  }

  function syncNow(opts = {}) {
    if (inFlight) return inFlight;
    inFlight = executeSync(opts)
      .catch((err) => {
        logger?.warn?.(`[dsh-bupt-assistant] sync failed: ${err?.message || err}`);
        return {
          ok: false,
          error: err?.message || '同步执行异常',
        };
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  function applySchedule(cfg) {
    const shouldRun = Boolean(cfg?.enabled && cfg?.autoSync?.enabled);
    const intervalMs = Math.max(10, Number(cfg?.autoSync?.intervalMinutes || 120)) * 60 * 1000;

    if (!shouldRun) {
      if (timer) {
        clearInterval(timer);
        timer = null;
        activeIntervalMs = null;
      }
      return;
    }

    if (timer && activeIntervalMs === intervalMs) return;
    if (timer) clearInterval(timer);
    activeIntervalMs = intervalMs;
    timer = setInterval(() => {
      syncNow({ reason: 'timer' });
    }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      activeIntervalMs = null;
    }
  }

  function getStatus() {
    const cfg = getConfig();
    const paths = resolveEffectivePaths(cfg);
    const radar = extractRadarPreview(paths.scheduleFile);
    return {
      syncing: Boolean(inFlight),
      schedulerActive: Boolean(timer),
      intervalMinutes: cfg.autoSync?.intervalMinutes ?? 120,
      lastSummary,
      radar,
      effectivePaths: {
        exportDir: paths.exportDir,
        scheduleFile: paths.scheduleFile,
        buptAgentDir: paths.buptAgentDir,
      },
    };
  }

  return {
    syncNow,
    applySchedule,
    stop,
    getStatus,
  };
}
