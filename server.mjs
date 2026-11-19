import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {openStore,save,transact} from './storage.mjs';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname} from 'node:path';
import {createDemoState} from './public/demo-data.js';
import {planTaskImport} from './public/transfer-model.js';

const root=fileURLToPath(new URL('./',import.meta.url));
const dataDir=resolve(process.env.DATA_DIR||join(root,'data'));
const main=await openStore(join(dataDir,'store.json'),()=>({categories:['工作','学习','生活'],tasks:[],reviews:[]}));
let demoPromise;
function demoStore(){return demoPromise??=openStore(join(dataDir,'demo','store.json'),createDemoState)}
const files={'/':'index.html','/app.js':'app.js','/task-model.js':'task-model.js','/task-view.js':'task-view.js','/style.css':'style.css','/time-model.js':'time-model.js','/time-analytics.js':'time-analytics.js','/time-charts.js':'time-charts.js','/statistics-view.js':'statistics-view.js','/review-model.js':'review-model.js','/review-view.js':'review-view.js','/state-sync.js':'state-sync.js','/transfer-model.js':'transfer-model.js','/import-view.js':'import-view.js'};
const server=http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    res.setHeader('Cache-Control','no-store');
    if(path==='/downloads/Prologue-Capture-win-x64-1.0.0.zip'){
      try{const bytes=await readFile(join(root,'dist','Prologue-Capture-win-x64-1.0.0.zip'));res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="Prologue-Capture-win-x64-1.0.0.zip"');return res.end(bytes)}
      catch(error){if(error.code!=='ENOENT')throw error;res.writeHead(404);return res.end('Portable package has not been built yet.')}
    }
    if(/^\/api\/(demo\/)?import\/(preview|commit)$/.test(path)){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method!=='POST'){res.writeHead(405);return res.end('{}')}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end('{}')}
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>5000000)throw Error('数据包超过 5 MB')}
      const input=JSON.parse(raw),bucket=path.includes('/demo/')?await demoStore():main;
      if(path.endsWith('/preview')){
        const {state,...preview}=planTaskImport(bucket.state,input.packet,input.choices);
        return res.end(JSON.stringify({...preview,generation:bucket.state.generation,revision:bucket.state.revision}));
      }
      const result=await transact(bucket,{generation:input.generation,revision:input.revision},current=>{
        const plan=planTaskImport(current,input.packet,input.choices);if(!plan.canImport)throw Error('存在未处理的冲突，请调整选择并重新预览');
        return {state:plan.state,changed:plan.changed,counts:plan.counts};
      });return res.end(JSON.stringify(result));
    }
    if(['/api/state','/api/demo/state','/api/demo/reset'].includes(path)){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      const bucket=path==='/api/state'?main:await demoStore();
      if(req.method==='GET'&&path!=='/api/demo/reset')return res.end(JSON.stringify(bucket.state));
      const reset=path==='/api/demo/reset'&&req.method==='POST';
      if((req.method!=='PUT'||path==='/api/demo/reset')&&!reset){res.writeHead(405);return res.end('{}')}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end('{}')}
      if(reset){const next=createDemoState();await save(bucket,next,undefined,undefined,true);return res.end(JSON.stringify(next))}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('数据过大')}
      const next=JSON.parse(raw);
      if(bucket.state.importLog)next.importLog=bucket.state.importLog;
      // Keep demo ownership explicit even when someone edits the JSON payload.
      if(bucket!==main){next.demo=true;next.demoAnchorDate=bucket.state.demoAnchorDate}
      const saved=await save(bucket,next,next.generation,next.revision);return res.end(JSON.stringify(saved));
    }
    const name=Object.hasOwn(files,path)?files[path]:null;
    if(!name){res.writeHead(404);return res.end()}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
    res.end(await readFile(join(root,'public',name)));
  }catch(error){res.writeHead(error.status||400);res.end(JSON.stringify({error:error.message,code:error.code,state:error.state}))}
});
server.listen(Number(process.env.PORT)||3030,'127.0.0.1',()=>console.log('Prologue: http://127.0.0.1:'+(process.env.PORT||3030)));
let shuttingDown=false;
function shutdown(){
  if(shuttingDown)return;shuttingDown=true;
  server.close(async()=>{try{await main.writes;if(demoPromise)await(await demoPromise).writes;process.exit(0)}catch{process.exit(1)}});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
