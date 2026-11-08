export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function normalizeTask(task) {
  const minutes = Number(task.minutes ?? 0);
  return {
    ...task,
    subtype: task.subtype || '',
    started: task.started || (task.done ? (task.date < task.done ? task.date : task.done) : ''),
    done: task.done || null,
    minutes: Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0,
    progress: task.done ? 100 : Math.max(0, Math.min(99, Number(task.progress) || 0)),
    milestone: Boolean(task.milestone),
    milestoneNote: task.milestoneNote || '',
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

export function validateTask(task) {
  if (typeof task.id !== 'string' || !task.id || typeof task.title !== 'string' || !task.title.trim()
      || task.title.length > 200 || !['task', 'habit'].includes(task.kind)) throw Error('事项名称或类型无效');
  if (typeof task.category !== 'string' || !task.category.trim()) throw Error('请选择主类型');
  if (typeof task.subtype !== 'string' || task.subtype.length > 80) throw Error('子类型不能超过 80 字');
  if (!isDate(task.date) || (task.started && !isDate(task.started)) || (task.done && !isDate(task.done))) {
    throw Error('请填写有效日期');
  }
  if (task.done && !task.started) throw Error('完成事项需要填写执行开始日期');
  if (task.done && task.started > task.done) throw Error('完成日期不能早于执行开始日期');
  if (!Number.isInteger(task.minutes) || task.minutes < 0 || task.minutes > 600059) throw Error('实际耗时无效');
  if (!Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) throw Error('进度须为 0–100 的整数');
  if (task.done && task.progress !== 100) throw Error('已完成事项进度应为 100%');
  if (!task.done && task.progress === 100) throw Error('进度为 100% 时请填写完成日期');
  if (typeof task.milestone !== 'boolean' || typeof task.milestoneNote !== 'string'
      || task.milestoneNote.length > 1000) throw Error('里程碑备注不能超过 1000 字');
  return task;
}

// The same rules apply when creating, editing, or completing an entry.
export function taskFromFields(fields, previous, today) {
  const completed = fields.completed === 'on';
  const task = {
    ...previous,
    title: (fields.title ?? previous.title).trim(),
    category: fields.category ?? previous.category,
    kind: fields.kind ?? previous.kind,
    date: fields.date ?? previous.date,
    subtype: (fields.subtype ?? previous.subtype ?? '').trim(),
    started: fields.started ?? previous.started ?? '',
    done: completed ? fields.done : null,
    minutes: durationMinutes(fields.hours, fields.minutes),
    progress: completed ? 100 : Number(fields.progress || 0),
    milestone: fields.milestone === 'on',
    milestoneNote: (fields.milestoneNote || '').trim(),
  };
  if (completed && !task.done) throw Error('请填写完成日期');
  if (task.done > today || task.started > today) throw Error('执行日期不能晚于今天');
  if (task.kind === 'habit') task.progress = completed ? 100 : 0;
  if (completed && !previous.done) task.previousProgress = previous.progress || 0;
  return validateTask(task);
}

export function reopenTask(task) {
  return { ...task, done: null, progress: task.kind === 'habit' ? 0 : Math.min(99, task.previousProgress || 0) };
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
