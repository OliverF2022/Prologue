import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timeReport,filterStatisticsTasks,periodOutcomes,statisticsTimeDetails} from '../public/time-analytics.js';
import {statisticsPage,statisticsCharts,statisticsDialog} from '../public/statistics-view.js';
import {normalizeTask} from '../public/task-model.js';

const at=(day,hour=0,minute=0)=>new Date(2026,10,day,hour,minute).toISOString();
const now=new Date(at(12,12));
const session=(id,day,h,m,endH,endM=0)=>({id,start:at(day,h,m),end:at(day,endH,endM),source:'manual'});
function fixtures(){return [
  {id:'work',title:'开发 <img>',category:'工作',subtype:'项目',kind:'task',date:'2026-10-01',done:'2026-11-11',milestone:true,milestoneNote:'交付 <script>',sessions:[session('a',9,9,30,10,15),session('b',9,10,15,10,30),{id:'c',start:at(10,23,30),end:at(11,0,30),source:'timer'}],untimedEntries:[{date:'2026-11-09',seconds:600}],interruptions:[{at:at(9,11),reason:'等待 <确认>',resumedAt:at(9,12)},{at:at(10,11),reason:'切换'},{at:at(16,11),reason:'下周'}]},
  {id:'study',title:'阅读',category:'学习',subtype:'读书',kind:'habit',date:'2026-11-09',done:'2026-11-11',sessions:[session('d',10,9,0,10)],untimedEntries:[],interruptions:[]},
  {id:'unfinished',title:'继续',category:'工作',subtype:'',kind:'task',date:'2026-11-09',done:null,milestone:true,sessions:[],untimedEntries:[],interruptions:[]},
  {id:'old',title:'旧成果',category:'生活',subtype:'',kind:'task',date:'2026-10-28',done:'2026-11-08',sessions:[],untimedEntries:[],interruptions:[]}
].map(normalizeTask);}

test('daily heat buckets and category stacks conserve exact recorded time including legacy totals',()=>{
  const tasks=fixtures(),before=JSON.stringify(tasks),r=timeReport(tasks,'week','2026-11-12',now);
  assert.equal(r.days[0].hours[9],1800);assert.equal(r.days[0].hours[10],1800);
  assert.deepEqual(r.days[0].categories,[{category:'工作',seconds:4200,taskCount:1}]);
  assert.equal(r.days[1].hours[23],1800);assert.equal(r.days[2].hours[0],1800);
  assert.equal(r.days.reduce((s,d)=>s+d.categories.reduce((a,c)=>a+c.seconds,0),0),r.total);
  assert.equal(r.days.reduce((s,d)=>s+d.hours.reduce((a,h)=>a+h,0),0),r.positioned);
  assert.equal(r.total-r.positioned,600);assert.equal(JSON.stringify(tasks),before);
});

test('outcomes use completion dates and interruption event dates with shared category/subtype filters',()=>{
  const tasks=fixtures(),out=periodOutcomes(tasks,'week','2026-11-12');
  assert.deepEqual(out.completed.map(t=>t.id),['work','study']);
  assert.deepEqual(out.milestones.map(t=>t.id),['work']);
  assert.equal(out.ordinary,1);assert.equal(out.checkins,1);assert.equal(out.interruptions.length,2);
  const filtered=filterStatisticsTasks(tasks,{category:'工作',subtype:'项目'});
  assert.equal(filtered.length,1);assert.equal(periodOutcomes(filtered,'week','2026-11-12').completed.length,1);
  assert.deepEqual(filterStatisticsTasks(tasks,{category:'工作',subtype:'__uncategorized__'}).map(t=>t.id),['unfinished']);
  assert.equal(timeReport(filterStatisticsTasks(tasks,{category:'学习'}),'week','2026-11-12',now).total,3600);
});

test('drilldowns clip hour intersections and midnight without assigning legacy totals to hours',()=>{
  const tasks=fixtures(),hour=statisticsTimeDetails(tasks,{type:'hour',date:'2026-11-09',hour:10},now);
  assert.equal(hour.length,2);assert.equal(hour[0].start,at(9,10));assert.equal(hour[0].seconds,900);
  assert.equal(hour.reduce((s,r)=>s+r.seconds,0),1800);
  assert.equal(statisticsTimeDetails(tasks,{type:'hour',date:'2026-11-09',hour:11},now).length,0);
  assert.equal(statisticsTimeDetails(tasks,{type:'hour',date:'2026-11-11',hour:0},now)[0].seconds,1800);
  assert.equal(statisticsTimeDetails(tasks,{type:'hour',date:'2026-11-09',hour:-1},now).length,0);
  const day=statisticsTimeDetails(tasks,{type:'day',date:'2026-11-09',category:'工作'},now);
  assert.equal(day.reduce((s,r)=>s+r.seconds,0),4200);assert.equal(day.filter(r=>r.untimed).length,1);
  const month=statisticsTimeDetails(tasks,{type:'month',date:'2026-11-01',category:'学习'},now);
  assert.equal(month.reduce((s,r)=>s+r.seconds,0),3600);
});

test('statistics renders full date axes, future cells, stable category colors and escaped read-only details',()=>{
  const tasks=fixtures(),before=JSON.stringify(tasks),categories=['工作','学习','生活'];
  const state={tasks,categories,subtypes:[]},week=statisticsPage(state,'week','2026-11-12',{},now);
  assert.equal((week.match(/data-heat-date=/g)||[]).length,7*24);
  assert.equal((week.match(/heat-future/g)||[]).length,3*24+11);
  assert.match(week,/tabindex="0"[^>]*data-cell-index="0"/);
  assert.match(week,/data-stack-category="工作"/);assert.match(week,/100.0%/);assert.match(week,/1 个事项/);
  assert.match(week,/旧版未定位用时/);
  assert.match(week,/本期开始事项的当前完成率/);
  assert.match(week,/50%（1 \/ 2 项，含打卡）/);
  const month=statisticsCharts(tasks,categories,'month','2026-11-12',now);
  assert.equal((month.match(/data-heat-date=/g)||[]).length,30*24);
  const study=statisticsCharts(filterStatisticsTasks(tasks,{category:'学习'}),categories,'week','2026-11-12',now);
  assert.match(study,/fill="#668fa3"/);
  const year=statisticsCharts(tasks,categories,'year','2026-11-12',now);
  assert.doesNotMatch(year,/data-heat-date=/);assert.match(year,/data-stack-scope="month"/);
  const detail=statisticsDialog(tasks,'week','2026-11-12',{type:'hour',date:'2026-11-09',hour:10},now);
  assert.match(detail,/开发 &lt;img&gt;/);assert.doesNotMatch(detail,/<img>|<form|data-delete/);
  const milestones=statisticsDialog(tasks,'week','2026-11-12',{type:'outcome',outcome:'milestones'},now);
  assert.match(milestones,/交付 &lt;script&gt;/);assert.doesNotMatch(milestones,/旧成果/);
  assert.equal(JSON.stringify(tasks),before);
});
