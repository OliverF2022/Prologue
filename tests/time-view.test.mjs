import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTask} from '../public/task-model.js';
import {todayTimeCharts,periodTimeCharts} from '../public/time-charts.js';
import {sessionDialog} from '../public/task-view.js';

const now=new Date(2026,10,12,12);
const task=normalizeTask({id:'t',title:'开发 <script>alert(1)</script>',category:'工作',kind:'task',date:'2026-11-12',
  sessions:[{id:'s',start:new Date(2026,10,12,9,30).toISOString(),end:new Date(2026,10,12,10,15).toISOString(),source:'manual'}],untimedEntries:[]});

test('today pie and bars expose task durations and distinguish unrecorded from future time',()=>{
  const pie=todayTimeCharts([task],'2026-11-12','pie',now);
  assert.match(pie,/其他（已过去但未记录）/);assert.match(pie,/尚未到来/);
  assert.match(pie,/45 分钟/);assert.match(pie,/09:30–10:15/);
  assert.doesNotMatch(pie,/<script>/);assert.match(pie,/&lt;script&gt;/);
  const bars=todayTimeCharts([task],'2026-11-12','bar',now);
  assert.match(bars,/今日每小时各任务投入/);assert.match(bars,/09:00–10:00/);
});

test('week and month charts contain the complete requested date axes and accessible data tables',()=>{
  const week=periodTimeCharts([task],'week','2026-11-12',now);
  assert.match(week,/周一/);assert.match(week,/周日/);assert.match(week,/23:00–24:00/);
  assert.match(week,/2026-11-09/);assert.match(week,/2026-11-15/);
  const month=periodTimeCharts([task],'month','2026-11-12',now);
  assert.match(month,/2026-11-01/);assert.match(month,/2026-11-30/);assert.doesNotMatch(month,/2026-11-31/);
});

test('session edit form retains endpoints and task association with no cumulative-time input',()=>{
  const html=sessionDialog(task,task.sessions[0],now);
  assert.match(html,/data-session-form="t"/);assert.match(html,/data-session-id="s"/);
  assert.match(html,/2026-11-12T09:30:00/);assert.match(html,/2026-11-12T10:15:00/);
  assert.doesNotMatch(html,/name="hours"/);
});
