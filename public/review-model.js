import {localDay,periodBounds} from './task-model.js';
import {timeReport,periodOutcomes} from './time-analytics.js';

export const reviewLabels={week:'周',month:'月',year:'年'};
export const activeReviews=reviews=>reviews.filter(r=>!r.deletedAt);
export function reviewDate(kind,date){
  if(!Object.hasOwn(reviewLabels,kind)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||localDay(date+'T12:00:00')!==date)throw Error('请选择有效的复盘周期和日期');
  return periodBounds(kind,date)[0];
}
export function findReview(reviews,kind,date){
  const start=reviewDate(kind,date);
  return activeReviews(reviews).find(r=>r.kind===kind&&reviewDate(r.kind,r.date)===start);
}
export function reviewDraft(kind,date,previous){
  const start=reviewDate(kind,date);
  return previous?.kind===kind&&previous.date===start?previous:{kind,date:start,text:'',key:false,color:'#65745d'};
}
export function reviewStatus(review,start,today=localDay()){
  if(start>today)return 'future';
  if(review?.key)return 'key';
  return review?.text?.trim()?'written':'empty';
}
export function queryReviews(reviews,{kind='',date='',keyword='',status='',trash=false}={}){
  const needle=keyword.trim().toLocaleLowerCase();
  return reviews.filter(r=>Boolean(r.deletedAt)===Boolean(trash)&&(!kind||r.kind===kind)
    &&(!date||reviewDate(r.kind,r.date)===reviewDate(r.kind,date))
    &&(!needle||`${r.date} ${reviewLabels[r.kind]}复盘 ${r.text||''}`.toLocaleLowerCase().includes(needle))
    &&(!status||(status==='key'?r.key:status==='written'?r.text?.trim():!r.text?.trim())))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.kind.localeCompare(b.kind));
}
export function createReview(state,draft,id=crypto.randomUUID()){
  const date=reviewDate(draft.kind,draft.date);
  if(findReview(state.reviews,draft.kind,date))throw Error('该周期已有复盘，请打开现有记录');
  const review={id,kind:draft.kind,date,text:String(draft.text||''),key:draft.kind==='week'&&Boolean(draft.key),color:draft.color||'#65745d'};
  return {...state,reviews:[...state.reviews,review]};
}
export function trashReview(state,id,now=new Date()){
  if(!activeReviews(state.reviews).some(r=>r.id===id))throw Error('复盘不存在或已删除');
  return {...state,reviews:state.reviews.map(r=>r.id===id?{...r,deletedAt:new Date(now).toISOString()}:r)};
}
export function restoreReview(state,id){
  const record=state.reviews.find(r=>r.id===id&&r.deletedAt);
  if(!record)throw Error('回收站中没有此复盘');
  if(findReview(state.reviews,record.kind,record.date))throw Error('该周期已有复盘，请先处理现有记录后再恢复');
  return {...state,reviews:state.reviews.map(r=>{if(r.id!==id)return r;const {deletedAt,...rest}=r;return rest})};
}
export function reviewWeeks(state,year,today=localDay(),now=new Date()){
  const first=reviewDate('week',`${year}-01-01`),end=`${Number(year)+1}-01-01`,weeks=[];
  for(const day=new Date(first+'T12:00:00');localDay(day)<end;day.setDate(day.getDate()+7)){
    const start=localDay(day),[a,b]=periodBounds('week',start),last=new Date(b+'T12:00:00');last.setDate(last.getDate()-1);
    const review=findReview(state.reviews,'week',start),future=start>today;
    const report=future?{total:0,tasks:[]}:timeReport(state.tasks,'week',start,now),out=future?{completed:[],checkins:0,milestones:[],interruptions:[]}:periodOutcomes(state.tasks,'week',start);
    weeks.push({start:a,end:localDay(last),month:start.slice(0,4)===String(year)?Number(start.slice(5,7)):1,review,
      status:reviewStatus(review,start,today),seconds:report.total,taskCount:report.tasks.length,
      completed:out.completed.length,checkins:out.checkins,milestones:out.milestones.length,interruptions:out.interruptions.length});
  }
  return weeks;
}
