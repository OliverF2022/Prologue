import { editSession, validateTimeState } from './time-model.js';
import { todayTimeCharts, periodTimeCharts } from './time-charts.js';
import { timeSummary, reviewMarkdown } from './time-analytics.js';
import { normalizeTask, taskFromFields, reopenTask, rememberSubtype, localDay, periodBounds, periodStats,
  periodSeconds, startTimer, stopTimer, totalSeconds, formatElapsed, completeTask, interruptTask, resumeTask,
  updateTotal, validateTask } from './task-model.js';
import { esc, dailyPage, completedPage, completionDialog, interruptionDialog, subtypeOptions,
  hourOptions, timerBanner, sessionDialog } from './task-view.js';
const $=s=>document.querySelector(s);
const day=localDay;
let today=day();let state=await fetch('/api/state').then(r=>r.json()),page='今日记录',period='week',anchor=today;
state.tasks=state.tasks.map(normalizeTask);state.subtypes ||= [];
let dailyChartMode='pie',lastChartUpdate=0;
let completedFilters={month:today.slice(0,7),category:'',subtype:'',milestones:false};
const pages=['今日记录','已完成事项','统计洞察','复盘空间','关键复盘'];
$('#today').textContent=today;$('#nav').innerHTML=pages.map(p=>`<button data-page="${p}">${p}</button>`).join('');

