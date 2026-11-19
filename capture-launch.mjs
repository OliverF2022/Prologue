import {readFile,mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
const root=fileURLToPath(new URL('./',import.meta.url)),data=join(root,'capture-data'),fingerprint=createHash('sha256').update(root).digest('hex');
await mkdir(data,{recursive:true});
async function info(port){try{const r=await fetch('http://127.0.0.1:'+port+'/api/info',{signal:AbortSignal.timeout(1000)});const s=await r.json();return s.app==='prologue-capture'&&s.fingerprint===fingerprint}catch{return false}}
let previous;try{previous=JSON.parse(await readFile(join(data,'server.json'),'utf8'))}catch{}
const stop=process.argv.includes('--stop');
let port=previous?.port;
if(!(port&&await info(port))){
 if(stop){console.log('Client is already stopped.');process.exit(0)}
 for(port=3038;port<3090;port++){
  const available=await new Promise(resolve=>{const probe=net.createServer();probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)))});
  if(available)break;
 }
 if(port===3090)throw Error('No available local port in 3038-3089');
 const log=await open(join(data,'client.log'),'a');
 const child=spawn(process.execPath,[join(root,'portable-server.mjs')],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:data},detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});child.unref();await log.close();
 let ready=false;for(let i=0;i<40;i++){if(await info(port)){ready=true;break}await new Promise(r=>setTimeout(r,150))}
 if(!ready)throw Error('Client did not start. Check capture-data/client.log; another copy may already own this data directory.');
}
const url='http://127.0.0.1:'+port+'/';
if(stop){const response=await fetch(url+'api/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Failed to pause and stop client');console.log('Client paused and stopped.');}
else{
 console.log(url);
 if(!process.env.PROLOGUE_NO_BROWSER){
  if(process.platform==='win32')spawn('explorer.exe',[url],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
  else console.log('Open this URL in your browser.');
 }
}
