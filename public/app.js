import {reviewPage,reviewMap,reviewResults} from './review-view.js';
import {activeReviews,findReview,reviewDate,reviewDraft,queryReviews,createReview,trashReview,restoreReview} from './review-model.js';
import {statisticsPage,statisticsCharts,statisticsDialog,outcomeCards} from './statistics-view.js';
import { editSession, validateTimeState } from './time-model.js';
import { todayTimeCharts } from './time-charts.js';
import { timeSummary, reviewMarkdown, filterStatisticsTasks } from './time-analytics.js';
import { normalizeTask, taskFromFields, reopenTask, rememberSubtype, localDay, periodStats,
  startTimer, stopTimer, totalSeconds, formatElapsed, completeTask, interruptTask, resumeTask,
  updateTotal, validateTask } from './task-model.js';
import { esc, dailyPage, completedPage, completionDialog, interruptionDialog, subtypeOptions,
  hourOptions, timerBanner, sessionDialog } from './task-view.js';
const $=s=>document.querySelector(s);
const day=localDay;
const isDemo=new URLSearchParams(location.search).get('demo')==='1';
const stateUrl=isDemo?'/api/demo/state':'/api/state';
let today=day();let state=await fetch(stateUrl).then(r=>r.json()),page='今日记录',period='week',anchor=today;
state.tasks=state.tasks.map(normalizeTask);state.subtypes ||= [];
let dailyChartMode='pie',lastChartUpdate=0;
let statisticsFilters={category:'',subtype:''},statisticsTrigger=null;
let completedFilters={month:today.slice(0,7),category:'',subtype:'',milestones:false};
let reviewUI={year:Number(today.slice(0,4)),selectedId:null,draft:null,undoId:null,filters:{kind:'',date:'',keyword:'',status:'',trash:false}},reviewSaveToken=0;
const pages=['今日记录','已完成事项','统计洞察','复盘空间','关键复盘'];
$('#today').textContent=today;
$('#mode-link').textContent=isDemo?'返回正式记录':'查看演示';$('#mode-link').href=isDemo?'/':'/?demo=1';$('#nav').innerHTML=pages.map(p=>`<button data-page="${p}">${p}</button>`).join('');

