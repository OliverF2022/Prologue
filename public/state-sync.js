// Three-way merge: unchanged records follow the server; independent records combine.
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>structuredClone(value);
export class StateConflict extends Error {
  constructor(message,code='STATE_CONFLICT'){super(message);this.code=code;}
}
function mergeRecords(base,local,remote,key,label){
  const b=new Map(base.map(x=>[key(x),x])),l=new Map(local.map(x=>[key(x),x])),r=new Map(remote.map(x=>[key(x),x]));
  const result=[];
  for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){
    const before=b.get(id),mine=l.get(id),theirs=r.get(id);
    let value;
    if(same(mine,before))value=theirs;
    else if(same(theirs,before)||same(mine,theirs))value=mine;
    else throw new StateConflict(`另一标签页也修改了同一${label}，本页修改已保留，请先核对最新记录`);
    if(value!==undefined)result.push(clone(value));
  }
  return result;
}
export function mergeState(base,local,remote){
  if(base.generation!==remote.generation||local.generation!==remote.generation)
    throw new StateConflict('记录已重新初始化，本页修改已保留，请载入最新数据','GENERATION_CONFLICT');
  return {...clone(remote),
    tasks:mergeRecords(base.tasks,local.tasks,remote.tasks,x=>x.id,'事项'),
    reviews:mergeRecords(base.reviews,local.reviews,remote.reviews,x=>x.id,'复盘'),
    categories:mergeRecords(base.categories,local.categories,remote.categories,x=>x,'类型'),
    subtypes:mergeRecords(base.subtypes||[],local.subtypes||[],remote.subtypes||[],x=>JSON.stringify([x.category,x.name]),'子类型')};
}

export function createStateClient(initial,{url,fetcher=fetch,onState=()=>{},onConflict=()=>{},onSaved=()=>{}}){
  let confirmed=clone(initial),projected=clone(initial),tail=Promise.resolve(),pending=0,blocked=!Number.isSafeInteger(initial.revision),refreshSequence=0;
  async function latest(){const response=await fetcher(url);if(!response.ok)throw Error('读取最新记录失败，请重试');return response.json();}
  function save(next){
    if(blocked){
      projected=clone(next);const error=new StateConflict('本页版本过旧或存在保存冲突，修改已保留，请先核对并载入最新数据');
      onConflict(error,{base:clone(confirmed),local:clone(projected)});return Promise.reject(error);
    }
    const base=clone(projected),desired=clone(next);projected=clone(desired);pending++;refreshSequence++;
    const request=tail.then(async()=>{
      let candidate=mergeState(base,desired,confirmed);
      for(let attempt=0;attempt<5;attempt++){
        candidate.revision=confirmed.revision;
        const response=await fetcher(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(candidate)});
        const result=await response.json().catch(()=>({}));
        if(response.ok){
          confirmed=clone(result);
          // Preserve newer queued local edits while adding remote records to the UI.
          projected=mergeState(desired,projected,confirmed);
          onState(clone(projected));onSaved(confirmed.revision);return clone(projected);
        }
        if(response.status===409&&result.code==='REVISION_CONFLICT'){
          const remote=result.state||await latest();
          candidate=mergeState(confirmed,candidate,remote);confirmed=clone(remote);continue;
        }
        throw new StateConflict(result.error||'保存失败，请重试',result.code||'SAVE_FAILED');
      }
      throw new StateConflict('其他标签页持续更新，本页修改已保留，请稍后核对重试');
    }).catch(error=>{
      blocked=true;onConflict(error,{base:clone(confirmed),local:clone(projected)});throw error;
    }).finally(()=>{pending--});
    // A failed write blocks later queued snapshots; they must never overwrite it.
    tail=request;tail.catch(()=>{});return request;
  }
  async function refresh(accept=()=>true){
    if(pending||blocked||!accept())return false;
    const sequence=++refreshSequence,current=await latest();
    if(sequence!==refreshSequence||pending||blocked||!accept())return false;
    if(current.generation===confirmed.generation&&current.revision<confirmed.revision)return false;
    if(current.generation===confirmed.generation&&current.revision===confirmed.revision)return false;
    confirmed=clone(current);projected=clone(current);onState(clone(current));return true;
  }
  return {save,refresh,get pending(){return pending},get blocked(){return blocked},get snapshot(){return clone(confirmed)}};
}
