import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoState} from '../public/demo-data.js';
import {validateTask} from '../public/task-model.js';
import {validateTimeState} from '../public/time-model.js';
import {timeReport} from '../public/time-analytics.js';

for(const now of [new Date(2026,10,13,18),new Date(2026,10,13,0,1),new Date(2027,0,1,9),new Date(2028,1,29,20)]) {
  test(`demo is complete, synthetic and non-overlapping at ${now.toISOString()}`,()=>{
    const state=createDemoState(now);
    assert.equal(state.demo,true);assert.ok(state.tasks.length>40);assert.ok(state.reviews.length>=8);
    state.tasks.forEach(task=>{validateTask(task);assert.match(task.title,/^\[演示\]/)});
    validateTimeState(state.tasks,now);
    assert.ok(state.tasks.some(t=>t.milestone&&t.milestoneNote));
    assert.ok(state.tasks.some(t=>t.status==='interrupted'&&t.interruptions.length));
    assert.ok(state.reviews.some(r=>r.key));
    assert.ok(state.reviews.some(r=>r.kind==='year'));assert.ok(state.reviews.some(r=>r.kind==='month'));
    const report=timeReport(state.tasks,'day',state.demoAnchorDate,now);
    assert.ok(report.positioned>0);assert.equal(state.tasks.filter(t=>t.activeTimer).length,0);
  });
}
