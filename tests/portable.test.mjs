import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {taskFromFields,startTimer,localDay} from '../public/task-model.js';

test('client export/reset and host preview/import preserve data, reject stale previews and deduplicate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prologue-portable-')),children=[];
 async function launch(script,port,data){const child=spawn(process.execPath,[script],{env:{...process.env,PORT:String(port),DATA_DIR:data}});children.push(child);await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('server exit '+c)))});return 'http://127.0.0.1:'+port;}
 async function request(url,method='GET',body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 try{
  const clientDir=join(dir,'client'),hostDir=join(dir,'host'),client=await launch('portable-server.mjs',3051,clientDir),host=await launch('server.mjs',3052,hostDir);
  assert.equal((await fetch(client+'/')).status,200);assert.equal((await fetch(client+'/review-view.js')).status,404);
  let state=(await request(client+'/api/state')).data;const now=new Date(),today=localDay();
  state.tasks.push(startTimer(taskFromFields({title:'外出记录',category:'工作',kind:'task'},{id:'client-task'},today),new Date(now.getTime()-1000)));
  state=(await request(client+'/api/state','PUT',state)).data;assert.equal(state.tasks[0].transferVersion,1);
  const stale=structuredClone(state);const exported=await request(client+'/api/export','POST',{generation:state.generation,revision:state.revision});assert.equal(exported.status,200);state=exported.data.state;
  assert.equal(state.tasks[0].activeTimer,null);assert.ok(state.tasks[0].sessions.length);assert.equal(state.tasks[0].transferVersion,2);
  const packet=(await request(client+'/api/exports/'+exported.data.fileName)).data;assert.equal(packet.tasks.length,1);assert.equal(packet.reviews,undefined);
  assert.equal((await request(client+'/api/reset','POST',{generation:stale.generation,revision:stale.revision,mode:'discard'})).status,409);
  const unchanged=(await request(client+'/api/state')).data;assert.equal(unchanged.tasks.length,1);
  let preview=(await request(host+'/api/import/preview','POST',{packet})).data;assert.equal(preview.counts.added,1);
  const wrong=await request(host+'/api/import/commit','POST',{packet,generation:preview.generation,revision:preview.revision+1});assert.equal(wrong.status,409);
  let result=await request(host+'/api/import/commit','POST',{packet,generation:preview.generation,revision:preview.revision});assert.equal(result.status,200);assert.equal(result.data.state.tasks[0].activeTimer,null);assert.equal(result.data.state.tasks[0].rollover,false);
  preview=(await request(host+'/api/import/preview','POST',{packet})).data;assert.equal(preview.counts.duplicate,1);
  result=await request(host+'/api/import/commit','POST',{packet,generation:preview.generation,revision:preview.revision});assert.equal(result.data.state.tasks.length,1);assert.equal(result.data.changed,false);
  const generation=state.generation,device=state.device.id;
  const reset=await request(client+'/api/reset','POST',{generation,revision:state.revision,mode:'export'});assert.equal(reset.status,200);state=reset.data.state;
  assert.equal(state.tasks.length,0);assert.notEqual(state.generation,generation);assert.equal(state.device.id,device);assert.ok(reset.data.fileName);
  assert.equal((await request(client+'/api/state','PUT',stale)).status,409);
  const exports=await readdir(join(clientDir,'exports'));assert.equal(exports.length,2);
  state.tasks.push(taskFromFields({title:'重置后的新事项',category:'工作',kind:'task'},{id:'new-task'},today));state=(await request(client+'/api/state','PUT',state)).data;
  // A real filesystem failure during export must leave every record intact.
  const exportsDir=join(clientDir,'exports');for(const name of await readdir(exportsDir))await rm(join(exportsDir,name));await rm(exportsDir,{recursive:true});await writeFile(exportsDir,'blocked');
  const failure=await request(client+'/api/reset','POST',{generation:state.generation,revision:state.revision,mode:'export'});assert.equal(failure.status,400);
  assert.equal((await request(client+'/api/state')).data.tasks.length,1);
  const discarded=await request(client+'/api/reset','POST',{generation:state.generation,revision:state.revision,mode:'discard'});assert.equal(discarded.status,200);assert.equal(discarded.data.state.tasks.length,0);
  assert.ok((await readdir(join(clientDir,'reset-backups'))).length);
  assert.equal(JSON.parse(await readFile(join(hostDir,'store.json'),'utf8')).tasks.length,1);
 }finally{for(const child of children){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}await rm(dir,{recursive:true,force:true})}
});

test('an old workday requires manual reset and a second process cannot use its data concurrently',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prologue-workday-')),today=localDay(),day=new Date(today+'T12:00:00');day.setDate(day.getDate()-1);const yesterday=localDay(day);
 const original={generation:'generation',revision:7,workspaceId:'workspace',workDate:yesterday,device:{id:'device',name:'测试电脑',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone},categories:['工作'],subtypes:[],tasks:[{...taskFromFields({title:'昨日未完成',category:'工作',kind:'task'},{id:'yesterday'},yesterday),transferVersion:1}],reviews:[]};
 await writeFile(join(dir,'store.json'),JSON.stringify(original));
 const child=spawn(process.execPath,['portable-server.mjs'],{env:{...process.env,PORT:'3053',DATA_DIR:dir}});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('server exit '+c)))});
  const url='http://127.0.0.1:3053/api/state',before=await fetch(url).then(r=>r.json());assert.equal(before.tasks.length,1);assert.equal(before.workDate,yesterday);
  const add=structuredClone(before);add.tasks.push(taskFromFields({title:'今天新事项',category:'工作',kind:'task'},{id:'today'},today));
  assert.equal((await fetch(url,{method:'PUT',body:JSON.stringify(add)})).status,400);
  const started=structuredClone(before);started.tasks[0]=startTimer(started.tasks[0]);assert.equal((await fetch(url,{method:'PUT',body:JSON.stringify(started)})).status,400);
  assert.equal(JSON.parse(await readFile(join(dir,'store.json'),'utf8')).tasks.length,1);
  const second=spawn(process.execPath,['portable-server.mjs'],{env:{...process.env,PORT:'3054',DATA_DIR:dir}});let message='';second.stderr.on('data',c=>message+=c);const code=await new Promise(resolve=>second.once('exit',resolve));assert.notEqual(code,0);assert.match(message,/已有客户端运行/);
  assert.equal((await fetch(url)).status,200);
  const reset=await fetch('http://127.0.0.1:3053/api/reset',{method:'POST',body:JSON.stringify({generation:before.generation,revision:before.revision,mode:'discard'})});assert.equal(reset.status,200);const state=(await reset.json()).state;assert.equal(state.workDate,today);assert.equal(state.tasks.length,0);assert.equal(state.device.id,before.device.id);
 }finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(dir,{recursive:true,force:true})}
});
