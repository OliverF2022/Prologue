import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskFromFields, startTimer, stopTimer, updateTotal, validateTask, normalizeTask } from '../public/task-model.js';
import { editSession, validateTimeState } from '../public/time-model.js';
import { timeReport, dayBudget, timeSummary, reviewMarkdown } from '../public/time-analytics.js';

const at = (day, hour=0, minute=0) => new Date(2026,10,day,hour,minute);
const now = at(12,12);
function task(id,title='工作') { return taskFromFields({title,category:'工作',kind:'task'},{id},'2026-11-09',at(9)); }
function add(t,id,start,end) { return validateTask(updateTotal(editSession(t,{start,end},id,now))); }
function fixtures() {
  let work=add(task('work','开发'),'a',at(9,9,30),at(9,10,15));
  const study=add(task('study','阅读'),'b',at(10,9),at(10,10));
  work=add(work,'c',at(10,23,30),at(11,0,30));
  return [work,study];
}

test('timer preserves exact endpoints and derives daily totals without double counting',()=>{
  const running=startTimer(task('t'),at(9,23,30)), stopped=stopTimer(running,at(10,0,30));
  assert.equal(stopped.sessions.length,1);
  assert.equal(stopped.sessions[0].start,at(9,23,30).toISOString());
  assert.equal(stopped.sessions[0].end,at(10,0,30).toISOString());
  assert.equal(stopped.minutes,60);
  assert.deepEqual(stopped.timeEntries.map(e=>e.seconds),[1800,1800]);
  assert.deepEqual(normalizeTask(normalizeTask(stopped)),stopped);
  assert.deepEqual(stopTimer(stopped,now),stopped);
});

test('editing and deleting sessions replaces their derived duration',()=>{
  const original=fixtures()[0];
  const changed=add(original,'a',at(9,9),at(9,10));
  assert.equal(changed.sessions.length,2);
  assert.equal(changed.minutes,120);
  const removed=updateTotal({...changed,sessions:changed.sessions.filter(s=>s.id!=='a')});
  assert.equal(removed.minutes,60);
  assert.equal(original.minutes,105);
});

test('reject overlap across tasks and within a task but allow adjacent endpoints',()=>{
  const a=add(task('a'),'a1',at(9,9),at(9,10));
  const b=add(task('b'),'b1',at(9,10),at(9,11));
  assert.doesNotThrow(()=>validateTimeState([a,b],now));
  const overlap=add(task('c'),'c1',at(9,9,59),at(9,10,30));
  assert.throws(()=>validateTimeState([a,overlap],now),/重叠/);
  assert.throws(()=>validateTimeState([add(a,'a2',at(9,9,30),at(9,11))],now),/重叠/);
  assert.throws(()=>editSession(a,{start:at(9,10),end:at(9,9)},'bad',now));
  assert.throws(()=>editSession(a,{start:at(12,11),end:at(12,13)},'future',now));
  assert.throws(()=>add(a,'before',at(8,10),at(8,11)),/起止时间/);
});

test('weekly hourly buckets sum exact intersections across all days and midnight',()=>{
  const tasks=fixtures(),r=timeReport(tasks,'week','2026-11-12',now);
  assert.equal(r.start,'2026-11-09');assert.equal(r.days.length,7);
  assert.equal(r.hours[9],90*60);assert.equal(r.hours[10],15*60);
  assert.equal(r.hours[23],30*60);assert.equal(r.hours[0],30*60);
  assert.equal(r.total,165*60);
  assert.deepEqual(r.days.map(d=>d.seconds/60),[45,90,30,0,0,0,0]);
  assert.equal(r.timeline.length,4);
  assert.equal(r.timeline[0].seconds,45*60);
});

test('month boundaries, empty days and leap years have correct buckets',()=>{
  const r=timeReport(fixtures(),'month','2026-11-12',now);
  assert.equal(r.days.length,30);assert.equal(r.days[29].date,'2026-11-30');
  assert.equal(timeReport([],'month','2028-02-10',now).days.length,29);
  let t={...task('cross'),started:'2026-10-31',date:'2026-10-31'};
  t=add(t,'cross1',new Date(2026,9,31,23,30),at(1,0,30));
  assert.equal(timeReport([t],'month','2026-10-01',now).total,1800);
  assert.equal(timeReport([t],'month','2026-11-01',now).total,1800);
});

test('today pie separates elapsed unrecorded time from the future and conserves a full day',()=>{
  const empty=timeReport([],'day','2026-11-12',now),budget=dayBudget(empty,'2026-11-12',now);
  assert.equal(budget.other,12*3600);assert.equal(budget.future,12*3600);
  const past=timeReport(fixtures(),'day','2026-11-09',now),pastBudget=dayBudget(past,'2026-11-09',now);
  assert.equal(past.positioned,2700);assert.equal(pastBudget.future,0);
  assert.equal(past.positioned+pastBudget.other,24*3600);
});

test('running sessions count provisionally and legacy totals are never assigned invented hours',()=>{
  const running=startTimer(task('live'),at(12,11));
  assert.equal(timeReport([running],'day','2026-11-12',now).hours[11],3600);
  assert.deepEqual(running.sessions,[]);
  const legacy=normalizeTask({id:'legacy',title:'旧记录',category:'工作',kind:'task',date:'2026-11-09',minutes:60});
  const r=timeReport([legacy],'week','2026-11-12',now);
  assert.equal(r.total,3600);assert.equal(r.untimed,3600);assert.equal(r.positioned,0);
  assert.equal(r.hours.reduce((a,b)=>a+b,0),0);
});

test('weekly/monthly review text and exports include hourly daily and task statistics',()=>{
  const tasks=fixtures(),text=timeSummary(tasks,'week','2026-11-12',now);
  assert.match(text,/2 小时 45 分钟/);assert.match(text,/09:00–10:00/);
  assert.match(text,/2026-11-09（周一）/);assert.match(text,/开发/);
  const md=reviewMarkdown({date:'2026-11-01',kind:'month',text:'我的手写总结'},tasks,now);
  assert.match(md,/## 时间统计/);assert.match(md,/2026-11-30/);assert.match(md,/我的手写总结/);
  assert.doesNotMatch(reviewMarkdown({date:'2026-01-01',kind:'year',text:''},tasks,now),/## 时间统计/);
});
