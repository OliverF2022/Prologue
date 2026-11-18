import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {taskFromFields,startTimer,localDay,todayTasks} from '../public/task-model.js';
import {createStateClient,mergeState} from '../public/state-sync.js';

async function workspace(run){
  const dir=await mkdtemp(join(tmpdir(),'prologue-sync-'));
  const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3042',DATA_DIR:dir}});
  try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});await run('http://127.0.0.1:3042/api/state',dir);}
  finally{const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;await rm(dir,{recursive:true,force:true})}
}
const entry=(id,title='same title')=>taskFromFields({title,category:'工作',kind:'task'},{id},localDay());

test('an old tab cannot overwrite a task and running timer created by another tab',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'prologue-concurrent-'));
  const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3041',DATA_DIR:dir}});
  try{
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
    const url='http://127.0.0.1:3041/api/state';
    const a=await fetch(url).then(r=>r.json()),b=structuredClone(a),now=new Date(),today=localDay(now);
    a.tasks.push(startTimer(taskFromFields({title:'Tab A running task',category:'工作',kind:'task'},{id:'a'},today),now));
    b.tasks.push(taskFromFields({title:'Tab B new task',category:'工作',kind:'task'},{id:'b'},today));
    assert.equal((await fetch(url,{method:'PUT',body:JSON.stringify(a)})).status,200);
    await fetch(url,{method:'PUT',body:JSON.stringify(b)});
    const stored=await fetch(url).then(r=>r.json());
    assert.ok(stored.tasks.some(t=>t.id==='a'),'Tab B must not remove Tab A task');
    assert.equal(stored.tasks.find(t=>t.id==='a').activeTimer,now.toISOString());
  }finally{const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;await rm(dir,{recursive:true,force:true})}
});

test('two real clients simultaneously create records and retain the first running task in today and on disk',()=>workspace(async(url,dir)=>{
  const initial=await fetch(url).then(r=>r.json()),a=createStateClient(initial,{url}),b=createStateClient(initial,{url});
  const first=structuredClone(initial),second=structuredClone(initial),now=new Date();
  first.tasks.push(startTimer(entry('a'),now));second.tasks.push(entry('b'));
  await Promise.all([a.save(first),b.save(second)]);
  await a.refresh();await b.refresh();
  for(const state of [a.snapshot,b.snapshot,JSON.parse(await readFile(join(dir,'store.json'),'utf8'))]){
    assert.deepEqual(new Set(state.tasks.map(t=>t.id)),new Set(['a','b']));
    assert.equal(state.tasks.find(t=>t.id==='a').activeTimer,now.toISOString());
    assert.equal(todayTasks(state.tasks,localDay()).length,2);assert.equal(state.revision,2);
  }
  const history=await readdir(join(dir,'history'));assert.ok(history.some(f=>f.startsWith('before-write-')));
}));

test('overlapping saves from one page retain the final auto-saved review text in order',()=>workspace(async url=>{
  const initial=await fetch(url).then(r=>r.json()),visible=[];
  const client=createStateClient(initial,{url,onState:s=>visible.push(s)});
  const snapshots=['a','ab','abc'].map(text=>({...structuredClone(initial),reviews:[{id:'r',kind:'week',date:localDay(),text,key:false}]}));
  await Promise.all(snapshots.map(s=>client.save(s)));
  assert.equal(client.snapshot.reviews[0].text,'abc');assert.equal(client.snapshot.revision,3);
  assert.equal((await fetch(url).then(r=>r.json())).reviews[0].text,'abc');
  assert.ok(visible.every(s=>s.reviews[0].text==='abc'));
}));

test('same-record conflicts preserve the server edit and expose the entire local draft for recovery',()=>workspace(async url=>{
  let initial=await fetch(url).then(r=>r.json());const seed=createStateClient(initial,{url});
  initial=await seed.save({...initial,tasks:[entry('task','original')]});
  let backup;const a=createStateClient(initial,{url}),b=createStateClient(initial,{url,onConflict:(_,draft)=>backup=draft});
  const first=structuredClone(initial),second=structuredClone(initial);first.tasks[0].title='A edit';second.tasks[0].title='B edit';
  await a.save(first);await assert.rejects(b.save(second),/同一事项/);
  assert.equal((await fetch(url).then(r=>r.json())).tasks[0].title,'A edit');
  assert.equal(backup.local.tasks[0].title,'B edit');assert.equal(b.blocked,true);
  second.tasks[0].title='B later edit';await assert.rejects(b.save(second));assert.equal(backup.local.tasks[0].title,'B later edit');
}));