function stats(kind,date){return periodStats(state.tasks,kind,date)}
const summary=s=>`<div class="metrics"><article><small>事项完成率</small><strong>${s.tasks?Math.round(s.done/s.tasks*100):0}%</strong><span>${s.done} / ${s.tasks} 项</span></article><article><small>投入时间</small><strong class="stat-time" data-kind="${s.kind}" data-date="${s.date}">${s.minutes}</strong><span>分钟</span></article><article><small>打卡成果</small><strong>${s.checks}</strong><span>次打卡</span></article></div>`;
function render(){ $('#nav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));let html=`<h2>${page}</h2>`;
if(page==='今日记录')html+=dailyPage(state,today,summary(stats('week',today)),dailyChartMode);
if(page==='已完成事项')html+=completedPage(state,completedFilters,today);
if(page==='统计洞察')html+=statisticsPage(state,period,anchor,statisticsFilters);
if(page==='复盘空间')html+=reviewPage(state,reviewUI,today);
if(page==='关键复盘')html+=activeReviews(state.reviews).filter(r=>r.key).map(r=>`<section><a data-jump="${r.id}" href="#r-${r.id}"><span style="color:${esc(r.color)}">●</span> ${r.date} 周复盘 ↗</a><p>${esc(r.text.slice(0,120))}</p><button data-export="${r.id}">导出 Markdown</button></section>`).join('')||'<section>在周复盘中勾选“关键复盘”，把重要的领悟留在这里。</section>';
$('#app').innerHTML=(isDemo?`<div class="demo-banner" role="note"><div><b>演示模式 · 全部为假数据</b><p>可自由体验计时、时段修改、统计与复盘。演示记录与正式数据独立保存。样例日期：${esc(state.demoAnchorDate)}</p></div><button type="button" id="reset-demo">恢复示例</button></div>`:'')+timerBanner(state)+html+hourOptions;if($('#period'))$('#period').value=period;
}
function focusReview(){document.getElementById('review-editor')?.scrollIntoView({block:'start'});$('#review-text')?.focus({preventScroll:true});}
function openReview(kind,date,id){
  const record=id?activeReviews(state.reviews).find(r=>r.id===id):findReview(state.reviews,kind,date);
  if(id&&!record)throw Error('复盘不存在或已删除');
  const start=record?.date||reviewDate(kind,date);
  if(reviewUI.draft?.text?.trim()&&(reviewUI.draft.kind!==(record?.kind||kind)||reviewUI.draft.date!==start)&&!confirm('当前草稿尚未保存，放弃草稿并打开其他复盘？'))return;
  reviewUI.year=Number(start.slice(0,4));reviewUI.selectedId=record?.id||null;
  reviewUI.draft=record?null:reviewDraft(kind,start,reviewUI.draft);page='复盘空间';render();focusReview();
}
function refreshReviewOverview(){
  if(page!=='复盘空间')return;
  if($('#review-map-container'))$('#review-map-container').innerHTML=reviewMap(state,reviewUI.year,today);
  if($('#review-results'))$('#review-results').innerHTML=reviewResults(state,reviewUI.filters);
  if($('#export-query'))$('#export-query').disabled=!queryReviews(state.reviews,reviewUI.filters).length;
}
function download(items){
  const text=items.map(r=>reviewMarkdown(r,state.tasks)).join('\n\n---\n\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=`Prologue-${today}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let queue = Promise.resolve();
function persist(next = state) {
  validateTimeState(next.tasks);
  const body = JSON.stringify(next);
  const request = queue.catch(() => {}).then(async () => {
    const response = await fetch(stateUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Error(result.error || '保存失败，请重试');
    }
    $('#error').textContent = '';
  });
  queue = request;
  return request;
}

function report(error, form) {
  const target = form?.querySelector('.form-error') || $('#error');
  target.textContent = error.message || '保存失败，请重试';
}

let mutating = false;
async function commit(next) {
  if(mutating) throw Error('正在保存，请稍后重试');
  mutating = true;
  try { await persist(next); state = next; render(); }
  finally { mutating = false; }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button,a,[data-stack-date]');
  if (!button) return;
  const data = button.dataset;
  try {
    if (data.page) { page = data.page; render(); }
    if(data.reviewWeek)openReview('week',data.reviewWeek);
    if(data.openReview)openReview(null,null,data.openReview);
    if('closeReview' in data){reviewUI.draft=null;reviewUI.selectedId=null;render();}
    if(data.reviewYearStep){reviewUI.year=Math.max(1901,Math.min(9998,reviewUI.year+Number(data.reviewYearStep)));render();}
    if('reviewTrashToggle' in data){reviewUI.filters.trash=!reviewUI.filters.trash;render();}
    if('reviewQueryReset' in data){reviewUI.filters={kind:'',date:'',keyword:'',status:'',trash:reviewUI.filters.trash};render();}
    if(data.trashReview){await commit(trashReview(state,data.trashReview));reviewUI.undoId=data.trashReview;if(reviewUI.selectedId===data.trashReview)reviewUI.selectedId=null;render();}
    if(data.restoreReview){await commit(restoreReview(state,data.restoreReview));reviewUI.undoId=null;render();}
    if (data.heatDate || data.stackDate || data.statOutcome) {
      const selection=data.heatDate?{type:'hour',date:data.heatDate,hour:Number(data.heatHour)}
        :data.stackDate?{type:data.stackScope||'day',date:data.stackDate,category:data.stackCategory}
        :{type:'outcome',outcome:data.statOutcome};
      if(data.heatDate){button.closest('.time-heatmap').querySelectorAll('.heat-cell').forEach(el=>el.tabIndex=el===button?0:-1)}
      statisticsTrigger=button;$('#statistics-detail-dialog')?.remove();
      $('#app').insertAdjacentHTML('beforeend',statisticsDialog(filterStatisticsTasks(state.tasks,statisticsFilters),period,anchor,selection));
      $('#statistics-detail-dialog').showModal();
    }
    if ('closeStatistics' in data){$('#statistics-detail-dialog').remove();if(statisticsTrigger?.isConnected)statisticsTrigger.focus();}
    if (button.id==='reset-demo'&&isDemo) {
      if(mutating)throw Error('正在保存，请稍后重试');
      await queue.catch(()=>{});
      const response=await fetch('/api/demo/reset',{method:'POST'});
      if(!response.ok)throw Error('恢复演示数据失败，请重试');
      state=await response.json();render();
    }
    if (data.dayChart) { dailyChartMode=data.dayChart; $('#today-time-charts').innerHTML=todayTimeCharts(state.tasks,today,dailyChartMode); }
    if (data.addSession || data.editSession) {
      const task=state.tasks.find(t=>t.id===(data.addSession||data.editSession));
      if(task.activeTimer)throw Error('请先暂停计时，再编辑时间段');
      $('#session-dialog')?.remove();
      const session=data.sessionId?task.sessions.find(s=>s.id===data.sessionId):null;
      $('#app').insertAdjacentHTML('beforeend',sessionDialog(task,session));$('#session-dialog').showModal();
    }
    if ('cancelSession' in data) $('#session-dialog').remove();
    if ((data.deleteSession || data.deleteUntimed) && confirm('删除这条用时记录？累计用时和统计会同步更新。')) {
      const next=structuredClone(state),index=next.tasks.findIndex(t=>t.id===(data.deleteSession||data.deleteUntimed));
      if(data.deleteSession) {
        if(next.tasks[index].activeTimer)throw Error('请先暂停计时');
        next.tasks[index].sessions=next.tasks[index].sessions.filter(s=>s.id!==data.sessionId);
      } else next.tasks[index].untimedEntries=next.tasks[index].untimedEntries.filter(e=>e.date!==data.date);
      next.tasks[index]=validateTask(updateTotal(next.tasks[index]));await commit(next);
    }
    if (data.complete) {
      $('#completion-dialog')?.remove();
      const task = state.tasks.find(t => t.id === data.complete);
      $('#app').insertAdjacentHTML('beforeend', completionDialog(task, today));
      $('#completion-dialog').showModal();
    }
    if ('cancelCompletion' in data) $('#completion-dialog').remove();
    if (data.interrupt) {
      $('#interruption-dialog')?.remove();
      $('#app').insertAdjacentHTML('beforeend', interruptionDialog(state.tasks.find(t=>t.id===data.interrupt)));
      $('#interruption-dialog').showModal();
    }
    if ('cancelInterruption' in data) $('#interruption-dialog').remove();
    const timerId = data.startTime || data.pauseTime || data.resume;
    if (timerId) {
      const next = structuredClone(state), now = new Date();
      if (data.startTime) next.tasks = next.tasks.map(t=>t.id!==timerId && t.activeTimer ? stopTimer(t,now) : t);
      const index=next.tasks.findIndex(t=>t.id===timerId);
      next.tasks[index] = data.startTime ? startTimer(next.tasks[index],now)
        : data.pauseTime ? stopTimer(next.tasks[index],now) : resumeTask(next.tasks[index],now);
      await commit(next);
    }
    if (data.reopen) {
      const next = structuredClone(state);
      next.tasks = next.tasks.map(t => t.id === data.reopen ? reopenTask(t) : t);
      await commit(next);
    }
    if (data.delete && confirm('删除此事项？')) {
      const next = structuredClone(state);
      next.tasks = next.tasks.filter(t => t.id !== data.delete);
      await commit(next);
    }
    if (button.id === 'reset-completed') {
      completedFilters = { month: today.slice(0, 7), category: '', subtype: '', milestones: false };
      render();
    }
    if (data.export) download(activeReviews(state.reviews).filter(r => r.id === data.export));
    if (button.id === 'export-all') download(activeReviews(state.reviews));
    if (button.id === 'export-query') download(queryReviews(state.reviews,reviewUI.filters));
    if (data.jump) openReview(null,null,data.jump);
  } catch (error) { report(error); }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  today = day();
  $('#today').textContent = today;
  const form = event.target;
  const fields = Object.fromEntries(new FormData(form));
  const submitter = event.submitter;
  if (submitter) submitter.disabled = true;
  form.querySelector('.form-error')?.replaceChildren();
  try {
    if(form.id==='review-form'){openReview(fields.kind,fields.date);return;}
    if(form.id==='review-query-form'){reviewUI.filters={...reviewUI.filters,...fields};render();return;}
    if(form.id==='review-draft-form'){
      if(!reviewUI.draft)throw Error('草稿已关闭，请重新打开');
      const next=createReview(state,{...reviewUI.draft,...fields,key:Boolean(fields.key)});
      await commit(next);reviewUI.selectedId=next.reviews.at(-1).id;reviewUI.draft=null;render();focusReview();return;
    }
    const next = structuredClone(state);
    if (form.id === 'task-form' || form.dataset.taskEdit || form.dataset.completion || form.dataset.interruption || form.dataset.sessionForm) {
      const id = form.dataset.taskEdit || form.dataset.completion || form.dataset.interruption || form.dataset.sessionForm;
      const previous = id ? next.tasks.find(t => t.id === id) : { id: crypto.randomUUID() };
      let task;
      const now = new Date();
      if (form.dataset.interruption) task=interruptTask(previous,fields.reason,now);
      else if (form.dataset.sessionForm) task=validateTask(updateTotal(editSession(previous,fields,form.dataset.sessionId||crypto.randomUUID(),now)));
      else if (form.dataset.completion) {
        task=taskFromFields({...fields,milestone:fields.milestone||''},completeTask(previous,today,now),today,now);
      } else task=taskFromFields({...fields,milestone:fields.milestone||''},previous,today,now);
      if (id) next.tasks[next.tasks.findIndex(t => t.id === id)] = task;
      else next.tasks.push(task);
      rememberSubtype(next, task.category, task.subtype);
    }
    if (form.id === 'category-form') {
      const name = fields.name.trim();
      if (!name) throw Error('请填写主类型名称');
      if (next.categories.includes(name)) throw Error('此主类型已存在');
      next.categories.push(name);
    }
    if (form.id === 'subtype-form') {
      const name = fields.name.trim();
      if (!name) throw Error('请填写子类型名称');
      rememberSubtype(next, fields.category, name);
    }
    await commit(next);
  } catch (error) { report(error, form); }
  finally { if (submitter) submitter.disabled = false; }
});

document.addEventListener('change', async event => {
  const el = event.target, data = el.dataset, form = el.form;
  if (form && (form.id === 'task-form' || form.dataset.taskEdit)) {
    if (el.name === 'category') {
      form.elements.subtype.value = '';
      form.querySelector('[data-subtype-options]').innerHTML = subtypeOptions(state, el.value);
    }

  }
  if (el.name === 'milestone' && form) form.querySelector('[data-milestone-note]').hidden = !el.checked;
  if (el.id === 'completed-month' && el.value) { completedFilters.month = el.value; render(); }
  if (el.id === 'completed-category') { completedFilters.category = el.value; completedFilters.subtype = ''; render(); }
  if (el.id === 'completed-subtype') { completedFilters.subtype = el.value; render(); }
  if (el.id === 'only-milestones') { completedFilters.milestones = el.checked; render(); }
  if (el.id === 'statistics-category') { statisticsFilters={category:el.value,subtype:''};render(); }
  if (el.id === 'statistics-subtype') { statisticsFilters.subtype=el.value;render(); }
  if (el.id === 'period') { period = el.value; render(); }
  if (el.id === 'anchor' && el.value) { anchor = el.value; render(); }
  if(el.id==='review-year'){
    const year=Number(el.value);if(Number.isInteger(year)&&year>=1901&&year<=9998){reviewUI.year=year;render();}
  }
  if(form?.id==='review-draft-form'&&reviewUI.draft){reviewUI.draft[el.name]=el.type==='checkbox'?el.checked:el.value;}
  if (data.key || data.color) {
    const review = state.reviews.find(r => r.id === (data.key || data.color));
    if (data.key) review.key = el.checked;
    if (data.color) review.color = el.value;
    try { await persist();refreshReviewOverview();const article=document.getElementById('r-'+review.id);if(article&&data.color)article.style.borderLeftColor=review.color; } catch (error) { report(error); }
  }
});

document.addEventListener('input', event => {
  const el = event.target;
  if(el.form?.id==='review-draft-form'&&el.name==='text'&&reviewUI.draft)reviewUI.draft.text=el.value;
  if (el.dataset.text) {
    const record=activeReviews(state.reviews).find(r=>r.id===el.dataset.text);if(!record)return;
    record.text=el.value;const token=++reviewSaveToken;
    if($('#review-save-status'))$('#review-save-status').textContent='正在保存…';
    persist().then(()=>{refreshReviewOverview();if(token===reviewSaveToken&&$('#review-save-status'))$('#review-save-status').textContent='已保存';}).catch(error=>{report(error);if($('#review-save-status'))$('#review-save-status').textContent='保存失败，请重试';});
  }
});

render();
setInterval(() => {
  const now=new Date(), current=day(now);
  if(current!==today){today=current;$('#today').textContent=today;render();}
  document.querySelectorAll('[data-task-time]').forEach(el=>{
    const task=state.tasks.find(t=>t.id===el.dataset.taskTime);
    if(task)el.textContent=formatElapsed(totalSeconds(task,now));
  });
  document.querySelectorAll('[data-task-today]').forEach(el=>{
    const task=state.tasks.find(t=>t.id===el.dataset.taskToday);
    if(task)el.textContent=formatElapsed(stopTimer(task,now).timeEntries.find(e=>e.date===today)?.seconds||0);
  });
  document.querySelectorAll('[data-time-row]').forEach(el=>{
    const task=state.tasks.find(t=>t.id===el.dataset.timeRow);
    if(task)el.textContent=formatElapsed(stopTimer(task,now).timeEntries.find(e=>e.date===el.dataset.timeDate)?.seconds||0);
  });
  document.querySelectorAll('.stat-time').forEach(el=>{
    el.textContent=String(periodStats(state.tasks,el.dataset.kind,el.dataset.date,now).minutes);
  });
  if(now.getTime()-lastChartUpdate>10000){
    const daily=$('#today-time-charts'),periodCharts=$('#period-time-charts');
    if(daily && !daily.contains(document.activeElement))daily.innerHTML=todayTimeCharts(state.tasks,today,dailyChartMode,now);
    if(periodCharts && !$('#statistics-detail-dialog')?.open && !periodCharts.contains(document.activeElement))periodCharts.innerHTML=statisticsCharts(filterStatisticsTasks(state.tasks,statisticsFilters),state.categories,period,anchor,now);
    const outcomes=$('#statistics-outcomes');
    if(outcomes&&!$('#statistics-detail-dialog')?.open&&!outcomes.contains(document.activeElement))outcomes.innerHTML=outcomeCards(filterStatisticsTasks(state.tasks,statisticsFilters),period,anchor,now);
    document.querySelectorAll('[data-review-time]').forEach(el=>{const r=state.reviews.find(r=>r.id===el.dataset.reviewTime);if(r)el.textContent=timeSummary(state.tasks,r.kind,r.date,now)});
    lastChartUpdate=now.getTime();
  }
},1000);

// A single heatmap tab stop; arrow keys move between adjacent clock-hour cells.
document.addEventListener('keydown',event=>{
  const bar=event.target.closest('[data-stack-date]');
  if(bar&&['Enter',' '].includes(event.key)){event.preventDefault();bar.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
  const cell=event.target.closest('.heat-cell');
  if(!cell)return;
  const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-24,ArrowDown:24};
  if(!(event.key in moves)&&!['Home','End'].includes(event.key))return;
  event.preventDefault();
  const cells=[...cell.closest('.time-heatmap').querySelectorAll('.heat-cell')],index=Number(cell.dataset.cellIndex);
  const next=event.key==='Home'?Math.floor(index/24)*24:event.key==='End'?Math.floor(index/24)*24+23:index+moves[event.key];
  if(cells[next]&&!cells[next].disabled){cell.tabIndex=-1;cells[next].tabIndex=0;cells[next].focus();}
});

function showReviewTooltip(button){
  const tip=$('#review-week-tooltip');if(!tip||button.disabled)return;
  tip.textContent=button.dataset.reviewTooltip;tip.hidden=false;
  const rect=button.getBoundingClientRect(),width=tip.offsetWidth,height=tip.offsetHeight;
  tip.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2))+'px';
  tip.style.top=Math.max(8,rect.top-height-10<8?Math.min(innerHeight-height-8,rect.bottom+10):rect.top-height-10)+'px';
}
for(const eventName of ['pointerover','focusin'])document.addEventListener(eventName,event=>{const button=event.target.closest('[data-review-tooltip]');if(button)showReviewTooltip(button);});
for(const eventName of ['pointerout','focusout'])document.addEventListener(eventName,event=>{const button=event.target.closest('[data-review-tooltip]');if(button&&!button.contains(event.relatedTarget)&&$('#review-week-tooltip'))$('#review-week-tooltip').hidden=true;});
