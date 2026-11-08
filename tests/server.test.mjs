import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('HTTP serves workspace and persists API state',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3039'}});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
 const r=await fetch('http://127.0.0.1:3039/');assert.equal(r.status,200);assert.match(await r.text(),/Prologue/);
 const state=await fetch('http://127.0.0.1:3039/api/state').then(r=>r.json());assert.ok(Array.isArray(state.tasks));
 const blocked=await fetch('http://127.0.0.1:3039/api/state',{method:'PUT',headers:{Origin:'http://evil.test'},body:JSON.stringify(state)});assert.equal(blocked.status,403);
 const saved=await fetch('http://127.0.0.1:3039/api/state',{method:'PUT',body:JSON.stringify(state)});assert.equal(saved.status,200);
 assert.deepEqual(await fetch('http://127.0.0.1:3039/api/state').then(r=>r.json()),state);
 assert.equal((await fetch('http://127.0.0.1:3039/unknown')).status,404);
 }finally{child.kill()}
});