test('legacy tabs without revisions are rejected and their submitted snapshots are retained',()=>workspace(async(url,dir)=>{
  const initial=await fetch(url).then(r=>r.json()),legacy={...initial,tasks:[entry('legacy')]};delete legacy.revision;
  const response=await fetch(url,{method:'PUT',body:JSON.stringify(legacy)});assert.equal(response.status,409);
  assert.equal((await response.json()).code,'CLIENT_UPGRADE_REQUIRED');
  assert.equal((await fetch(url).then(r=>r.json())).tasks.length,0);
  const files=await readdir(join(dir,'history')),rejected=JSON.parse(await readFile(join(dir,'history',files.find(f=>f.startsWith('rejected-write-'))),'utf8'));
  assert.equal(rejected.tasks[0].id,'legacy');
}));

test('simultaneous timer starts never create two active timers or discard the losing local change',()=>workspace(async url=>{
  let initial=await fetch(url).then(r=>r.json());initial=await createStateClient(initial,{url}).save({...initial,tasks:[entry('a'),entry('b')]});
  const a=createStateClient(initial,{url}),backups=[],b=createStateClient(initial,{url,onConflict:(_,draft)=>backups.push(draft)});
  const first=structuredClone(initial),second=structuredClone(initial);first.tasks[0]=startTimer(first.tasks[0]);second.tasks[1]=startTimer(second.tasks[1]);
  await a.save(first);await assert.rejects(b.save(second),/只能为一个事项计时/);
  const stored=await fetch(url).then(r=>r.json());assert.equal(stored.tasks.length,2);assert.equal(stored.tasks.filter(t=>t.activeTimer).length,1);
  assert.ok(backups[0].local.tasks[1].activeTimer);
}));

test('refresh respects dirty-form guards and demo resets cannot resurrect previous generations',()=>workspace(async url=>{
  const initial=await fetch(url).then(r=>r.json()),a=createStateClient(initial,{url}),b=createStateClient(initial,{url});
  await a.save({...initial,tasks:[entry('a')]});assert.equal(await b.refresh(()=>false),false);assert.equal(b.snapshot.tasks.length,0);
  assert.equal(await b.refresh(),true);assert.equal(b.snapshot.tasks[0].id,'a');
  const demoUrl=url.replace('/api/state','/api/demo/state'),old=await fetch(demoUrl).then(r=>r.json()),client=createStateClient(old,{url:demoUrl});
  await fetch(demoUrl.replace('/state','/reset'),{method:'POST'});
  await assert.rejects(client.save(old),/重新初始化/);
}));

test('independent deletions, category additions and review edits merge without resurrecting deleted records',()=>{
  const base={generation:'g',revision:1,tasks:[entry('a'),entry('b')],reviews:[],categories:['工作'],subtypes:[]};
  const local=structuredClone(base),remote=structuredClone(base);local.tasks=local.tasks.filter(t=>t.id!=='a');
  local.categories.push('学习');local.subtypes.push({category:'学习',name:'课程'});remote.tasks.push(entry('remote'));remote.categories.push('生活');
  const result=mergeState(base,local,remote);assert.deepEqual(new Set(result.tasks.map(t=>t.id)),new Set(['b','remote']));
  assert.deepEqual(new Set(result.categories),new Set(['工作','学习','生活']));assert.equal(result.subtypes[0].name,'课程');
  remote.tasks[0].title='remote edit';assert.throws(()=>mergeState(base,local,remote),/同一事项/);
});

test('late refresh responses cannot replace newer records already received by the page',()=>workspace(async url=>{
  const initial=await fetch(url).then(r=>r.json()),writer=createStateClient(initial,{url});
  await writer.save({...initial,tasks:[entry('a')]});
  let release,captured,first=true;
  const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>captured=resolve);
  const reader=createStateClient(initial,{url,fetcher:async(...args)=>{
    const response=await fetch(...args);if(first){first=false;captured();await gate;}return response;
  }});
  const slow=reader.refresh();await ready;
  await writer.save({...writer.snapshot,tasks:[...writer.snapshot.tasks,entry('b')]});
  assert.equal(await reader.refresh(),true);assert.equal(reader.snapshot.tasks.length,2);
  release();assert.equal(await slow,false);assert.equal(reader.snapshot.tasks.length,2);assert.equal(reader.snapshot.revision,2);
}));
