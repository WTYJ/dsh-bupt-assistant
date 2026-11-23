const CHINA_TZ = 'Asia/Shanghai';

export function toBeijingDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = fmt.format(date).split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function formatIsoDate({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function diffDaysIso(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export const SYNC_START_MARKER = '<!-- AUTO:ASSISTANT-SYNC-START -->';
export const SYNC_END_MARKER = '<!-- AUTO:ASSISTANT-SYNC-END -->';

// Standard BUPT class section timetable (1-14)
export const BUPT_SLOT_TIMES = [
  ['08:00', '08:45'],
  ['08:50', '09:35'],
  ['09:50', '10:35'],
  ['10:40', '11:25'],
  ['11:30', '12:15'],
  ['13:00', '13:45'],
  ['13:50', '14:35'],
  ['14:45', '15:30'],
  ['15:40', '16:25'],
  ['16:35', '17:20'],
  ['17:25', '18:10'],
  ['18:30', '19:15'],
  ['19:20', '20:05'],
  ['20:10', '20:55'],
];

const WEEKDAY_CN = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const TODO_TYPE_LABEL = {
  1: '讨论',
  2: '问卷',
  3: '作业',
  4: '测验',
  5: '互评',
};

export function parseBeijingTimestamp(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '23', mi = '59', sec = '00'] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${sec.padStart(2, '0')}+08:00`;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}

export function formatCountdown(diffMs) {
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diffMs < 0) {
    const past = -diffMs;
    if (past < HOUR) return '已逾期不足1小时';
    if (past < DAY) return `已逾期 ${Math.floor(past / HOUR)} 小时`;
    return `已逾期 ${Math.floor(past / DAY)} 天`;
  }
  if (diffMs < HOUR) return `剩 ${Math.max(1, Math.ceil(diffMs / MIN))} 分钟`;
  if (diffMs < DAY) {
    const h = Math.floor(diffMs / HOUR);
    const m = Math.floor((diffMs % HOUR) / MIN);
    return `剩 ${h} 小时${m ? ` ${m} 分` : ''}`;
  }
  const d = Math.floor(diffMs / DAY);
  const h = Math.floor((diffMs % DAY) / HOUR);
  return `剩 ${d} 天${h ? ` ${h} 小时` : ''}`;
}

export function formatSlotRange(slots) {
  if (!Array.isArray(slots) || !slots.length) return '节次待定';
  const sorted = [...slots].map(Number).filter((n) => n >= 1 && n <= 14).sort((a, b) => a - b);
  if (!sorted.length) return '节次待定';
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const start = BUPT_SLOT_TIMES[first - 1]?.[0] || '';
  const end = BUPT_SLOT_TIMES[last - 1]?.[1] || '';
  const sec = first === last ? `第${first}节` : `第${first}-${last}节`;
  return start && end ? `${sec}（${start}-${end}）` : sec;
}

function isoWeekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function filterScheduleForDate(scheduleData, targetIso) {
  if (!scheduleData || !Array.isArray(scheduleData.items)) return { week: null, classes: [] };
  const termStart = scheduleData.term_start;
  let week = null;
  if (termStart) {
    const delta = diffDaysIso(termStart, targetIso);
    if (delta >= 0) week = Math.floor(delta / 7) + 1;
  }
  const wd = isoWeekday(targetIso);
  const classes = scheduleData.items
    .filter((item) => {
      if (Number(item.weekday) !== wd) return false;
      if (week !== null && Array.isArray(item.weeks) && item.weeks.length > 0) {
        return item.weeks.includes(week);
      }
      return scheduleData.date === targetIso;
    })
    .sort((a, b) => (a.slots?.[0] || 99) - (b.slots?.[0] || 99));
  return { week, classes };
}

export function parseExamDateIso(exam) {
  const raw = [exam?.time_text, exam?.date_text, exam?.start_text, exam?.end_text]
    .filter(Boolean)
    .join(' ');
  const m = raw.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function buildSyncBlock({
  nowMs,
  todayIso,
  syncedAtText,
  ucloudStatus,
  academicStatus,
  todos = [],
  upcomingAssignments = [],
  scheduleData = null,
  exams = [],
}) {
  const lines = [];
  lines.push(SYNC_START_MARKER);
  lines.push(`## 🔄 自动同步面板（更新于 ${syncedAtText}）`);
  lines.push('');

  // Status summary line if any source had an issue
  const statusNotes = [];
  if (ucloudStatus?.warning) statusNotes.push(`教学云：${ucloudStatus.warning}`);
  if (academicStatus?.warning) statusNotes.push(`教务系统：${academicStatus.warning}`);
  if (statusNotes.length) {
    lines.push(`> ⚠️ 同步状态提示：${statusNotes.join('；')}`);
    lines.push('');
  }

  // Normalize & sort UCloud todos
  const enrichedTodos = todos
    .map((t) => {
      const deadlineMs = parseBeijingTimestamp(t.deadline);
      return {
        ...t,
        deadlineMs,
        diffMs: deadlineMs !== null ? deadlineMs - nowMs : null,
        typeLabel: TODO_TYPE_LABEL[Number(t.type)] || '任务',
      };
    })
    .sort((a, b) => (a.deadlineMs ?? Infinity) - (b.deadlineMs ?? Infinity));

  // Normalize exams
  const enrichedExams = exams
    .map((e) => {
      const dateIso = parseExamDateIso(e);
      const daysUntil = dateIso ? diffDaysIso(todayIso, dateIso) : null;
      return { ...e, dateIso, daysUntil };
    })
    .filter((e) => e.daysUntil === null || e.daysUntil >= -1)
    .sort((a, b) => {
      if (a.daysUntil === null && b.daysUntil === null) return 0;
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    });

  // Compute today / tomorrow / day-after-tomorrow schedules
  const tomorrowIso = addDaysIso(todayIso, 1);
  const dayAfterIso = addDaysIso(todayIso, 2);
  const todaySched = filterScheduleForDate(scheduleData, todayIso);
  const tomorrowSched = filterScheduleForDate(scheduleData, tomorrowIso);
  const dayAfterSched = filterScheduleForDate(scheduleData, dayAfterIso);

  // 1. Alert Radar (high-priority items for Xiaoyu to notice at a glance)
  const alerts = [];
  for (const t of enrichedTodos) {
    if (t.diffMs !== null && t.diffMs <= 72 * 3600 * 1000) {
      const urgency = t.diffMs < 0 ? '🚨 已逾期' : t.diffMs <= 24 * 3600 * 1000 ? '🔥 24h内截止' : '⏰ 72h内截止';
      const courseTag = t.course_name ? `【${t.course_name}】` : '';
      alerts.push(`- ${urgency}：${courseTag}${t.name}（${t.deadline}，${formatCountdown(t.diffMs)}）`);
    }
  }
  if (tomorrowSched.classes.length > 0) {
    const first = tomorrowSched.classes[0];
    const firstSlot = first.slots?.[0] || 99;
    if (firstSlot <= 4) {
      const startTime = BUPT_SLOT_TIMES[firstSlot - 1]?.[0] || '';
      const morningTag = firstSlot <= 2 ? '🌅 明天有早八' : '🌤️ 明天上午有课';
      alerts.push(
        `- ${morningTag}：${first.name}（${formatSlotRange(first.slots)}，${first.room || '教室待定'}）${startTime ? `，记得提前定闹钟` : ''}`
      );
    }
  }
  for (const e of enrichedExams) {
    if (e.daysUntil !== null && e.daysUntil >= 0 && e.daysUntil <= 14) {
      const dayLabel = e.daysUntil === 0 ? '今天考试' : e.daysUntil === 1 ? '明天考试' : `还有 ${e.daysUntil} 天`;
      alerts.push(`- 🎓 临近考试：${e.name}（${e.time_text || e.dateIso}，${e.place || '地点待定'}，${dayLabel}）`);
    }
  }
  lines.push('### ⚡ 近期提醒雷达');
  if (alerts.length) {
    lines.push(...alerts);
  } else {
    lines.push('- 未来 72 小时内暂无紧急 DDL、上午课程或临近考试。');
  }
  lines.push('');

  // 2. UCloud Todos & Upcoming Assignments
  lines.push('### 📝 教学云作业与 DDL');
  if (!enrichedTodos.length) {
    lines.push(
      ucloudStatus?.configured === false
        ? '- 尚未登录教学云（可在 DSH「设置 → 北邮个人助理」中配置教学云账号并存入系统钥匙串）。'
        : '- 当前待办列表为空，没有未完成作业。'
    );
  } else {
    for (const t of enrichedTodos) {
      const courseTag = t.course_name ? `【${t.course_name}】` : '【课程未关联】';
      const cd = t.diffMs !== null ? `，${formatCountdown(t.diffMs)}` : '';
      lines.push(`- [${t.typeLabel}] ${courseTag}${t.name} — 截止：${t.deadline || '未知'}${cd}`);
    }
  }
  if (upcomingAssignments.length) {
    lines.push('');
    lines.push('#### 🔜 即将开始（通知中提前发现）');
    for (const u of upcomingAssignments) {
      lines.push(`- ${u.title || u.notification_title} — 开始：${u.begin_time || '未知'}，截止：${u.deadline || '未知'}`);
    }
  }
  lines.push('');

  // 3. Recent Class Schedule
  lines.push('### 📅 近期课表（今/明/后天）');
  if (!scheduleData) {
    lines.push(
      academicStatus?.configured === false
        ? '- 尚未登录移动教务（可在 DSH「设置 → 北邮个人助理」中配置移动教务账号并存入系统钥匙串）。'
        : '- 暂无课表数据。'
    );
  } else {
    const days = [
      { label: `今天（${todayIso} ${WEEKDAY_CN[isoWeekday(todayIso)]}）`, info: todaySched },
      { label: `明天（${tomorrowIso} ${WEEKDAY_CN[isoWeekday(tomorrowIso)]}）`, info: tomorrowSched },
      { label: `后天（${dayAfterIso} ${WEEKDAY_CN[isoWeekday(dayAfterIso)]}）`, info: dayAfterSched },
    ];
    for (const { label, info } of days) {
      const wk = info.week ? ` · 第${info.week}周` : '';
      if (!info.classes.length) {
        lines.push(`- **${label}${wk}**：没课`);
      } else {
        lines.push(`- **${label}${wk}**：`);
        for (const c of info.classes) {
          const room = c.room ? ` @ ${c.room}` : '';
          const teacher = c.teacher ? `（${c.teacher}）` : '';
          lines.push(`  - ${formatSlotRange(c.slots)}：${c.name}${room}${teacher}`);
        }
      }
    }
  }
  lines.push('');

  // 4. Exams
  lines.push('### 🎓 考试安排');
  if (!enrichedExams.length) {
    lines.push(
      academicStatus?.configured === false
        ? '- 尚未登录移动教务。'
        : '- 教务系统当前暂无未结束的考试安排。'
    );
  } else {
    for (const e of enrichedExams) {
      const cd =
        e.daysUntil === null
          ? '日期待定'
          : e.daysUntil === 0
            ? '今天'
            : e.daysUntil < 0
              ? '已结束'
              : `还有 ${e.daysUntil} 天`;
      lines.push(`- ${e.name} — ${e.time_text || e.dateIso || '时间待定'} @ ${e.place || '地点待定'}（${cd}）`);
    }
  }
  lines.push(SYNC_END_MARKER);
  return lines.join('\n');
}

export function mergeSyncBlockIntoMarkdown(existingMarkdown, newBlock) {
  const src = String(existingMarkdown || '');
  const startIdx = src.indexOf(SYNC_START_MARKER);
  const endIdx = src.indexOf(SYNC_END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = src.slice(0, startIdx).trimEnd();
    const after = src.slice(endIdx + SYNC_END_MARKER.length).trimStart();
    return [before, '', newBlock, after ? `\n${after}` : ''].join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  const trimmed = src.trimEnd();
  if (!trimmed) return `${newBlock}\n`;
  return `${trimmed}\n\n---\n\n${newBlock}\n`;
}
