import {createStateClient} from './state-sync.js';
import {taskFromFields,normalizeTask,localDay,formatElapsed,totalSeconds,startTimer,stopTimer,completeTask,reopenTask,interruptTask,resumeTask,rememberSubtype,updateTotal,validateTask} from './task-model.js';
import {editSession} from './time-model.js';
import {esc,taskCard,subtypeOptions,sessionDialog,completionDialog,interruptionDialog,hourOptions} from './task-view.js';
const $=s=>document.querySelector(s);
let state=await fetch('/api/state').then(r=>r.json()),filter='all',busy=false,lastExport=null,recovery=null,renderedDay=localDay();
const channel=new BroadcastChannel('prologue-capture');
function makeClient(){return createStateClient(state,{url:'/api/state',onState:s=>{state=s},onSaved:()=>channel.postMessage('updated'),onConflict:(error,backup)=>{recovery=backup;$('#capture-recovery').hidden=false;$('#error').textContent=error.message;try{localStorage.setItem('capture-recovery-'+crypto.randomUUID(),JSON.stringify(backup))}catch{}}});}
let client=makeClient();
function render(){
 renderedDay=localDay();
 const today=localDay(),old=state.workDate!==today,visible=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 $('#capture-app').innerHTML=`<div class="capture-heading"><div><h2>当日记录 <span class="capture-count">${state.workDate}</span></h2><p class="capture-device">${esc(state.device.name)} · 本地自动保存</p></div><div class="capture-tools"><button id="capture-export" class="primary">暂停并导出</button><button id="capture-reset">重置 / 开始新一天</button><button id="capture-exit">暂停并退出</button></div></div>
 ${old?'<p class="capture-day-warning">当前仍是 '+state.workDate+' 的记录。未完成事项不会顺延；请导出并手动重置，开始今天的新事项。仍可修改原记录、暂停计时。</p>':''}
 ${lastExport?`<div class="capture-exports" role="status">导出已保存到本地文件夹。<a href="/api/exports/${lastExport}" download>下载导出数据包</a>，回到主程序的“数据导入”页面选择此文件。</div>`:''}
 <div class="metrics"><article><small>本日事项</small><strong>${state.tasks.length}</strong><span>已完成 ${state.tasks.filter(t=>t.done).length} 项</span></article><article><small>累计记录用时</small><strong id="capture-total">${formatElapsed(state.tasks.reduce((s,t)=>s+totalSeconds(t),0))}</strong><span>计时与手动补记累计</span></article><article><small>事项模式</small><strong style="font-size:22px">每日独立</strong><span>手动重置，不自动清空或顺延</span></article></div>
 <section><h3>添加事项</h3><form id="capture-task-form" class="entry-form"><label class="wide">事项名称<input name="title" required maxlength="200" placeholder="记录这一天的事项"></label><label>主类型<select name="category">${state.categories.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>子类型<input name="subtype" list="capture-subtypes" maxlength="80" placeholder="选择或输入子类型"><datalist id="capture-subtypes" data-subtype-options>${subtypeOptions(state,state.categories[0])}</datalist></label><label>事项类型<select name="kind"><option value="task">普通任务</option><option value="habit">打卡事项</option></select></label><p class="form-error wide" role="alert"></p><div class="wide"><button class="primary" ${old?'disabled':''}>添加事项</button></div></form>
 <details class="category-manager"><summary>管理主类型 / 子类型</summary><form id="capture-category-form"><label>主类型名称<input name="name" required maxlength="80"></label><button>添加主类型</button></form><form id="capture-subtype-form"><label>所属类型<select name="category">${state.categories.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>子类型名称<input name="name" required maxlength="80"></label><button>添加子类型</button></form></details></section>
 <div class="capture-tab"><button data-filter="all" class="${filter==='all'?'active':''}">全部</button><button data-filter="active" class="${filter==='active'?'active':''}">未完成</button><button data-filter="done" class="${filter==='done'?'active':''}">已完成</button></div>
 ${visible.map(t=>taskCard(t,state,today)).join('')||'<section class="empty-state">还没有事项。每次重置后，可在这里开始新一天的记录。</section>'}${hourOptions}`;
}
function error(e,form){const target=form?.querySelector('.form-error')||$('#error');target.textContent=e.message||'操作失败';}
async function save(next){if(busy)throw Error('正在保存，请稍后');busy=true;try{state=await client.save(next);$('#error').textContent='';render();}finally{busy=false}}
function editing(){return document.querySelector('form[data-dirty],dialog[open]')||document.activeElement?.matches('input,textarea,select');}
async function refresh(){if(busy||editing()||document.hidden)return;try{if(await client.refresh(()=>!editing()&&!busy))render()}catch{}}
channel.onmessage=refresh;window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,5000);
for(const name of ['input','change'])document.addEventListener(name,e=>{if(e.target.form)e.target.form.dataset.dirty='true'});
document.addEventListener('change',e=>{
 const form=e.target.form;
 if(e.target.name==='category'&&form?.querySelector('[data-subtype-options]')){form.elements.subtype.value='';form.querySelector('[data-subtype-options]').innerHTML=subtypeOptions(state,e.target.value)}
 if(e.target.name==='milestone'&&form)form.querySelector('[data-milestone-note]').hidden=!e.target.checked;
});
async function action(path,extra={}){
 if(busy||client.pending)throw Error('正在保存，请稍后');
 busy=true;try{
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generation:state.generation,revision:state.revision,...extra})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'操作失败，请刷新后重试');
  if(result.state){state=result.state;client=makeClient()}lastExport=result.fileName||lastExport;channel.postMessage('updated');render();return result;
 }finally{busy=false}
}
document.addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;const d=button.dataset;
 try{
  if(d.filter){filter=d.filter;render()}
  if(button.id==='refresh-capture'&&confirm('载入最新记录会清除尚未提交的表单输入，继续？'))location.reload();
  if(button.id==='download-recovery'&&recovery){const url=URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='capture-unsaved.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  if(button.id==='capture-export'){
   if(document.querySelector('form[data-dirty]'))throw Error('请先保存当前表单修改，再导出');
   await action('/api/export');
  }
  if(button.id==='capture-reset'){
   const dirty=Boolean(document.querySelector('form[data-dirty]'));
   $('#reset-dialog')?.remove();$('#capture-app').insertAdjacentHTML('beforeend',`<dialog id="reset-dialog" aria-labelledby="reset-title"><h3 id="reset-title">是否导出前面的记录？</h3><p>重置将清空当前 ${state.tasks.length} 条事项，开始 ${localDay()} 的新记录。主类型和子类型保留，已有导出文件保留。</p>${dirty?'<p class="form-error">存在尚未提交的表单输入，导出不包含这些输入。可取消并先保存，或确认重置以放弃这些输入。</p>':''}<p>确认后会结算正在运行的计时；导出失败不会清空。取消不改变事项或计时。</p><div class="capture-reset-actions"><button class="primary" data-reset-mode="export">导出并重置</button><button class="discard" data-reset-mode="discard">直接重置</button><button data-cancel-reset>取消</button></div></dialog>`);$('#reset-dialog').showModal();
  }
  if('cancelReset' in d)$('#reset-dialog').remove();
  if(d.resetMode){button.disabled=true;try{await action('/api/reset',{mode:d.resetMode})}finally{button.disabled=false}}
  if(button.id==='capture-exit'&&confirm('暂停全部计时并退出客户端？')){if(document.querySelector('form[data-dirty]'))throw Error('请先保存当前表单');await action('/api/shutdown');$('#capture-app').innerHTML='<section><h2>客户端已退出</h2><p>记录已保存，可以关闭本页。下次双击启动客户端即可。</p></section>';}
  if(d.complete){$('#capture-app').insertAdjacentHTML('beforeend',completionDialog(state.tasks.find(t=>t.id===d.complete),localDay()));$('#completion-dialog').showModal()}
  if('cancelCompletion' in d)$('#completion-dialog').remove();
  if(d.interrupt){$('#capture-app').insertAdjacentHTML('beforeend',interruptionDialog(state.tasks.find(t=>t.id===d.interrupt)));$('#interruption-dialog').showModal()}
  if('cancelInterruption' in d)$('#interruption-dialog').remove();
  if(d.addSession||d.editSession){const task=state.tasks.find(t=>t.id===(d.addSession||d.editSession));$('#capture-app').insertAdjacentHTML('beforeend',sessionDialog(task,d.sessionId?task.sessions.find(s=>s.id===d.sessionId):null));$('#session-dialog').showModal()}
  if('cancelSession' in d)$('#session-dialog').remove();
  if(d.startTime||d.pauseTime||d.resume||d.reopen||d.delete||d.deleteSession||d.deleteUntimed){
   if((d.delete||d.deleteSession||d.deleteUntimed)&&!confirm('删除此事项或用时记录？已导入主程序的数据不会自动删除。'))return;
   const next=structuredClone(state),id=d.startTime||d.pauseTime||d.resume||d.reopen||d.delete||d.deleteSession||d.deleteUntimed,now=new Date();
   if(d.startTime)next.tasks=next.tasks.map(t=>t.id!==id&&t.activeTimer?stopTimer(t,now):t);
   const i=next.tasks.findIndex(t=>t.id===id);if(i<0)throw Error('事项不存在');
   if(d.startTime)next.tasks[i]=startTimer(next.tasks[i],now);
   if(d.pauseTime)next.tasks[i]=stopTimer(next.tasks[i],now);
   if(d.resume)next.tasks[i]=resumeTask(next.tasks[i],now);
   if(d.reopen)next.tasks[i]=reopenTask(next.tasks[i]);
   if(d.delete)next.tasks.splice(i,1);
   if(d.deleteSession){next.tasks[i].sessions=next.tasks[i].sessions.filter(s=>s.id!==d.sessionId);next.tasks[i]=validateTask(updateTotal(next.tasks[i]))}
   if(d.deleteUntimed){next.tasks[i].untimedEntries=next.tasks[i].untimedEntries.filter(x=>x.date!==d.date);next.tasks[i]=validateTask(updateTotal(next.tasks[i]))}
   await save(next);
  }
 }catch(err){error(err)}
});
document.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,fields=Object.fromEntries(new FormData(form)),submitter=e.submitter;if(submitter)submitter.disabled=true;
 try{
  const next=structuredClone(state),now=new Date(),today=localDay(),id=form.dataset.taskEdit||form.dataset.completion||form.dataset.interruption||form.dataset.sessionForm;
  if(form.id==='capture-task-form'||id){
   const before=id?next.tasks.find(t=>t.id===id):{id:crypto.randomUUID()};let task;
   if(form.dataset.interruption)task=interruptTask(before,fields.reason,now);
   else if(form.dataset.sessionForm)task=validateTask(updateTotal(editSession(before,fields,form.dataset.sessionId||crypto.randomUUID(),now)));
   else if(form.dataset.completion)task=taskFromFields({...fields,milestone:fields.milestone||''},completeTask(before,today,now),today,now);
   else task=taskFromFields({...fields,milestone:fields.milestone||''},before,today,now);
   if(id)next.tasks[next.tasks.findIndex(t=>t.id===id)]=task;else next.tasks.push(task);rememberSubtype(next,task.category,task.subtype);
  }
  if(form.id==='capture-category-form'){const name=fields.name.trim();if(!name||next.categories.includes(name))throw Error('名称为空或主类型已存在');next.categories.push(name)}
  if(form.id==='capture-subtype-form')rememberSubtype(next,fields.category,fields.name.trim());
  await save(next);
 }catch(err){error(err,form)}finally{if(submitter)submitter.disabled=false}
});
render();setInterval(()=>{
 if(localDay()!==renderedDay&&!editing())render();
 document.querySelectorAll('[data-task-time]').forEach(el=>{const task=state.tasks.find(t=>t.id===el.dataset.taskTime);if(task)el.textContent=formatElapsed(totalSeconds(task))});
 document.querySelectorAll('[data-task-today]').forEach(el=>{const task=state.tasks.find(t=>t.id===el.dataset.taskToday);if(task)el.textContent=formatElapsed(stopTimer(task).timeEntries.find(x=>x.date===localDay())?.seconds||0)});
 if($('#capture-total'))$('#capture-total').textContent=formatElapsed(state.tasks.reduce((s,t)=>s+totalSeconds(t),0));
},1000);
