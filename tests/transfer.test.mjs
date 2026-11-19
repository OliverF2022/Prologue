import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTask,todayTasks} from '../public/task-model.js';
import {makeTaskPackage,validateTaskPackage,planTaskImport} from '../public/transfer-model.js';
import {timeReport} from '../public/time-analytics.js';
const now=new Date('2026-11-18T12:00:00'),date='2026-11-18';
function source(){return {device:{id:'device',name:'外出电脑',timeZone:'Asia/Shanghai'},workspaceId:'workspace',workDate:date,categories:['工作'],subtypes:[{category:'工作',name:'项目'}],tasks:[normalizeTask({id:'task',title:'外出事项',kind:'task',category:'工作',subtype:'项目',date,progress:40,transferVersion:1,sessions:[{id:'segment',source:'manual',start:new Date(date+'T09:30:00').toISOString(),end:new Date(date+'T10:15:00').toISOString()}]})]};}
const target=()=>({generation:'host',revision:2,categories:['工作'],subtypes:[],tasks:[],reviews:[{id:'review',text:'保留'}]});

test('packet keeps exact intervals and excludes reviews, host versions and active timers',()=>{
 const s=source(),packet=makeTaskPackage(s,now,'packet');
 assert.equal(packet.tasks[0].sessions[0].id,'segment');assert.equal(packet.reviews,undefined);assert.equal(packet.generation,undefined);
 s.tasks[0].activeTimer=now.toISOString();assert.throws(()=>makeTaskPackage(s,now,'packet'),/暂停/);
 assert.throws(()=>validateTaskPackage({...packet,format:'other'},now));
 const bad=structuredClone(packet);bad.tasks[0].sessions[0].end=new Date(now.getTime()+10000).toISOString();assert.throws(()=>validateTaskPackage(bad,now),/尚未发生/);
});
test('import participates in hourly statistics, preserves unfinished progress and does not roll over',()=>{
 const state=target(),before=JSON.stringify(state),plan=planTaskImport(state,makeTaskPackage(source(),now,'packet'),{},now);
 assert.equal(plan.counts.added,1);assert.equal(plan.state.tasks[0].progress,40);assert.equal(plan.state.tasks[0].done,null);
 assert.equal(todayTasks(plan.state.tasks,'2026-11-19').length,0);assert.equal(todayTasks(plan.state.tasks,date).length,1);
 const report=timeReport(plan.state.tasks,'day',date,now);assert.equal(report.total,2700);assert.equal(report.hours[9],1800);assert.equal(report.hours[10],900);
 assert.deepEqual(plan.state.reviews,state.reviews);assert.equal(JSON.stringify(state),before);
});
test('repeat and older exports never duplicate time or overwrite newer task content',()=>{
 const s=source(),packet=makeTaskPackage(s,now,'packet'),first=planTaskImport(target(),packet,{},now);
 const duplicate=planTaskImport(first.state,{...packet,packageId:'second-packet'},{},now);assert.equal(duplicate.counts.duplicate,1);assert.equal(duplicate.changed,false);
 s.tasks[0].title='新的标题';s.tasks[0].transferVersion=2;
 const newer=planTaskImport(first.state,makeTaskPackage(s,now,'newer'),{},now);assert.equal(newer.counts.updated,1);
 const old=planTaskImport(newer.state,packet,{},now);assert.equal(old.changed,false);assert.equal(old.state.tasks[0].title,'新的标题');
 const tampered=structuredClone(packet);tampered.tasks[0].title='同版本改写';assert.equal(planTaskImport(first.state,tampered,{},now).counts.conflict,1);
});
test('source updates merge independent host edits but flag competing edits and interval overlaps',()=>{
 const s=source(),first=planTaskImport(target(),makeTaskPackage(s,now,'a'),{},now);
 first.state.tasks[0].milestone=true;s.tasks[0].title='修改标题';s.tasks[0].transferVersion=2;
 const merged=planTaskImport(first.state,makeTaskPackage(s,now,'b'),{},now);assert.equal(merged.counts.updated,1);assert.equal(merged.state.tasks[0].milestone,true);
 first.state.tasks[0].title='主程序标题';assert.equal(planTaskImport(first.state,makeTaskPackage(s,now,'c'),{},now).counts.conflict,1);
 const occupied=target();occupied.tasks=[normalizeTask({...s.tasks[0],id:'host',title:'本机事项'})];
 const conflict=planTaskImport(occupied,makeTaskPackage(source(),now,'d'),{},now);assert.equal(conflict.counts.conflict,1);assert.equal(conflict.state.tasks.length,1);
 const skipped=planTaskImport(occupied,makeTaskPackage(source(),now,'e'),{'device/workspace/task':{skip:true}},now);assert.equal(skipped.canImport,true);assert.equal(skipped.changed,false);
});
test('explicit mapping appends intervals while retaining the long-running host task lifecycle',()=>{
 const s=source(),state=target();state.tasks=[normalizeTask({id:'host',title:'长期事项',kind:'task',category:'工作',date:'2026-11-01',progress:60})];
 const result=planTaskImport(state,makeTaskPackage(s,now,'packet'),{'device/workspace/task':{targetId:'host'}},now);
 assert.equal(result.counts.merged,1);assert.equal(result.state.tasks.length,1);assert.equal(result.state.tasks[0].title,'长期事项');assert.equal(result.state.tasks[0].progress,60);
 assert.equal(result.state.tasks[0].rollover,undefined);assert.equal(todayTasks(result.state.tasks,'2026-11-19').length,1);
 const deleted={...result.state,tasks:[]};assert.equal(planTaskImport(deleted,makeTaskPackage({...s,tasks:s.tasks.map(t=>({...t,transferVersion:2}))},now,'again'),{},now).counts.skipped,1);
});
test('completed check-ins and milestones retain their recorded completion date and notes',()=>{
 const s=source();s.tasks[0]={...s.tasks[0],kind:'habit',done:date,status:'completed',progress:100,milestone:true,milestoneNote:'每日成果'};
 const result=planTaskImport(target(),makeTaskPackage(s,now,'packet'),{},now);
 assert.equal(result.counts.added,1);assert.equal(result.state.tasks[0].done,date);assert.equal(result.state.tasks[0].milestoneNote,'每日成果');
 assert.equal(result.state.tasks[0].kind,'habit');assert.equal(todayTasks(result.state.tasks,'2026-11-19').length,0);
});
