import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {normalizeTask, validateTask} from './public/task-model.js';
import {validateTimeState} from './public/time-model.js';
const root=fileURLToPath(new URL('./',import.meta.url));
const dataDir=resolve(process.env.DATA_DIR || join(root,'data'));
const store=join(dataDir,'store.json');
await mkdir(dataDir,{recursive:true});
let state;try{state=JSON.parse(await readFile(store,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;state={categories:['工作','学习','生活'],tasks:[],reviews:[]}}
state.tasks=state.tasks.map(normalizeTask);
state.subtypes ||= [];
let writes=Promise.resolve();
const server=http.createServer(async(req,res)=>{try{
if(req.url==='/api/state'){
if(req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(state))}
if(req.method==='PUT'){
if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end()}
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('数据过大')}
const next=JSON.parse(raw);if(!Array.isArray(next.tasks)||!Array.isArray(next.categories)||!Array.isArray(next.reviews))throw Error('无效数据');
next.tasks=next.tasks.map(t=>validateTask({...normalizeTask(t),progress:t.progress??(t.done?100:0)}));
validateTimeState(next.tasks);
if(next.tasks.filter(t=>t.activeTimer).length>1)throw Error('同时只能为一个事项计时');
next.subtypes ||= [];
if(!next.categories.every(c=>typeof c==='string'&&c.trim()&&c.length<=80)||!Array.isArray(next.subtypes)||!next.subtypes.every(s=>typeof s.name==='string'&&s.name.trim()&&s.name.length<=80&&next.categories.includes(s.category)))throw Error('无效类型');
if(!next.tasks.every(t=>next.categories.includes(t.category)))throw Error('事项主类型不存在');
const write=writes.catch(()=>{}).then(async()=>{await writeFile(store+'.tmp',JSON.stringify(next));await rename(store+'.tmp',store);state=next});writes=write;await write;return res.end('{}')}
res.writeHead(405);return res.end()}
const files={'/':'index.html','/app.js':'app.js','/task-model.js':'task-model.js','/task-view.js':'task-view.js','/style.css':'style.css'};const name=Object.hasOwn(files,req.url)?files[req.url]:null;if(!name){res.writeHead(404);return res.end()}
res.setHeader('Cache-Control','no-store');
res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(root+'public/'+name));
}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}});
server.listen(Number(process.env.PORT)||3030,'127.0.0.1',()=>console.log('Prologue: http://127.0.0.1:'+(process.env.PORT||3030)));
let shuttingDown=false;
function shutdown(){
if(shuttingDown)return;
shuttingDown=true;
server.close(async()=>{try{await writes;process.exit(0)}catch{process.exit(1)}});
setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
