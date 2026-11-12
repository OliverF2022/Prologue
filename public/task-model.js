import { aggregateEntries, runningSessions, validateSessions } from './time-model.js';
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function localDay(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const secondsTotal = entries => entries.reduce((sum, entry) => sum + entry.seconds, 0);

export function normalizeTask(task) {
  const minutes = Number(task.minutes ?? 0);
  const started = task.started || (task.done && task.done < task.date ? task.done : task.date);
  const untimedEntries = task.untimedEntries ?? (Array.isArray(task.timeEntries) ? task.timeEntries :
    (minutes > 0 ? [{ date: task.done || started, seconds: Math.round(minutes * 60), legacy: true }] : []));
  const sessions = task.sessions || [];
  const timeEntries = aggregateEntries(untimedEntries, sessions);
  return {
    ...task,
    subtype: task.subtype || '',
    started,
    done: task.done || null,
    minutes: Math.floor(secondsTotal(timeEntries) / 60),
    progress: task.done ? 100 : Math.max(0, Math.min(99, Number(task.progress) || 0)),
    milestone: Boolean(task.milestone),
    milestoneNote: task.milestoneNote || '',
    timeEntries,
    untimedEntries,
    sessions,
    activeTimer: task.activeTimer || null,
    status: task.done ? 'completed' : (task.status === 'interrupted' ? 'interrupted' : 'active'),
    interruptions: task.interruptions || [],
  };
}

export function durationMinutes(hours, minutes) {
  const h = Number(hours), m = Number(minutes);
  if (!Number.isInteger(h) || h < 0 || h > 10000 || !Number.isInteger(m) || m < 0 || m > 59) {
    throw Error('耗时请填写 0–10000 小时和 0–59 分钟的整数');
  }
  return h * 60 + m;
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${rest} 分钟`;
}

export function formatElapsed(seconds) {
  const whole = Math.floor(seconds);
  return `${formatDuration(Math.floor(whole / 60))}${whole % 60 ? ` ${whole % 60} 秒` : ''}`;
}

export function validateTask(task) {
  if (typeof task.id !== 'string' || !task.id || typeof task.title !== 'string' || !task.title.trim()
      || task.title.length > 200 || !['task', 'habit'].includes(task.kind)) throw Error('事项名称或类型无效');
  if (typeof task.category !== 'string' || !task.category.trim()) throw Error('请选择主类型');
  if (typeof task.subtype !== 'string' || task.subtype.length > 80) throw Error('子类型不能超过 80 字');
  if (!isDate(task.date) || (task.started && !isDate(task.started)) || (task.done && !isDate(task.done))) {
    throw Error('请填写有效日期');
  }
  if (!isDate(task.started)) throw Error('事项开始日期无效');
  if (task.done && task.started > task.done) throw Error('完成日期不能早于执行开始日期');
  if (!Number.isInteger(task.minutes) || task.minutes < 0) throw Error('实际耗时无效');
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) throw Error('进度须为 0–100 的整数');
  if (task.done && task.progress !== 100) throw Error('已完成事项进度应为 100%');
  if (!task.done && task.progress === 100) throw Error('进度为 100% 的事项应为已完成');
  if (typeof task.milestone !== 'boolean' || typeof task.milestoneNote !== 'string'
      || task.milestoneNote.length > 1000) throw Error('里程碑备注不能超过 1000 字');
  if (!['active', 'interrupted', 'completed'].includes(task.status)
      || Boolean(task.done) !== (task.status === 'completed')) throw Error('事项状态无效');
  validateSessions(task);
  if (!Array.isArray(task.timeEntries)) throw Error('每日用时记录无效');
  const dates = new Set();
  for (const entry of task.timeEntries) {
    if (!isDate(entry.date) || entry.date < task.started || (task.done && entry.date > task.done)
        || dates.has(entry.date) || !Number.isFinite(entry.seconds) || entry.seconds < 0) throw Error('每日用时日期或时长无效');
    dates.add(entry.date);
  }
  if (task.minutes !== Math.floor(secondsTotal(task.timeEntries) / 60)) throw Error('累计用时与每日记录不一致');
  if (!Array.isArray(task.interruptions)) throw Error('中断记录无效');
  for (const record of task.interruptions) {
    if (typeof record.reason !== 'string' || !record.reason.trim() || record.reason.length > 1000
        || !Number.isFinite(Date.parse(record.at)) || (record.resumedAt
          && (!Number.isFinite(Date.parse(record.resumedAt)) || record.resumedAt < record.at))) throw Error('中断记录或理由无效');
  }
  const open = task.interruptions.filter(i => !i.resumedAt);
  if (open.length !== (task.status === 'interrupted' ? 1 : 0)
      || (open.length && task.interruptions.at(-1) !== open[0])) throw Error('中断状态与记录不一致');
  if (task.activeTimer && (task.status !== 'active' || !Number.isFinite(Date.parse(task.activeTimer))
      || localDay(task.activeTimer) < task.started)) throw Error('当前事项不能计时');
  return task;
}

// Dates and cumulative duration belong to the lifecycle, not editable task fields.
export function taskFromFields(fields, previous, today, now = new Date()) {
  const creating = !previous.title;
  const base = creating ? normalizeTask({ id: previous.id, date: today, started: today, minutes: 0 }) : previous;
  const task = {
    ...base,
    title: (fields.title ?? base.title ?? '').trim(),
    category: fields.category ?? base.category,
    kind: fields.kind ?? base.kind,
    subtype: (fields.subtype ?? base.subtype ?? '').trim(),
    progress: creating ? 0 : Number(fields.progress ?? base.progress),
    milestone: fields.milestone === undefined ? base.milestone : fields.milestone === 'on',
    milestoneNote: (fields.milestoneNote ?? base.milestoneNote ?? '').trim(),
  };
  if (task.kind === 'habit') task.progress = task.done ? 100 : 0;
  if (task.progress === 100 && !task.done) return completeTask(task, today, now, base.progress);
  if (task.done && task.progress < 100) return validateTask({ ...reopenTask(task), progress: task.progress });
  return validateTask(task);
}

export function reopenTask(task) {
  return { ...task, done: null, status: 'active', activeTimer: null,
    progress: task.kind === 'habit' ? 0 : Math.min(99, task.previousProgress || 0) };
}

export function updateTotal(task) {
  task.timeEntries = aggregateEntries(task.untimedEntries, task.sessions);
  task.minutes = Math.floor(secondsTotal(task.timeEntries) / 60);
  return task;
}

// Split elapsed wall time at local midnight, so reports include unfinished work.
export function stopTimer(task, now = new Date()) {
  const next = structuredClone(task);
  if (!next.activeTimer) return next;
  const session = runningSessions(next, now).find(s=>s.running);
  if (session) { const { running, ...record } = session; next.sessions.push(record); }
  next.activeTimer = null;
  next.timeEntries.sort((a, b) => a.date.localeCompare(b.date));
  return updateTotal(next);
}

export function startTimer(task, now = new Date()) {
  if (task.status !== 'active') throw Error('请先恢复事项，再开始计时');
  if (task.activeTimer) return task;
  return validateTask({ ...task, activeTimer: new Date(now).toISOString() });
}

export function totalSeconds(task, now = new Date()) {
  return secondsTotal(stopTimer(task, now).timeEntries);
}

export function completeTask(task, today, now = new Date(), previousProgress = task.progress) {
  if (task.status === 'interrupted') throw Error('请先恢复中断事项，再标记完成');
  if (task.done) return task;
  return validateTask({ ...stopTimer(task, now), done: today, status: 'completed', progress: 100,
    previousProgress: Math.min(99, previousProgress) });
}

export function interruptTask(task, reason, now = new Date()) {
  if (task.status !== 'active') throw Error('只有进行中的事项可以中断');
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) throw Error('请填写中断理由（1–1000 字）');
  const next = stopTimer(task, now);
  next.status = 'interrupted';
  next.interruptions.push({ at: new Date(now).toISOString(), reason: reason.trim(), resumedAt: null });
  return validateTask(next);
}

export function resumeTask(task, now = new Date()) {
  if (task.status !== 'interrupted') throw Error('事项未处于中断状态');
  const next = structuredClone(task);
  next.status = 'active';
  next.interruptions.at(-1).resumedAt = new Date(now).toISOString();
  return validateTask(next);
}

export function setDailyTime(task, date, hours, minutes, today) {
  if (task.activeTimer) throw Error('请先暂停计时，再补记或修正用时');
  if (!isDate(date) || date < task.started || date > (task.done || today) || date > today) {
    throw Error('用时日期须在事项开始至结束之间，且不能晚于今天');
  }
  const seconds = durationMinutes(hours, minutes) * 60;
  if (seconds > 86400) throw Error('每日用时不能超过 24 小时');
  const next = structuredClone(task);
  if (next.sessions.some(s => aggregateEntries([], [s]).some(e=>e.date===date))) throw Error('此日已有时间段，请修改具体时段');
  const index = next.untimedEntries.findIndex(e => e.date === date);
  const entry = { date, seconds };
  if (index < 0) next.untimedEntries.push(entry);
  else next.untimedEntries[index] = entry;
  return validateTask(updateTotal(next));
}

export function todayTasks(tasks, today) {
  return tasks.filter(t => t.started <= today && (!t.done || t.done === today));
}

export function periodBounds(kind, date) {
  const d = new Date(date + 'T12:00:00');
  let end;
  if (kind === 'week') { d.setDate(d.getDate() - (d.getDay() + 6) % 7); end = new Date(d); end.setDate(end.getDate() + 7); }
  else if (kind === 'month') { d.setDate(1); end = new Date(d); end.setMonth(end.getMonth() + 1); }
  else { d.setMonth(0, 1); end = new Date(d); end.setFullYear(end.getFullYear() + 1); }
  return [localDay(d), localDay(end)];
}

export function periodSeconds(tasks, kind, date, now = new Date()) {
  const [a, b] = periodBounds(kind, date);
  return tasks.reduce((sum, t) => sum + stopTimer(t, now).timeEntries
    .filter(e => e.date >= a && e.date < b).reduce((s, e) => s + e.seconds, 0), 0);
}

export function periodStats(tasks, kind, date, now = new Date()) {
  const [a, b] = periodBounds(kind, date);
  const created = tasks.filter(t => t.started >= a && t.started < b);
  return { kind, date, tasks: created.length, done: created.filter(t => t.done).length,
    minutes: Math.floor(periodSeconds(tasks, kind, date, now) / 60),
    checks: tasks.filter(t => t.kind === 'habit' && t.done >= a && t.done < b).length };
}

export function completedTasks(tasks, { month = '', category = '', subtype = '', milestones = false } = {}) {
  return tasks.filter(t => t.done && (!month || t.done.startsWith(month))
    && (!category || t.category === category)
    && (!subtype || (subtype === '__uncategorized__' ? !t.subtype : t.subtype === subtype))
    && (!milestones || t.milestone)).sort((a, b) => b.done.localeCompare(a.done) || a.title.localeCompare(b.title));
}

export function subtypeNames(state, category) {
  return [...new Set([
    ...(state.subtypes || []).filter(s => s.category === category).map(s => s.name),
    ...state.tasks.filter(t => t.category === category && t.subtype).map(t => t.subtype),
  ])].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function rememberSubtype(state, category, name) {
  state.subtypes ||= [];
  if (name && !state.subtypes.some(s => s.category === category && s.name === name)) {
    state.subtypes.push({ category, name });
  }
}
