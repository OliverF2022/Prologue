import { localDay, periodBounds, formatElapsed } from './task-model.js';
import { runningSessions, splitSpan } from './time-model.js';

export function timeRange(kind, date) {
  if (kind !== 'day') return periodBounds(kind, date);
  const next = new Date(date + 'T12:00:00'); next.setDate(next.getDate() + 1);
  return [date, localDay(next)];
}

export function timeReport(tasks, kind, date, now = new Date()) {
  const [start, end] = timeRange(kind, date), hours = Array(24).fill(0), days = [];
  const dateMap = new Map(), taskMap = new Map(), segments = [];
  for (const d = new Date(start + 'T12:00:00'); localDay(d) < end; d.setDate(d.getDate() + 1)) {
    const item = { date: localDay(d), seconds: 0, positioned: 0 };
    dateMap.set(item.date, item); days.push(item);
  }
  let untimed = 0;
  for (const task of tasks) {
    const item = { id: task.id, title: task.title, category: task.category, seconds: 0, positioned: 0,
      hours: Array(24).fill(0) };
    for (const session of runningSessions(task, now)) {
      for (const part of splitSpan(session.start, session.end)) {
        if (part.date < start || part.date >= end) continue;
        hours[part.hour] += part.seconds;
        dateMap.get(part.date).seconds += part.seconds;
        dateMap.get(part.date).positioned += part.seconds;
        item.seconds += part.seconds; item.positioned += part.seconds; item.hours[part.hour] += part.seconds;
        segments.push({ ...part, taskId: task.id, title: task.title, source: session.source, sessionId: session.id });
      }
    }
    for (const entry of task.untimedEntries || []) {
      if (entry.date < start || entry.date >= end) continue;
      untimed += entry.seconds; item.seconds += entry.seconds; dateMap.get(entry.date).seconds += entry.seconds;
    }
    if (item.seconds > 0) taskMap.set(task.id, item);
  }
  // Join the hour-sized chunks back into each session's daily timeline row.
  const timeline = [];
  for (const part of segments.sort((a,b) => Date.parse(a.start) - Date.parse(b.start))) {
    const last = timeline.at(-1);
    if (last && last.sessionId === part.sessionId && last.taskId === part.taskId
        && last.date === part.date && last.end === part.start) {
      last.end = part.end; last.seconds += part.seconds;
    } else timeline.push({ ...part });
  }
  const positioned = hours.reduce((sum, value) => sum + value, 0);
  return { start, end, hours, days, tasks: [...taskMap.values()].sort((a,b)=>b.seconds-a.seconds),
    timeline, positioned, untimed, total: positioned + untimed };
}

export function dayBudget(report, date, now = new Date()) {
  const start = new Date(date + 'T00:00:00'), end = new Date(start); end.setDate(end.getDate() + 1);
  const available = (end - start) / 1000;
  const elapsed = Math.max(0, Math.min(available, (new Date(now) - start) / 1000));
  return { other: Math.max(0, elapsed - report.positioned), future: available - elapsed, available };
}

export function timeSummary(tasks, kind, date, now = new Date()) {
  const r = timeReport(tasks, kind, date, now), label = kind === 'week' ? '本周' : '本月';
  const active = r.days.filter(d=>d.seconds>0), best = Math.max(...r.hours), peak = r.hours
    .map((seconds,hour)=>({seconds,hour})).filter(h=>h.seconds===best && best>0);
  const top = [...r.days].sort((a,b)=>b.seconds-a.seconds)[0];
  const hourName = hour => `${String(hour).padStart(2,'0')}:00–${String(hour+1).padStart(2,'0')}:00`;
  const lines = [`${label}总投入 ${formatElapsed(r.total)}，涉及 ${r.tasks.length} 个事项，有投入记录 ${active.length} 天。`,
    peak.length ? `投入最集中的小时段：${peak.map(h=>hourName(h.hour)).join('、')}，各累计 ${formatElapsed(best)}。` : '尚无可定位到具体小时的用时记录。',
    top?.seconds ? `投入最多的一天：${top.date}，${formatElapsed(top.seconds)}。` : '本周期尚无投入记录。', '', '各事项用时：',
    ...(r.tasks.length ? r.tasks.map(t=>`- ${t.title}：${formatElapsed(t.seconds)}`) : ['- 暂无']), '', '各小时段累计投入（仅列非零时段）：',
    ...r.hours.flatMap((seconds,hour)=>seconds>0?[`- ${hourName(hour)}：${formatElapsed(seconds)}`]:[]), '', '每日投入：',
    ...r.days.map(d=>`- ${d.date}${kind==='week'?'（'+['周日','周一','周二','周三','周四','周五','周六'][new Date(d.date+'T12:00:00').getDay()]+'）':''}：${formatElapsed(d.seconds)}`)];
  if(r.untimed) lines.push('', `其中旧版未定位用时 ${formatElapsed(r.untimed)}，计入总量与每日投入，不归入小时段。`);
  return lines.join('\n');
}

export function reviewMarkdown(review, tasks, now = new Date()) {
  const label = {week:'周',month:'月',year:'年'}[review.kind];
  return `# ${review.date} ${label}复盘\n\n${review.key?'关键复盘\n\n':''}`
    + (['week','month'].includes(review.kind) ? `## 时间统计\n\n${timeSummary(tasks,review.kind,review.date,now)}\n\n` : '')
    + `## 我的总结\n\n${review.text || ''}`;
}
