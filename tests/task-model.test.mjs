import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTask, durationMinutes, formatDuration, taskFromFields, reopenTask,
  completedTasks, subtypeNames, rememberSubtype } from '../public/task-model.js';

const base = { id: 't1', title: '项目开发', kind: 'task', category: '工作', subtype: '开发',
  date: '2026-10-28', started: '2026-10-29', done: null, progress: 45, minutes: 90,
  milestone: false, milestoneNote: '' };
const fields = { hours: '3', minutes: '20', progress: '65', started: '2026-10-29' };

test('legacy records retain duration and completion history', () => {
  const legacy = normalizeTask({ ...base, started: undefined, progress: undefined, subtype: undefined,
    done: '2026-11-05', minutes: '90' });
  assert.equal(legacy.progress, 100);
  assert.equal(legacy.minutes, 90);
  assert.equal(legacy.started, '2026-10-28');
  assert.equal(legacy.subtype, '');
});

test('hours and minutes convert exactly and reject invalid durations', () => {
  assert.equal(durationMinutes('3', '20'), 200);
  assert.equal(durationMinutes('0', '0'), 0);
  assert.equal(formatDuration(200), '3 小时 20 分钟');
  for (const [h, m] of [[-1, 0], [1, 60], [1.5, 0], [NaN, 0]]) {
    assert.throws(() => durationMinutes(h, m));
  }
});

test('manual progress, completion dates, milestone note and reopening stay consistent', () => {
  const partial = taskFromFields(fields, base, '2026-11-08');
  assert.equal(partial.progress, 65);
  assert.equal(partial.done, null);
  const done = taskFromFields({ ...fields, completed: 'on', done: '2026-11-05', milestone: 'on',
    milestoneNote: '  首次发布  ' }, partial, '2026-11-08');
  assert.equal(done.progress, 100);
  assert.equal(done.started, '2026-10-29');
  assert.equal(done.minutes, 200);
  assert.equal(done.milestoneNote, '首次发布');
  assert.equal(done.milestone, true);
  assert.equal(reopenTask(done).progress, 65);
  assert.equal(reopenTask(done).done, null);
  assert.equal(taskFromFields(fields, { ...base, kind: 'habit' }, '2026-11-08').progress, 0);
});

test('reject invalid execution ranges, missing finish dates, and inconsistent progress', () => {
  for (const extra of [{ completed: 'on', done: '2026-10-28' },
    { completed: 'on', done: '' }, { completed: 'on', done: '2026-11-09' },
    { completed: 'on', done: '2026-02-30' }, { progress: '101' }, { progress: '100' }, { progress: '1.5' }]) {
    assert.throws(() => taskFromFields({ ...fields, ...extra }, base, '2026-11-08'));
  }
});

test('completed search combines finish month, parent category, subtype and milestone', () => {
  const records = [
    { ...base, id: 'a', done: '2026-11-01', milestone: true },
    { ...base, id: 'b', done: '2026-10-31', milestone: true },
    { ...base, id: 'c', done: '2026-11-30', category: '学习', milestone: true },
    { ...base, id: 'd', done: '2026-11-08', subtype: '沟通' },
    { ...base, id: 'e', done: '2026-11-08', subtype: '' }, base,
  ];
  assert.deepEqual(completedTasks(records, { month: '2026-11', category: '工作', subtype: '开发', milestones: true }).map(t => t.id), ['a']);
  assert.equal(completedTasks(records, { month: '2026-11' }).length, 4);
  assert.equal(completedTasks(records, { month: '2026-11', subtype: '__uncategorized__' })[0].id, 'e');
  assert.equal(completedTasks(records, { month: '2026-12' }).length, 0);
});

test('subtype suggestions belong to their parent category and survive removal of tasks', () => {
  const state = { tasks: [base], subtypes: [] };
  rememberSubtype(state, '学习', '阅读');
  rememberSubtype(state, '学习', '阅读');
  assert.deepEqual(subtypeNames(state, '工作'), ['开发']);
  assert.deepEqual(subtypeNames(state, '学习'), ['阅读']);
  assert.equal(state.subtypes.length, 1);
});
