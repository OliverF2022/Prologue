import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
await mkdir(root+'data',{recursive:true});
let state;try{state=JSON.parse(await readFile(root+'data/store.json','utf8'))}catch{state={categories:['工作','学习','生活'],tasks:[],reviews:[]}}
const server=http.createServer(async(req,res)=>{try{
if(req.url==='/api/state'){
if(req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(state))}
if(req.method==='PUT'){
if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);return res.end()}
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('数据过大')}
const next=JSON.parse(raw);if(!Array.isArray(next.tasks)||!Array.isArray(next.categories)||!Array.isArray(next.reviews))throw Error('无效数据');
await writeFile(root+'data/store.json.tmp',JSON.stringify(next));await rename(root+'data/store.json.tmp',root+'data/store.json');state=next;return res.end('{}')}
res.writeHead(405);return res.end()}
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const name=files[req.url];if(!name){res.writeHead(404);return res.end()}
res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(root+'public/'+name));
}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}});
server.listen(Number(process.env.PORT)||3030,'127.0.0.1',()=>console.log('Prologue: http://127.0.0.1:'+(process.env.PORT||3030)));