const bounds=periodBounds;
function stats(kind,date){return periodStats(state.tasks,kind,date)}
const summary=s=>`<div class="metrics"><article><small>事项完成率</small><strong>${s.tasks?Math.round(s.done/s.tasks*100):0}%</strong><span>${s.done} / ${s.tasks} 项</span></article><article><small>投入时间</small><strong class="stat-time" data-kind="${s.kind}" data-date="${s.date}">${s.minutes}</strong><span>分钟</span></article><article><small>打卡成果</small><strong>${s.checks}</strong><span>次打卡</span></article></div>`;
function review(r){return `<article class="review" id="r-${r.id}" style="border-left-color:${['#65745d','#d3904c','#aa6788','#5179b1'].includes(r.color)?r.color:'#65745d'}"><h3>${r.kind==='week'?'周':r.kind==='month'?'月':'年'}复盘 · ${r.date}</h3>${r.kind==='week'?summary(stats('week',r.date)):''}${['week','month'].includes(r.kind)?`<div class="review-time-summary"><h4>时间统计（自动生成）</h4><pre data-review-time="${r.id}">${esc(timeSummary(state.tasks,r.kind,r.date))}</pre></div>`:''}<textarea data-text="${r.id}" placeholder="记录收获、问题和下一步行动…">${esc(r.text)}</textarea>${r.kind==='week'?`<label><input type="checkbox" data-key="${r.id}" ${r.key?'checked':''}>关键复盘</label><select data-color="${r.id}">${['#65745d','#d3904c','#aa6788','#5179b1'].map(c=>`<option ${c===r.color?'selected':''}>${c}</option>`).join('')}</select>`:''}<button data-export="${r.id}">导出 Markdown</button><span class="saved">输入后自动保存</span></article>`}
function render(){ $('#nav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));let html=`<h2>${page}</h2>`;
if(page==='今日记录')html+=dailyPage(state,today,summary(stats('week',today)),dailyChartMode);
if(page==='已完成事项')html+=completedPage(state,completedFilters,today);
if(page==='统计洞察'){const s=stats(period,anchor);html+=`<div class="toolbar"><select id="period"><option value="week">周</option><option value="month">月</option><option value="year">年</option></select><input id="anchor" type="date" value="${anchor}"></div><p>${bounds(period,anchor).join(' 至 ')}（结束日期不含）</p>${summary(s)}<section id="period-time-charts">${periodTimeCharts(state.tasks,period,anchor)}</section><section><h3>分类投入时间</h3>${state.categories.map(c=>{const m=Math.floor(periodSeconds(state.tasks.filter(t=>t.category===c),period,anchor)/60);return `<p>${esc(c)} <b data-category-time="${esc(c)}">${m} 分钟</b></p><div class="track"><div data-category-bar="${esc(c)}" style="width:${s.minutes?m/s.minutes*100:0}%"></div></div>`}).join('')}<p class="lead">按实际投入日期统计，包含未完成事项的用时。</p><h3>事项完成比例</h3><meter min="0" max="${s.tasks||1}" value="${s.done}"></meter><h3>打卡次数</h3><p>${s.checks} 次</p><div class="track"><div style="width:${Math.min(100,s.checks*5)}%"></div></div></section>`}
if(page==='复盘空间'){html+=`<form id="review-form"><select name="kind"><option value="week">周复盘</option><option value="month">月复盘</option><option value="year">年复盘</option></select><input type="date" name="date" required value="${today}"><button class="primary">创建 / 定位复盘</button></form><button id="export-all">批量导出全部复盘</button>`;const years=[...new Set(state.reviews.map(r=>r.date.slice(0,4)))].sort().reverse();html+=years.map(y=>`<section><h3>${y} 年</h3><p>${state.reviews.filter(r=>r.kind==="month"&&r.date.startsWith(y)).map(r=>`<a href="#r-${r.id}">${r.date.slice(0,7)} 月复盘 ↗</a> `).join("")}</p>${state.reviews.filter(r=>r.kind==='year'&&r.date.startsWith(y)).map(review).join('')}${[...new Set(state.reviews.filter(r=>r.date.startsWith(y)&&r.kind!=='year').map(r=>r.date.slice(0,7)))].sort().map(m=>`<details open><summary>${m} 月</summary><p>${state.reviews.filter(r=>r.kind==='week'&&r.date.startsWith(m)).map(r=>`<a href="#r-${r.id}">${r.date} 周复盘 ↗</a> `).join('')}</p>${state.reviews.filter(r=>r.date.startsWith(m)&&r.kind!=='year').sort((a,b)=>a.kind==='month'?-1:a.date.localeCompare(b.date)).map(review).join('')}</details>`).join('')}</section>`).join('')||'<section>创建第一篇复盘，梳理这一段旅程。</section>'}
if(page==='关键复盘')html+=state.reviews.filter(r=>r.key).map(r=>`<section><a data-jump="${r.id}" href="#r-${r.id}"><span style="color:${esc(r.color)}">●</span> ${r.date} 周复盘 ↗</a><p>${esc(r.text.slice(0,120))}</p><button data-export="${r.id}">导出 Markdown</button></section>`).join('')||'<section>在周复盘中勾选“关键复盘”，把重要的领悟留在这里。</section>';
$('#app').innerHTML=timerBanner(state)+html+hourOptions;if($('#period'))$('#period').value=period;
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
    const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
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
  const button = event.target.closest('button,a');
  if (!button) return;
  const data = button.dataset;
  try {
    if (data.page) { page = data.page; render(); }
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
    if (data.export) download(state.reviews.filter(r => r.id === data.export));
    if (button.id === 'export-all') download(state.reviews);
    if (data.jump) { page = '复盘空间'; render(); document.getElementById('r-' + data.jump)?.scrollIntoView(); }
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
    const next = structuredClone(state);
    let reviewId;
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
    if (form.id === 'review-form') {
      fields.date = bounds(fields.kind, fields.date)[0];
      let review = next.reviews.find(r => r.kind === fields.kind && r.date === fields.date);
      if (!review) {
        review = { ...fields, id: crypto.randomUUID(), text: '', key: false, color: '#65745d' };
        next.reviews.push(review);
      }
      reviewId = review.id;
    }
    await commit(next);
    if (reviewId) document.getElementById('r-' + reviewId)?.scrollIntoView();
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
  if (el.id === 'period') { period = el.value; render(); }
  if (el.id === 'anchor' && el.value) { anchor = el.value; render(); }
  if (data.key || data.color) {
    const review = state.reviews.find(r => r.id === (data.key || data.color));
    if (data.key) review.key = el.checked;
    if (data.color) review.color = el.value;
    try { await persist(); } catch (error) { report(error); }
  }
});

document.addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.text) {
    state.reviews.find(r => r.id === el.dataset.text).text = el.value;
    persist().catch(error => report(error));
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
    if(periodCharts && !periodCharts.contains(document.activeElement))periodCharts.innerHTML=periodTimeCharts(state.tasks,period,anchor,now);
    document.querySelectorAll('[data-review-time]').forEach(el=>{const r=state.reviews.find(r=>r.id===el.dataset.reviewTime);if(r)el.textContent=timeSummary(state.tasks,r.kind,r.date,now)});
    lastChartUpdate=now.getTime();
  }
  const total=periodSeconds(state.tasks,period,anchor,now);
  document.querySelectorAll('[data-category-time]').forEach(el=>{
    el.textContent=Math.floor(periodSeconds(state.tasks.filter(t=>t.category===el.dataset.categoryTime),period,anchor,now)/60)+' 分钟';
  });
  document.querySelectorAll('[data-category-bar]').forEach(el=>{
    const seconds=periodSeconds(state.tasks.filter(t=>t.category===el.dataset.categoryBar),period,anchor,now);
    el.style.width=(total?seconds/total*100:0)+'%';
  });
},1000);
