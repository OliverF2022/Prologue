import { localDay, periodBounds, formatElapsed, todayTasks } from './task-model.js';
import { runningSessions, splitSpan } from './time-model.js';

export function timeRange(kind, date) {
  if (kind !== 'day') return periodBounds(kind, date);
  const next = new Date(date + 'T12:00:00'); next.setDate(next.getDate() + 1);
  return [date, localDay(next)];
}

export function dailyStats(tasks,date,now=new Date()){
  const visible=todayTasks(tasks,date),r=timeReport(tasks,'day',date,now);
  return {kind:'day',date,tasks:visible.length,done:visible.filter(t=>t.done===date).length,
    minutes:Math.floor(r.total/60),checks:tasks.filter(t=>t.kind==='habit'&&t.done===date).length};
}

export function timeReport(tasks, kind, date, now = new Date()) {
  const [start, end] = timeRange(kind, date), hours = Array(24).fill(0), days = [];
  const dateMap = new Map(), taskMap = new Map(), segments = [];
  for (const d = new Date(start + 'T12:00:00'); localDay(d) < end; d.setDate(d.getDate() + 1)) {
    const item = { date: localDay(d), seconds: 0, positioned: 0, hours: Array(24).fill(0), categoryMap: new Map() };
    dateMap.set(item.date, item); days.push(item);
  }
  let untimed = 0;
  for (const task of tasks) {
    const item = { id: task.id, title: task.title, category: task.category, subtype:task.subtype||'', seconds: 0, positioned: 0,
      hours: Array(24).fill(0) };
    for (const session of runningSessions(task, now)) {
      for (const part of splitSpan(session.start, session.end)) {
        if (part.date < start || part.date >= end) continue;
        hours[part.hour] += part.seconds;
        dateMap.get(part.date).seconds += part.seconds;
        dateMap.get(part.date).positioned += part.seconds;
        dateMap.get(part.date).hours[part.hour] += part.seconds;
        addCategory(dateMap.get(part.date),task,part.seconds);
        item.seconds += part.seconds; item.positioned += part.seconds; item.hours[part.hour] += part.seconds;
        segments.push({ ...part, taskId: task.id, title: task.title, source: session.source, sessionId: session.id });
      }
    }
    for (const entry of task.untimedEntries || []) {
      if (entry.date < start || entry.date >= end) continue;
      untimed += entry.seconds; item.seconds += entry.seconds; dateMap.get(entry.date).seconds += entry.seconds;
      addCategory(dateMap.get(entry.date),task,entry.seconds);
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
  const daily=days.map(({categoryMap,...day})=>({...day,categories:[...categoryMap.values()].map(({taskIds,...group})=>({...group,taskCount:taskIds.size}))}));
  return { start, end, hours, days:daily, tasks: [...taskMap.values()].sort((a,b)=>b.seconds-a.seconds),
    timeline, positioned, untimed, total: positioned + untimed };
}

function addCategory(day,task,seconds){
  if(seconds<=0)return;
  const group=day.categoryMap.get(task.category)||{category:task.category,seconds:0,taskIds:new Set()};
  group.seconds+=seconds;group.taskIds.add(task.id);day.categoryMap.set(task.category,group);
}

export function filterStatisticsTasks(tasks,{category='',subtype=''}={}){
  return tasks.filter(t=>(!category||t.category===category)&&(!subtype||(subtype==='__uncategorized__'?!t.subtype:t.subtype===subtype)));
}

export function periodOutcomes(tasks,kind,date){
  const [start,end]=timeRange(kind,date);
  const completed=tasks.filter(t=>t.done&&t.done>=start&&t.done<end);
  const interruptions=tasks.flatMap(task=>(task.interruptions||[])
    .filter(record=>{const day=localDay(record.at);return day>=start&&day<end})
    .map(record=>({task,record})));
  return {completed,milestones:completed.filter(t=>t.milestone),interruptions,
    ordinary:completed.filter(t=>t.kind!=='habit').length,checkins:completed.filter(t=>t.kind==='habit').length};
}

export function statisticsTimeDetails(tasks,selection,now=new Date()){
  const scope=selection.type==='month'?'month':'day';
  const filtered=selection.category?tasks.filter(t=>t.category===selection.category):tasks;
  const r=timeReport(filtered,scope,selection.date,now);
  let start=-Infinity,end=Infinity;
  if(selection.type==='hour'){
    if(!Number.isInteger(selection.hour)||selection.hour<0||selection.hour>23)return [];
    const d=new Date(selection.date+'T00:00:00');d.setHours(selection.hour);start=d.getTime();d.setHours(d.getHours()+1);end=d.getTime();
  }
  const rows=r.timeline.flatMap(segment=>{
    const a=Math.max(start,Date.parse(segment.start)),b=Math.min(end,Date.parse(segment.end));
    if(b<=a)return [];
    const task=filtered.find(t=>t.id===segment.taskId);
    return [{...segment,start:new Date(a).toISOString(),end:new Date(b).toISOString(),seconds:(b-a)/1000,
      category:task.category,subtype:task.subtype||''}];
  });
  if(selection.type!=='hour'){
    for(const task of filtered)for(const entry of task.untimedEntries||[]){
      if(entry.date>=r.start&&entry.date<r.end&&entry.seconds>0)rows.push({taskId:task.id,title:task.title,
        category:task.category,subtype:task.subtype||'',date:entry.date,seconds:entry.seconds,untimed:true});
    }
  }
  return rows;
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
