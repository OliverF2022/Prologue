import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('HTTP serves workspace and persists API state',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'prologue-test-'));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3039',DATA_DIR:dataDir}});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
 const r=await fetch('http://127.0.0.1:3039/');assert.equal(r.status,200);assert.match(await r.text(),/Prologue/);
 const state=await fetch('http://127.0.0.1:3039/api/state').then(r=>r.json());assert.ok(Array.isArray(state.tasks));
 const blocked=await fetch('http://127.0.0.1:3039/api/state',{method:'PUT',headers:{Origin:'http://evil.test'},body:JSON.stringify(state)});assert.equal(blocked.status,403);
 state.subtypes=[{category:'工作',name:'开发'}];
 state.tasks.push({id:'roundtrip',title:'阶段交付',category:'工作',subtype:'开发',kind:'task',date:'2026-10-28',started:'2026-10-29',done:'2026-11-05',minutes:200,progress:100,milestone:true,milestoneNote:'首次发布'});
 const saved=await fetch('http://127.0.0.1:3039/api/state',{method:'PUT',body:JSON.stringify(state)});assert.equal(saved.status,200);
 assert.deepEqual(await fetch('http://127.0.0.1:3039/api/state').then(r=>r.json()),state);
 assert.deepEqual(JSON.parse(await readFile(join(dataDir,'store.json'),'utf8')),state);
 const invalid=structuredClone(state);invalid.tasks[0].started='2026-11-06';
 assert.equal((await fetch('http://127.0.0.1:3039/api/state',{method:'PUT',body:JSON.stringify(invalid)})).status,400);
 assert.deepEqual(await fetch('http://127.0.0.1:3039/api/state').then(r=>r.json()),state);
 assert.match(await fetch('http://127.0.0.1:3039/task-model.js').then(r=>r.text()),/taskFromFields/);
 assert.equal((await fetch('http://127.0.0.1:3039/unknown')).status,404);
 }finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;await rm(dataDir,{recursive:true,force:true})}
});
