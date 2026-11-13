import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeTask,validateTask} from './public/task-model.js';
import {validateTimeState} from './public/time-model.js';
import {createDemoState} from './public/demo-data.js';

const root=fileURLToPath(new URL('./',import.meta.url));
const dataDir=resolve(process.env.DATA_DIR||join(root,'data'));
async function openStore(file,initial){
  await mkdir(dirname(file),{recursive:true});
  let state;
  try{state=JSON.parse(await readFile(file,'utf8'))}
  catch(error){if(error.code!=='ENOENT')throw error;state=initial()}
  state.tasks=state.tasks.map(normalizeTask);state.subtypes||=[];state.generation||=randomUUID();
  return {file,state,writes:Promise.resolve()};
}
const main=await openStore(join(dataDir,'store.json'),()=>({categories:['工作','学习','生活'],tasks:[],reviews:[]}));
let demoPromise;
function demoStore(){return demoPromise??=openStore(join(dataDir,'demo','store.json'),createDemoState)}
function validateState(next){
  if(!Array.isArray(next.tasks)||!Array.isArray(next.categories)||!Array.isArray(next.reviews))throw Error('无效数据');
  next.tasks=next.tasks.map(t=>validateTask({...normalizeTask(t),progress:t.progress??(t.done?100:0)}));
  validateTimeState(next.tasks);
  if(next.tasks.filter(t=>t.activeTimer).length>1)throw Error('同时只能为一个事项计时');
  next.subtypes||=[];
  if(!next.categories.every(c=>typeof c==='string'&&c.trim()&&c.length<=80)||!Array.isArray(next.subtypes)||!next.subtypes.every(s=>typeof s.name==='string'&&s.name.trim()&&s.name.length<=80&&next.categories.includes(s.category)))throw Error('无效类型');
  if(!next.tasks.every(t=>next.categories.includes(t.category)))throw Error('事项主类型不存在');
}
function save(bucket,next,expectedGeneration){
  const write=bucket.writes.catch(()=>{}).then(async()=>{
    if(expectedGeneration!==undefined&&expectedGeneration!==bucket.state.generation){
      const error=Error('数据已重新初始化，请刷新页面后再操作');error.status=409;throw error;
    }
    await writeFile(bucket.file+'.tmp',JSON.stringify(next));await rename(bucket.file+'.tmp',bucket.file);bucket.state=next;
  });
  bucket.writes=write;return write;
}
const files={'/':'index.html','/app.js':'app.js','/task-model.js':'task-model.js','/task-view.js':'task-view.js','/style.css':'style.css','/time-model.js':'time-model.js','/time-analytics.js':'time-analytics.js','/time-charts.js':'time-charts.js'};
const server=http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    res.setHeader('Cache-Control','no-store');
    if(['/api/state','/api/demo/state','/api/demo/reset'].includes(path)){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      const bucket=path==='/api/state'?main:await demoStore();
      if(req.method==='GET'&&path!=='/api/demo/reset')return res.end(JSON.stringify(bucket.state));
      const reset=path==='/api/demo/reset'&&req.method==='POST';
      if((req.method!=='PUT'||path==='/api/demo/reset')&&!reset){res.writeHead(405);return res.end('{}')}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end('{}')}
      if(reset){const next=createDemoState();await save(bucket,next);return res.end(JSON.stringify(next))}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('数据过大')}
      const next=JSON.parse(raw);
      if(next.generation!==bucket.state.generation){res.writeHead(409);return res.end(JSON.stringify({error:'数据已重新初始化，请刷新页面后再操作'}))}
      validateState(next);
      // Keep demo ownership explicit even when someone edits the JSON payload.
      if(bucket!==main){next.demo=true;next.demoAnchorDate=bucket.state.demoAnchorDate}
      await save(bucket,next,next.generation);return res.end('{}');
    }
    const name=Object.hasOwn(files,path)?files[path]:null;
    if(!name){res.writeHead(404);return res.end()}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
    res.end(await readFile(join(root,'public',name)));
  }catch(error){res.writeHead(error.status||400);res.end(JSON.stringify({error:error.message}))}
});
server.listen(Number(process.env.PORT)||3030,'127.0.0.1',()=>console.log('Prologue: http://127.0.0.1:'+(process.env.PORT||3030)));
let shuttingDown=false;
function shutdown(){
  if(shuttingDown)return;shuttingDown=true;
  server.close(async()=>{try{await main.writes;if(demoPromise)await(await demoPromise).writes;process.exit(0)}catch{process.exit(1)}});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
