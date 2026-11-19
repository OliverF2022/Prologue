import http from 'node:http';
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {openStore,transact} from './storage.mjs';
import {localDay,stopTimer} from './public/task-model.js';
import {makeTaskPackage} from './public/transfer-model.js';

const root=fileURLToPath(new URL('./',import.meta.url)),data=resolve(process.env.DATA_DIR||join(root,'capture-data'));
await mkdir(data,{recursive:true});
const lockPath=join(data,'capture.lock');
try{const lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));await lock.close();}
catch(error){
 if(error.code!=='EEXIST')throw error;
 const pid=Number(await readFile(lockPath,'utf8'));let live=false;
 try{process.kill(pid,0);live=true}catch(e){if(e.code!=='ESRCH')live=true}
 if(live)throw Error('此数据目录已有客户端运行，请使用原窗口');
 await unlink(lockPath);const lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));await lock.close();
}
function blank(device){return {generation:randomUUID(),workspaceId:randomUUID(),workDate:localDay(),device:device||{id:randomUUID(),name:'便携客户端',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone},categories:['工作','学习','生活'],subtypes:[],tasks:[],reviews:[]}}
const store=await openStore(join(data,'store.json'),()=>blank());
const fingerprint=createHash('sha256').update(root).digest('hex');
function stamp(next,current){
 next.device=current.device;next.workspaceId=current.workspaceId;next.workDate=current.workDate;next.reviews=[];
 for(const task of next.tasks){
  if(task.date!==current.workDate||task.started!==current.workDate)throw Error('事项必须属于当前工作日，请重置后创建新一天事项');
  const previous=current.tasks.find(t=>t.id===task.id);
  if(current.workDate!==localDay()&&(!previous||task.activeTimer&&task.activeTimer!==previous.activeTimer))throw Error('当前为前一日记录，请先导出并重置，再创建或开始今天的事项');
  task.transferVersion=previous?.transferVersion||0;
  if(!previous||!isDeepStrictEqual(task,previous))task.transferVersion++;
 }
 return next;
}
async function exportSnapshot(current,now){
 const settled=stamp({...structuredClone(current),tasks:current.tasks.map(t=>stopTimer(t,now))},current);
 const packet=makeTaskPackage(settled,now),folder=join(data,'exports');await mkdir(folder,{recursive:true});
 const file=join(folder,packet.packageId+'.prologue.json');await writeFile(file+'.tmp',JSON.stringify(packet,null,2));
 const {rename}=await import('node:fs/promises');await rename(file+'.tmp',file);
 return {settled,packet,fileName:packet.packageId+'.prologue.json'};
}
const files={'/':'portable.html','/portable-app.js':'portable-app.js','/style.css':'style.css','/portable.css':'portable.css','/task-model.js':'task-model.js','/task-view.js':'task-view.js','/time-model.js':'time-model.js','/time-analytics.js':'time-analytics.js','/time-charts.js':'time-charts.js','/state-sync.js':'state-sync.js','/transfer-model.js':'transfer-model.js'};
const server=http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1').pathname;res.setHeader('Cache-Control','no-store');
  if(path.startsWith('/api/')){
   res.setHeader('Content-Type','application/json; charset=utf-8');
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end('{}')}
   if(req.method==='GET'&&path==='/api/info')return res.end(JSON.stringify({app:'prologue-capture',fingerprint,deviceId:store.state.device.id}));
   if(req.method==='GET'&&path==='/api/state')return res.end(JSON.stringify(store.state));
   if(req.method==='GET'&&/^\/api\/exports\/[a-f0-9-]{36}\.prologue\.json$/.test(path)){
    const file=path.split('/').at(-1),bytes=await readFile(join(data,'exports',file)),packet=JSON.parse(bytes);
    res.setHeader('Content-Disposition',`attachment; filename="Prologue-${packet.workDate}-${file}"`);return res.end(bytes);
   }
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>5000000)throw Error('记录过大')}
   const input=JSON.parse(raw||'{}');
   if(req.method==='PUT'&&path==='/api/state'){
    const result=await transact(store,{generation:input.generation,revision:input.revision,submitted:input},current=>({state:stamp(input,current)}));return res.end(JSON.stringify(result.state));
   }
   if(req.method==='POST'&&['/api/export','/api/reset'].includes(path)){
    if(path==='/api/reset'&&!['export','discard'].includes(input.mode))throw Error('请选择导出并重置或直接重置');
    const result=await transact(store,{generation:input.generation,revision:input.revision},async current=>{
     const now=new Date();let exported;
     if(path==='/api/export'||input.mode==='export')exported=await exportSnapshot(current,now);
     else{
      const folder=join(data,'reset-backups');await mkdir(folder,{recursive:true});
      await writeFile(join(folder,randomUUID()+'.json'),JSON.stringify({resetAt:now.toISOString(),state:{...current,tasks:current.tasks.map(t=>stopTimer(t,now))}}));
     }
     if(path==='/api/export')return {state:exported.settled,fileName:exported.fileName};
     return {state:{...blank(current.device),categories:current.categories,subtypes:current.subtypes},fileName:exported?.fileName};
    });return res.end(JSON.stringify(result));
   }
   if(req.method==='POST'&&path==='/api/shutdown'){
    await transact(store,{reset:true},current=>({state:stamp({...current,tasks:current.tasks.map(t=>stopTimer(t))},current)}));
    res.end('{}');setTimeout(shutdown,100);return;
   }
   res.writeHead(404);return res.end('{}');
  }
  const file=files[path];if(!file){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(join(root,'public',file)));
 }catch(error){res.writeHead(error.status||400);res.end(JSON.stringify({error:error.message,code:error.code,state:error.state}))}
});
const port=Number(process.env.PORT)||3038;
server.listen(port,'127.0.0.1',async()=>{await writeFile(join(data,'server.json'),JSON.stringify({port,fingerprint}));console.log('Prologue Capture: http://127.0.0.1:'+port)});
let closing=false;
function shutdown(){if(closing)return;closing=true;server.close(async()=>{await store.writes.catch(()=>{});await unlink(lockPath).catch(()=>{});process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
