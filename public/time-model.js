export function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function timestampValid(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

// Half-open intervals: touching endpoints do not overlap. Split on local clock hours.
export function splitSpan(start, end) {
  const parts = [];
  let cursor = Date.parse(start);
  const finish = Date.parse(end);
  while (cursor < finish) {
    const date = new Date(cursor), boundary = new Date(cursor);
    boundary.setMinutes(60, 0, 0);
    const next = Math.min(boundary.getTime(), finish);
    parts.push({ date: dayKey(date), hour: date.getHours(), seconds: (next - cursor) / 1000,
      start: new Date(cursor).toISOString(), end: new Date(next).toISOString() });
    cursor = next;
  }
  return parts;
}

export function runningSessions(task, now = new Date()) {
  const sessions = [...(task.sessions || [])];
  if (task.activeTimer && Date.parse(task.activeTimer) < new Date(now).getTime()) {
    sessions.push({ id: `timer-${task.activeTimer}`, start: task.activeTimer,
      end: new Date(now).toISOString(), source: 'timer', running: true });
  }
  return sessions;
}

export function aggregateEntries(untimed, sessions) {
  const byDay = new Map();
  for (const entry of untimed) byDay.set(entry.date, { ...entry });
  for (const session of sessions) {
    for (const part of splitSpan(session.start, session.end)) {
      const entry = byDay.get(part.date) || { date: part.date, seconds: 0 };
      entry.seconds += part.seconds;
      byDay.set(part.date, entry);
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function validateSessions(task) {
  if (!Array.isArray(task.sessions) || !Array.isArray(task.untimedEntries)) throw Error('时间段记录无效');
  const ids = new Set();
  const dates = new Set();
  for (const entry of task.untimedEntries) {
    if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        || !Number.isFinite(entry.seconds) || entry.seconds < 0 || dates.has(entry.date)) throw Error('未定位用时无效');
    dates.add(entry.date);
  }
  for (const s of task.sessions) {
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || !timestampValid(s.start)
        || !timestampValid(s.end) || Date.parse(s.start) >= Date.parse(s.end)
        || !['manual', 'timer'].includes(s.source) || dayKey(s.start) < task.started
        || (task.done && dayKey(Date.parse(s.end) - 1) > task.done)) throw Error('时间段的起止时间或归属日期无效');
    ids.add(s.id);
  }
}

export function validateTimeState(tasks, now = new Date()) {
  const intervals = [], ids = new Set();
  for (const task of tasks) {
    if (ids.has(task.id)) throw Error('事项 ID 重复');
    ids.add(task.id);
    for (const s of runningSessions(task, now)) {
      if (Date.parse(s.end) > new Date(now).getTime()) throw Error('不能记录尚未发生的时间段');
      intervals.push({ ...s, title: task.title });
    }
  }
  intervals.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (let i = 1; i < intervals.length; i++) {
    if (Date.parse(intervals[i].start) < Date.parse(intervals[i - 1].end)) {
      throw Error(`时间段重叠：${intervals[i - 1].title} 与 ${intervals[i].title}，请调整起止时间`);
    }
  }
}

export function editSession(task, fields, id, now = new Date()) {
  if (task.activeTimer) throw Error('请先暂停本事项计时，再编辑时间段');
  const start = new Date(fields.start), end = new Date(fields.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw Error('结束时间必须晚于开始时间');
  }
  if (end > new Date(now)) throw Error('不能记录尚未发生的时间段');
  const next = structuredClone(task);
  const session = { id, start: start.toISOString(), end: end.toISOString(), source: 'manual' };
  const index = next.sessions.findIndex(s => s.id === id);
  if (index < 0) next.sessions.push(session); else next.sessions[index] = session;
  next.sessions.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return next;
}
