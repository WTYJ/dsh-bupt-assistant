import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { normalizeConfig, resolveLiveConfig, saveLiveConfig } from '../config.mjs';
import { API_ROUTE, createBuptAssistantPlugin } from '../index.mjs';

function createTempEnv() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-bupt-assistant-test-'));
  const ws = join(root, 'export-dir');
  const data = join(root, 'data');
  const configFile = join(data, 'settings.json');
  return { root, ws, data, configFile, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function makeHttpMocks({ method = 'GET', body = null, remoteAddress = '127.0.0.1' } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.socket = { remoteAddress };

  const headers = {};
  let resolveEnd;
  const done = new Promise((r) => {
    resolveEnd = r;
  });
  const res = {
    statusCode: 200,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    end(payload) {
      this.body = payload;
      this.json = payload ? JSON.parse(payload) : null;
      this.headers = headers;
      resolveEnd(this);
    },
  };

  setImmediate(() => {
    if (body !== null) {
      req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    }
    req.emit('end');
  });

  return { req, res, done };
}

test('config hot-save persists independent switches and clamps bounds', () => {
  const env = createTempEnv();
  try {
    const base = normalizeConfig({ configFile: env.configFile });
    const saved = saveLiveConfig(base, {
      autoSync: { enabled: false, intervalMinutes: 5 }, // clamps to 10
      ucloudSync: { enabled: false },
      contextInject: { enabled: false },
      exportMarkdown: { dir: env.ws },
    });
    assert.equal(saved.autoSync.enabled, false);
    assert.equal(saved.autoSync.intervalMinutes, 10);
    assert.equal(saved.ucloudSync.enabled, false);
    assert.equal(saved.academicSync.enabled, true);

    const reloaded = resolveLiveConfig(base);
    assert.equal(reloaded.autoSync.intervalMinutes, 10);
    assert.equal(reloaded.contextInject.enabled, false);
    assert.equal(reloaded.exportMarkdown.dir, env.ws);
  } finally {
    env.cleanup();
  }
});

test('plugin HTTP API enforces loopback, saves credentials without echoing, and runs pure BUPT sync', async () => {
  const env = createTempEnv();
  try {
    mkdirSync(env.ws, { recursive: true });
    writeFileSync(
      join(env.ws, '待办与日程.md'),
      `# 待办与日程\n\n## ✍️ 个人手记待办与日程\n\n- 记得取快递\n`,
      'utf8',
    );

    const savedCreds = [];
    const routes = new Map();
    const registeredTools = new Map();
    const promptHooks = [];
    const cleanups = [];

    const mockCtx = {
      effect(fn) {
        const d = fn();
        if (typeof d === 'function') cleanups.push(d);
      },
      webServer: {
        register(route) {
          routes.set(route.path, route.handler);
          return () => routes.delete(route.path);
        },
      },
      tools: {
        register(t) {
          registeredTools.set(t.name, t);
        },
      },
      systemPrompt: {
        context(entry) {
          promptHooks.push(entry);
        },
      },
    };

    const plugin = createBuptAssistantPlugin({
      nowFn: () => new Date('2026-11-23T16:00:00+08:00'),
      getCredentialStatus: async () => ({
        ok: true,
        ucloud: { configured: true },
        academic: { configured: true },
      }),
      saveCredentialToKeychain: async (_paths, payload) => {
        savedCreds.push(payload);
        return { ok: true, saved: true, service: payload.service };
      },
      cliRunner: async (_paths, _sub, args) => {
        const tool = args[0];
        if (tool === 'ucloud.todos') {
          return {
            ok: true,
            data: {
              items: [
                {
                  id: '9001',
                  name: '光学实验报告',
                  type: 3,
                  deadline: '2026-11-24 23:59',
                  course_name: null,
                },
              ],
            },
          };
        }
        if (tool === 'ucloud.courses') {
          return { ok: true, data: { items: [{ id: 'c1', name: '光电检测技术' }] } };
        }
        if (tool === 'ucloud.assignments') {
          return { ok: true, data: { items: [{ id: '9001', title: '光学实验报告' }] } };
        }
        if (tool === 'ucloud.upcoming_assignments') {
          return { ok: true, data: { items: [] } };
        }
        if (tool === 'academic.schedule') {
          return {
            ok: true,
            data: {
              term_start: '2026-09-07',
              items: [
                {
                  name: '光电检测技术',
                  teacher: '张老师',
                  room: '教三-305',
                  weekday: 2,
                  slots: [1, 2],
                  weeks: [12],
                },
              ],
            },
          };
        }
        if (tool === 'academic.exams') {
          return {
            ok: true,
            data: {
              items: [{ name: '激光原理', time_text: '2026-12-01 09:00-11:00', place: '教三-401' }],
            },
          };
        }
        return { ok: false, error: { code: 'UNKNOWN', message: 'unknown' } };
      },
    });

    plugin.apply(mockCtx, {
      configFile: env.configFile,
      autoSync: { enabled: false, syncOnStartup: false },
      exportMarkdown: { dir: env.ws },
      paths: { buptAgentDir: env.root },
    });

    const handler = routes.get(API_ROUTE);
    assert.ok(handler, 'API route should be registered');

    const remoteCall = makeHttpMocks({ method: 'GET', remoteAddress: '192.168.1.99' });
    handler(remoteCall.req, remoteCall.res);
    await remoteCall.done;
    assert.equal(remoteCall.res.statusCode, 403);

    const getCall = makeHttpMocks({ method: 'GET' });
    handler(getCall.req, getCall.res);
    await getCall.done;
    assert.equal(getCall.res.statusCode, 200);
    assert.equal(getCall.res.json.meta.name, 'dsh-bupt-assistant');
    assert.equal(getCall.res.json.meta.version, '1.0.0');

    const saveCredCall = makeHttpMocks({
      method: 'POST',
      body: { action: 'saveCredential', service: 'ucloud', username: '2024000001', password: 'secret-value' },
    });
    handler(saveCredCall.req, saveCredCall.res);
    await saveCredCall.done;
    assert.equal(saveCredCall.res.statusCode, 200);
    assert.equal(savedCreds.length, 1);
    assert.doesNotMatch(saveCredCall.res.body, /secret-value/);
    assert.doesNotMatch(saveCredCall.res.body, /2024000001/);

    const syncCall = makeHttpMocks({ method: 'POST', body: { action: 'syncNow' } });
    handler(syncCall.req, syncCall.res);
    await syncCall.done;
    assert.equal(syncCall.res.statusCode, 200);
    assert.equal(syncCall.res.json.ok, true);
    assert.equal(syncCall.res.json.summary.ucloud.todoCount, 1);
    assert.equal(syncCall.res.json.summary.academic.examCount, 1);

    const scheduleMd = readFileSync(join(env.ws, '待办与日程.md'), 'utf8');
    assert.match(scheduleMd, /- 记得取快递/);
    assert.match(scheduleMd, /【光电检测技术】光学实验报告/);
    assert.match(scheduleMd, /明天有早八.*光电检测技术/);
    assert.match(scheduleMd, /临近考试.*激光原理/);
    assert.doesNotMatch(scheduleMd, /重要日子/);

    assert.equal(promptHooks.length, 1);
    const promptInWs = promptHooks[0].text({ agent: { workspace: env.ws } });
    assert.match(promptInWs, /光学实验报告/);
    assert.match(promptInWs, /bupt_refresh_schedule/);
    const promptOtherWs = promptHooks[0].text({ agent: { workspace: '/tmp/other-workspace' } });
    assert.equal(promptOtherWs, '');

    const refreshTool = registeredTools.get('bupt_refresh_schedule');
    assert.ok(refreshTool);
    const toolOut = await refreshTool.execute();
    assert.equal(toolOut.ok, true);
    assert.equal(toolOut.todoCount, 1);

    for (const c of cleanups) c();
  } finally {
    env.cleanup();
  }
});
