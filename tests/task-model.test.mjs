import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTask, durationMinutes, formatDuration, taskFromFields, reopenTask,
  completeTask, startTimer, stopTimer, totalSeconds, interruptTask, resumeTask, setDailyTime,
  todayTasks, periodStats, completedTasks, subtypeNames, rememberSubtype, validateTask } from '../public/task-model.js';

const day = '2026-11-08';
const at = (d, h = 10, m = 0, s = 0) => new Date(2026, 10, d, h, m, s);
const create = (extra = {}) => taskFromFields({title:'项目开发',kind:'task',category:'工作',subtype:'开发',...extra}, {id:'t1'}, day, at(8));

test('creation assigns today and zero time, ignoring supplied date and duration fields', () => {
  const task = create({date:'2020-01-01',started:'2020-01-02',done:'2020-01-03',hours:'5',minutes:'30'});
  assert.equal(task.started, day);
  assert.equal(task.date, day);
  assert.equal(task.done, null);
  assert.equal(task.minutes, 0);
  assert.deepEqual(task.timeEntries, []);
  assert.equal(task.status, 'active');
});

test('legacy migration preserves all recorded minutes and dates without inventing daily history', () => {
  const legacy = normalizeTask({ ...create(), timeEntries:undefined, started:undefined,
    date:'2026-10-28', done:'2026-11-05', minutes:'90', subtype:undefined });
  assert.equal(legacy.progress, 100);
  assert.equal(legacy.minutes, 90);
  assert.equal(legacy.started, '2026-10-28');
  assert.equal(legacy.subtype, '');
  assert.deepEqual(legacy.timeEntries, [{date:'2026-11-05',seconds:5400,legacy:true}]);
  assert.deepEqual(normalizeTask(legacy), legacy);
});

test('hour/minute conversion is exact and rejects invalid values', () => {
  assert.equal(durationMinutes('3','20'), 200);
  assert.equal(formatDuration(200), '3 小时 20 分钟');
  for (const [h,m] of [[-1,0],[1,60],[1.5,0],[NaN,0]]) assert.throws(() => durationMinutes(h,m));
});

test('daily time adds across dates, replaces corrections, and counts unfinished work in the correct month', () => {
  let task = {...create(), date:'2026-10-30', started:'2026-10-30'};
  task = setDailyTime(task, '2026-10-31', '1','30', day);
  task = setDailyTime(task, '2026-11-01', '2','20', day);
  assert.equal(task.minutes, 230);
  assert.equal(periodStats([task],'month','2026-10-01').minutes,90);
  assert.equal(periodStats([task],'month',day).minutes,140);
  task = setDailyTime(task,'2026-11-01','1','0',day);
  assert.equal(task.minutes,150);
  assert.equal(task.timeEntries.length,2);
  assert.throws(() => setDailyTime(task,'2026-10-29','1','0',day));
  assert.throws(() => setDailyTime(task,'2026-11-09','1','0',day));
  assert.throws(() => setDailyTime(task,day,'24','1',day));
});

test('timer splits at midnight, survives JSON reload, and does not double-count repeated reads', () => {
  const task = startTimer(create(),at(8,23,59,30));
  const reloaded = normalizeTask(JSON.parse(JSON.stringify(task)));
  assert.equal(totalSeconds(reloaded,at(9,0,1,30)),120);
  assert.equal(totalSeconds(reloaded,at(9,0,1,30)),120);
  assert.deepEqual(reloaded.timeEntries,[]);
  assert.equal(startTimer(reloaded,at(9)).activeTimer,task.activeTimer);
  const stopped = stopTimer(reloaded,at(9,0,1,30));
  assert.deepEqual(stopped.timeEntries,[{date:'2026-11-08',seconds:30},{date:'2026-11-09',seconds:90}]);
  assert.equal(stopped.minutes,2);
  assert.equal(stopped.activeTimer,null);
  assert.equal(totalSeconds(stopped,at(10)),120);
  assert.throws(() => setDailyTime(task,day,'1','0',day));
});

