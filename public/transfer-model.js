import {normalizeTask,validateTask,updateTotal,isDate,localDay} from './task-model.js';
import {validateTimeState,timestampValid} from './time-model.js';

const fields=['id','title','category','subtype','kind','date','started','done','progress','previousProgress','milestone','milestoneNote','status','interruptions','sessions','untimedEntries','activeTimer','transferVersion'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>structuredClone(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
function cleanTask(task){const result={};for(const field of fields)if(task[field]!==undefined)result[field]=clone(task[field]);return validateTask(normalizeTask(result));}
export function makeTaskPackage(state,now=new Date(),packageId=crypto.randomUUID()){
  if(state.tasks.some(t=>t.activeTimer))throw Error('请先暂停计时再导出');
  const packet={format:'prologue.tasks',version:1,packageId,exportedAt:now.toISOString(),device:clone(state.device),workspaceId:state.workspaceId,workDate:state.workDate,
    categories:clone(state.categories),subtypes:clone(state.subtypes||[]),tasks:state.tasks.map(cleanTask)};
  validateTaskPackage(packet,now);return packet;
}
export function validateTaskPackage(packet,now=new Date()){
  if(!packet||packet.format!=='prologue.tasks'||packet.version!==1||!id(packet.packageId)||!id(packet.workspaceId)||!isDate(packet.workDate)
      ||!timestampValid(packet.exportedAt)||Date.parse(packet.exportedAt)>new Date(now).getTime())throw Error('不是有效的 Prologue 事项数据包，或导出时间晚于当前时间');
  if(!packet.device||!id(packet.device.id)||typeof packet.device.name!=='string'||!packet.device.name.trim()||packet.device.name.length>80||typeof packet.device.timeZone!=='string')throw Error('数据包的设备信息无效');
  try{new Intl.DateTimeFormat('en',{timeZone:packet.device.timeZone})}catch{throw Error('设备时区无效')}
  const sourceToday=new Intl.DateTimeFormat('sv-SE',{timeZone:packet.device.timeZone}).format(now);
  if(packet.workDate>sourceToday)throw Error('工作日不能晚于来源设备的今天');
  if(!Array.isArray(packet.tasks)||packet.tasks.length>5000||!Array.isArray(packet.categories)||packet.categories.length>200||!Array.isArray(packet.subtypes))throw Error('事项或类型数量无效');
  const categories=new Set(packet.categories);
  if(categories.size!==packet.categories.length||!packet.categories.every(c=>typeof c==='string'&&c.trim()&&c.length<=80)
    ||!packet.subtypes.every(s=>s&&categories.has(s.category)&&typeof s.name==='string'&&s.name.trim()&&s.name.length<=80))throw Error('主类型或子类型无效');
  const tasks=packet.tasks.map(t=>{
    if(!t||!id(t.id)||!Number.isSafeInteger(t.transferVersion)||t.transferVersion<1||t.activeTimer||t.date!==packet.workDate||t.started!==packet.workDate||!categories.has(t.category)
      ||t.done&&t.done>sourceToday||(t.untimedEntries||[]).some(e=>e.date>sourceToday||e.seconds>86400))throw Error('事项归属、版本、未来日期或计时状态无效');
    return cleanTask(t);
  });
  validateTimeState(tasks,now);
  return {...packet,categories:[...categories],subtypes:clone(packet.subtypes),tasks};
}
function importedTask(source,packet){
  const prefix='cap-'+packet.device.id+'-'+packet.workspaceId+'-';
  const task=clone(source);task.id=prefix+source.id;
  task.sessions=task.sessions.map(s=>({...s,id:prefix+s.id}));
  // Reports use this computer's timezone; preserve source dates in provenance.
  task.started=[task.started,...task.sessions.map(s=>localDay(s.start))].sort()[0];
  if(task.done)task.done=[task.done,...task.sessions.map(s=>localDay(Date.parse(s.end)-1))].sort().at(-1);
  task.rollover=false;task.capture={deviceId:packet.device.id,deviceName:packet.device.name,workspaceId:packet.workspaceId,workDate:packet.workDate,timeZone:packet.device.timeZone,sourceTaskId:source.id};
  delete task.transferVersion;return validateTask(updateTotal(task));
}
function mergeArray(base,local,incoming,key){
  const b=new Map(base.map(x=>[key(x),x])),l=new Map(local.map(x=>[key(x),x])),r=new Map(incoming.map(x=>[key(x),x])),out=[];
  for(const k of new Set([...l.keys(),...r.keys(),...b.keys()])){
    const before=b.get(k),mine=l.get(k),theirs=r.get(k);let value;
    if(same(theirs,before))value=mine;
    else if(same(mine,before)||same(mine,theirs))value=theirs;
    else throw Error('同一时间段或记录已在主程序修改，请先核对，或跳过此事项');
    if(value!==undefined)out.push(clone(value));
  }return out;
}
function mergeTask(base,current,incoming,mapped){
  const next=clone(current);
  next.sessions=mergeArray(base.sessions,current.sessions,incoming.sessions,s=>s.id);
  if(!mapped){
    next.interruptions=mergeArray(base.interruptions,current.interruptions,incoming.interruptions,r=>r.at);
    next.untimedEntries=mergeArray(base.untimedEntries,current.untimedEntries,incoming.untimedEntries,r=>r.date);
    for(const key of ['title','category','subtype','kind','date','started','done','progress','previousProgress','milestone','milestoneNote','status']){
      if(same(incoming[key],base[key]))continue;
      if(!same(current[key],base[key])&&!same(current[key],incoming[key]))throw Error('主程序和客户端都修改了'+key+'，请先核对，或跳过此事项');
      if(incoming[key]===undefined)delete next[key];else next[key]=clone(incoming[key]);
    }
  }
  return validateTask(updateTotal(next));
}
export function planTaskImport(state,input,choices={},now=new Date()){
  const packet=validateTaskPackage(input,now),next=clone(state),rows=[];
  next.importLog||=[];const receipts=new Map(next.importLog.map(r=>[r.key,r]));
  for(const source of packet.tasks){
    const key=packet.device.id+'/'+packet.workspaceId+'/'+source.id,prior=receipts.get(key),choice=Object.hasOwn(choices,key)?choices[key]:{};
    const row={key,title:source.title,category:source.category,sourceId:source.id,lockedTarget:Boolean(prior),seconds:source.timeEntries.reduce((s,e)=>s+e.seconds,0)};
    if(choice?.skip){rows.push({...row,status:'skipped',message:'已选择跳过'});continue;}
    const fingerprint=JSON.stringify(source),incoming=importedTask(source,packet);
    if(prior&&source.transferVersion<=prior.version){
      rows.push({...row,status:source.transferVersion===prior.version&&fingerprint!==prior.fingerprint?'conflict':'duplicate',message:source.transferVersion===prior.version&&fingerprint!==prior.fingerprint?'同一版本的数据内容不同，请核对文件':'已导入此版本或更新版本，不重复累计'});continue;
    }
    const targetId=prior?.taskId||choice?.targetId||incoming.id,mapped=prior?.mapped??Boolean(choice?.targetId);
    const current=next.tasks.find(t=>t.id===targetId);
    if(prior&&!current){rows.push({...row,status:'skipped',message:'该事项已在主程序删除，不自动恢复'});continue;}
    try{
      if(!prior&&!mapped&&current)throw Error('事项 ID 与现有记录冲突');
      if(mapped&&!current)throw Error('选择的主程序事项不存在');
      const base=prior?.base||{...incoming,sessions:[],interruptions:[],untimedEntries:[]};
      const candidate=current?mergeTask(base,current,{...incoming,id:targetId},mapped):incoming;
      const tasks=next.tasks.filter(t=>t.id!==targetId).concat(candidate);validateTimeState(tasks,now);
      if(tasks.filter(t=>t.activeTimer).length>1)throw Error('同时只能有一个计时事项');
      next.tasks=tasks;
      for(const category of packet.categories)if(!next.categories.includes(category))next.categories.push(category);
      next.subtypes||=[];for(const s of packet.subtypes)if(!next.subtypes.some(x=>x.category===s.category&&x.name===s.name))next.subtypes.push(clone(s));
      if(source.subtype&&!next.subtypes.some(s=>s.category===source.category&&s.name===source.subtype))next.subtypes.push({category:source.category,name:source.subtype});
      const receipt={key,taskId:targetId,version:source.transferVersion,fingerprint,base:{...incoming,id:targetId},mapped,packageId:packet.packageId,importedAt:now.toISOString()};
      next.importLog=next.importLog.filter(r=>r.key!==key).concat(receipt);receipts.set(key,receipt);
      rows.push({...row,status:prior?'updated':mapped?'merged':'added',targetId,message:prior?'更新客户端修改，保留独立的主程序修改':mapped?'追加时段到已选事项，保留主程序进度和完成状态':'作为当日历史事项导入，不顺延'});
    }catch(error){rows.push({...row,status:'conflict',message:error.message});}
  }
  const counts=Object.fromEntries(['added','updated','merged','duplicate','skipped','conflict'].map(k=>[k,rows.filter(r=>r.status===k).length]));
  return {state:next,rows,counts,canImport:!counts.conflict,changed:counts.added+counts.updated+counts.merged>0,device:packet.device,workDate:packet.workDate,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
