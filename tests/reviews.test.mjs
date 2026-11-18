import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeReviews,findReview,reviewDate,reviewDraft,reviewStatus,queryReviews,createReview,trashReview,restoreReview,reviewWeeks} from '../public/review-model.js';
import {reviewPage,reviewEditor,reviewMap,reviewResults} from '../public/review-view.js';
import {normalizeTask} from '../public/task-model.js';

const today='2026-11-17',now=new Date(today+'T12:00:00');
function fixture(){return {categories:['工作'],tasks:[normalizeTask({id:'t',title:'完成开发',category:'工作',kind:'task',date:'2026-11-09',done:'2026-11-13',milestone:true,sessions:[{id:'s',start:new Date('2026-11-09T09:30:00').toISOString(),end:new Date('2026-11-09T10:15:00').toISOString(),source:'timer'}],interruptions:[{at:new Date('2026-11-10T10:00:00').toISOString(),reason:'等待'}]})],reviews:[
  {id:'year',kind:'year',date:'2026-01-01',text:'年度总结',key:false},
  {id:'month',kind:'month',date:'2026-11-01',text:'月总结',key:false},
  {id:'written',kind:'week',date:'2026-11-09',text:'交付 <script>',key:false,color:'#65745d'},
  {id:'empty',kind:'week',date:'2026-11-16',text:'  \n ',key:false},
  {id:'key',kind:'week',date:'2026-11-02',text:'关键交付',key:true}
]};}

test('review queries match containing periods, text and status without creating records',()=>{
  const state=fixture(),before=JSON.stringify(state);
  assert.equal(reviewDate('week','2026-11-15'),'2026-11-09');
  assert.equal(findReview(state.reviews,'week','2026-11-13').id,'written');
  assert.deepEqual(queryReviews(state.reviews,{date:'2026-11-13'}).map(r=>r.id),['written','month','year']);
  assert.deepEqual(queryReviews(state.reviews,{kind:'week',keyword:'交付',status:'key'}).map(r=>r.id),['key']);
  assert.deepEqual(queryReviews(state.reviews,{status:'empty'}).map(r=>r.id),['empty']);
  assert.throws(()=>reviewDate('week','2026-02-30'),/有效/);
  assert.equal(JSON.stringify(state),before);
});
test('explicit creation uses canonical dates and refuses duplicate active periods',()=>{
  const state=fixture(),next=createReview(state,{kind:'week',date:'2026-10-15',text:'新复盘',key:true},'new');
  assert.equal(next.reviews.at(-1).date,'2026-10-12');assert.equal(next.reviews.at(-1).key,true);
  assert.equal(state.reviews.length,5);assert.equal(next.tasks,state.tasks);
  assert.throws(()=>createReview(next,{kind:'week',date:'2026-10-18'}),/已有复盘/);
});
test('opening the same unsaved period retains all draft edits without creating a stored review',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const draft={...reviewDraft('week','2026-10-15'),text:'尚未保存的总结',key:true,color:'#aa6788'};
  assert.equal(draft.date,'2026-10-12');
  assert.equal(reviewDraft('week','2026-10-18',draft),draft);
  assert.equal(reviewDraft('month','2026-10-18',draft).text,'');
  assert.equal(findReview(state.reviews,'week',draft.date),undefined);
  assert.equal(JSON.stringify(state),before);
});
test('delete and restore preserve text, key flag, color, other reviews and all task data across reload',()=>{
  const state=fixture(),before=JSON.stringify(state),deleted=trashReview(state,'key',now);
  assert.equal(activeReviews(deleted.reviews).length,4);assert.equal(queryReviews(deleted.reviews,{trash:true})[0].id,'key');
  assert.equal(findReview(deleted.reviews,'week','2026-11-02'),undefined);
  const restored=restoreReview(JSON.parse(JSON.stringify(deleted)),'key');
  assert.deepEqual(restored,state);assert.equal(JSON.stringify(state),before);
  const replaced=createReview(deleted,{kind:'week',date:'2026-11-03',text:'另一次创建'},'replacement');
  assert.throws(()=>restoreReview(replaced,'key'),/该周期已有复盘/);
  assert.throws(()=>trashReview(deleted,'key'),/已删除/);
});
test('weekly calendar covers year boundaries exactly once and applies future/key/written/empty precedence',()=>{
  const state=fixture(),before=JSON.stringify(state),weeks=reviewWeeks(state,2026,today,now);
  assert.equal(weeks[0].start,'2025-12-29');assert.equal(weeks[0].month,1);
  assert.equal(weeks.at(-1).start,'2026-12-28');assert.equal(new Set(weeks.map(w=>w.start)).size,weeks.length);
  assert.equal(weeks.find(w=>w.start==='2026-11-02').status,'key');
  const written=weeks.find(w=>w.start==='2026-11-09');assert.equal(written.status,'written');assert.equal(written.seconds,2700);assert.equal(written.completed,1);assert.equal(written.milestones,1);assert.equal(written.interruptions,1);
  assert.equal(weeks.find(w=>w.start==='2026-11-16').status,'empty');
  assert.equal(weeks.find(w=>w.start==='2026-11-23').status,'future');
  assert.equal(reviewStatus({key:true,text:'filled'},'2026-11-23',today),'future');
  assert.equal(reviewStatus({text:' '},'2026-11-09',today),'empty');
  assert.equal(JSON.stringify(state),before);
});
test('rendered navigation keeps hierarchy and escapes text, draft creation and recycle bin are explicit',()=>{
  const state=fixture(),ui={year:2026,filters:{},selectedId:'written'},page=reviewPage(state,ui,today,now);
  assert.match(page,/review-week-key/);assert.match(page,/review-week-empty/);assert.match(page,/review-week-future/);
  assert.match(page,/投入 45 分钟/);assert.match(page,/aria-describedby="review-week-tooltip"/);
  assert.match(page,/data-trash-review="written"/);assert.match(page,/交付 &lt;script&gt;/);assert.doesNotMatch(page,/<script>/);
  assert.match(reviewEditor(state,state.reviews[0],false,now),/data-open-review="month"/);
  assert.match(reviewEditor(state,state.reviews[1],false,now),/data-open-review="written"/);
  const draft=reviewEditor(state,{kind:'week',date:'2026-11-16',text:'草稿'},true,now);
  assert.match(draft,/取消创建/);assert.match(draft,/保存并创建/);assert.doesNotMatch(draft,/data-text=|data-trash-review=/);
  const deleted=trashReview(state,'written',now);
  assert.doesNotMatch(reviewResults(deleted,{}),/data-open-review="written"/);
  assert.match(reviewResults(deleted,{trash:true}),/data-restore-review="written"/);
  assert.equal((reviewMap(state,2026,today,now).match(/data-review-week=/g)||[]).length,53);
});