test('interrupt requires a reason, stops timer, preserves progress and records repeatable resume history', () => {
  const running = startTimer({...create(),progress:45},at(8,10));
  assert.throws(() => interruptTask(running,'   ',at(8,10,5)));
  const interrupted = interruptTask(running,' 等待资料 ',at(8,10,5));
  assert.equal(interrupted.status,'interrupted');
  assert.equal(interrupted.progress,45);
  assert.equal(interrupted.minutes,5);
  assert.equal(interrupted.activeTimer,null);
  assert.equal(interrupted.interruptions[0].reason,'等待资料');
  assert.equal(totalSeconds(interrupted,at(9)),300);
  assert.throws(() => completeTask(interrupted,day,at(8,11)));
  assert.throws(() => startTimer(interrupted,at(8,11)));
  const resumed = resumeTask(interrupted,at(8,11));
  assert.equal(resumed.status,'active');
  assert.equal(resumed.activeTimer,null);
  assert.equal(resumed.interruptions[0].resumedAt,at(8,11).toISOString());
  assert.equal(resumed.progress,45);
  const again = interruptTask(resumed,'其他安排',at(8,12));
  assert.equal(again.interruptions.length,2);
  validateTask(again);
});

test('completion uses today, settles timer and preserves effort when reopened', () => {
  const running = startTimer({...create(),progress:65},at(8,10));
  const done = completeTask(running,day,at(8,10,20));
  assert.equal(done.done,day);
  assert.equal(done.started,day);
  assert.equal(done.progress,100);
  assert.equal(done.minutes,20);
  assert.equal(done.activeTimer,null);
  const reopened = reopenTask(done);
  assert.equal(reopened.progress,65);
  assert.equal(reopened.started,day);
  assert.equal(reopened.minutes,20);
  assert.equal(reopened.done,null);
  const later = completeTask(reopened,'2026-11-09',at(9));
  assert.equal(later.done,'2026-11-09');
  assert.equal(later.started,day);
});

test('editing progress completes at 100%, retains dates/time, and can reopen a finished task', () => {
  const task = setDailyTime(create(),day,'1','15',day);
  const partial = taskFromFields({progress:'65',started:'2000-01-01',hours:'5',minutes:'5'},task,day,at(8));
  assert.equal(partial.progress,65);
  assert.equal(partial.started,day);
  assert.equal(partial.minutes,75);
  const done = taskFromFields({progress:'100',milestone:'on',milestoneNote:' 首次发布 '},partial,day,at(8));
  assert.equal(done.done,day);
  assert.equal(done.milestoneNote,'首次发布');
  const reopened = taskFromFields({progress:'40'},done,day,at(8));
  assert.equal(reopened.done,null);
  assert.equal(reopened.progress,40);
  assert.equal(taskFromFields({progress:'65'},create({kind:'habit'}),day,at(8)).progress,0);
  for (const progress of ['101','1.5','-1']) assert.throws(() => taskFromFields({progress},task,day,at(8)));
});

test('unfinished and interrupted entries remain visible the next day without copying tasks', () => {
  const task = create(), interrupted = interruptTask({...task,id:'paused'},'等待',at(8));
  const done = completeTask({...task,id:'done'},day,at(8));
  assert.equal(todayTasks([task,interrupted,done],day).length,3);
  assert.deepEqual(todayTasks([task,interrupted,done],'2026-11-09').map(t=>t.id),['t1','paused']);
});

test('completed search still combines finish month, category, subtype and milestones', () => {
  const base = create();
  const records = [{...base,id:'a',done:'2026-11-01',milestone:true},
    {...base,id:'b',done:'2026-10-31',milestone:true},
    {...base,id:'c',done:'2026-11-30',category:'学习',milestone:true},
    {...base,id:'d',done:day,subtype:'沟通'}, {...base,id:'e',done:day,subtype:''},base];
  assert.deepEqual(completedTasks(records,{month:'2026-11',category:'工作',subtype:'开发',milestones:true}).map(t=>t.id),['a']);
  assert.equal(completedTasks(records,{month:'2026-11'}).length,4);
  assert.equal(completedTasks(records,{month:'2026-11',subtype:'__uncategorized__'})[0].id,'e');
});

test('subtype suggestions belong to their parent and persist independently of entries', () => {
  const state = {tasks:[create()],subtypes:[]};
  rememberSubtype(state,'学习','阅读');rememberSubtype(state,'学习','阅读');
  assert.deepEqual(subtypeNames(state,'工作'),['开发']);
  assert.deepEqual(subtypeNames(state,'学习'),['阅读']);
  assert.equal(state.subtypes.length,1);
});
