import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeTask,validateTask} from './public/task-model.js';
import {validateTimeState} from './public/time-model.js';
export async function openStore(file,initial){
  await mkdir(dirname(file),{recursive:true});
  let state;
  try{state=JSON.parse(await readFile(file,'utf8'))}
  catch(error){if(error.code!=='ENOENT')throw error;state=initial()}
  state.tasks=state.tasks.map(normalizeTask);state.subtypes||=[];state.generation||=randomUUID();
  state.revision=Number.isSafeInteger(state.revision)&&state.revision>=0?state.revision:0;
  return {file,state,writes:Promise.resolve()};
}
export function validateState(next){
  if(!Array.isArray(next.tasks)||!Array.isArray(next.categories)||!Array.isArray(next.reviews))throw Error('无效数据');
  next.tasks=next.tasks.map(t=>validateTask({...normalizeTask(t),progress:t.progress??(t.done?100:0)}));
  if(next.tasks.filter(t=>t.activeTimer).length>1)throw Error('同时只能为一个事项计时');
  validateTimeState(next.tasks);
  next.subtypes||=[];
  if(!next.categories.every(c=>typeof c==='string'&&c.trim()&&c.length<=80)||!Array.isArray(next.subtypes)||!next.subtypes.every(s=>typeof s.name==='string'&&s.name.trim()&&s.name.length<=80&&next.categories.includes(s.category)))throw Error('无效类型');
  if(!next.tasks.every(t=>next.categories.includes(t.category)))throw Error('事项主类型不存在');
}

async function archive(bucket,state,kind){
 const folder=join(dirname(bucket.file),'history');await mkdir(folder,{recursive:true});
 await writeFile(join(folder,kind+'-'+Date.now()+'-'+randomUUID()+'.json'),JSON.stringify(state));
}
export function transact(bucket,{generation,revision,reset=false,submitted},action){
 const work=bucket.writes.catch(()=>{}).then(async()=>{
  let error;
  if(!reset&&generation!==bucket.state.generation){error=Error('数据已重新初始化，请刷新页面后再操作');error.code='GENERATION_CONFLICT';}
  else if(!reset&&(!Number.isSafeInteger(revision)||revision!==bucket.state.revision)){
   error=Error(Number.isSafeInteger(revision)?'其他页面已更新记录，请重新预览或合并后保存':'页面版本过旧，提交内容已留存，请刷新页面后操作');
   error.code=Number.isSafeInteger(revision)?'REVISION_CONFLICT':'CLIENT_UPGRADE_REQUIRED';
  }
  if(error){if(submitted)await archive(bucket,submitted,'rejected-write');error.status=409;error.state=bucket.state;throw error;}
  const result=await action(structuredClone(bucket.state));
  if(result.changed===false)return {...result,state:structuredClone(bucket.state)};
  const next=result.state;validateState(next);await archive(bucket,bucket.state,'before-write');
  next.revision=bucket.state.revision+1;
  await writeFile(bucket.file+'.tmp',JSON.stringify(next));await rename(bucket.file+'.tmp',bucket.file);bucket.state=next;
  return {...result,state:structuredClone(next)};
 });bucket.writes=work;return work;
}
export async function save(bucket,next,generation,revision,reset=false){
 return (await transact(bucket,{generation,revision,reset,submitted:next},()=>({state:next}))).state;
}
