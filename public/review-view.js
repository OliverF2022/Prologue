import {esc} from './task-view.js';
import {localDay,formatElapsed,periodStats} from './task-model.js';
import {timeSummary} from './time-analytics.js';
import {reviewLabels,reviewWeeks,activeReviews,queryReviews} from './review-model.js';

const labels={written:'已填写',key:'关键复盘',empty:'未填写',future:'未来'};
const option=(value,label,current)=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;
const openButton=r=>`<button type="button" data-open-review="${esc(r.id)}">查看${reviewLabels[r.kind]}复盘 · ${esc(r.date)}</button>`;
export function reviewMap(state,year,today=localDay(),now=new Date()){
  const weeks=reviewWeeks(state,year,today,now);
  return `<div class="review-year-grid" role="group" aria-label="${year} 年周复盘日历">${Array.from({length:12},(_,i)=>`<div class="review-month-column"><h4>${i+1} 月</h4>${weeks.filter(w=>w.month===i+1).map(w=>{
    const tooltip=`${w.start} 至 ${w.end}\n${labels[w.status]}${w.status==='future'?'':`\n投入 ${formatElapsed(w.seconds)} · 涉及 ${w.taskCount} 个事项\n完成 ${w.completed} 项 · 打卡 ${w.checkins} 次\n完成里程碑 ${w.milestones} 项 · 中断 ${w.interruptions} 次`}`;
    return `<button type="button" class="review-week review-week-${w.status}" data-review-week="${w.start}" data-review-tooltip="${esc(tooltip)}" aria-label="${esc(tooltip.replaceAll('\n','，'))}" aria-describedby="review-week-tooltip" ${w.status==='future'?'disabled':''}><span>${w.start.slice(0,4)!==String(year)?w.start.slice(5).replace('-','/'):w.start.slice(-2)+'日'}</span><small>${w.status==='key'?'★':w.status==='written'?'✓':w.status==='future'?'—':'○'}</small></button>`;
  }).join('')}</div>`).join('')}</div>`;
}
function resultRow(r,trash){
  return `<div class="review-result"><div>${trash?`<b>${reviewLabels[r.kind]}复盘 · ${esc(r.date)}</b>`:openButton(r)}<small>${r.key?'★ 关键复盘 · ':''}${r.text?.trim()?'已填写':'未填写'}</small><p>${esc(r.text?.trim().slice(0,90)||'还没有填写总结')}</p></div><div class="review-row-actions">${trash?`<button type="button" data-restore-review="${esc(r.id)}">恢复</button>`:`<button type="button" data-export="${esc(r.id)}">导出</button><button type="button" data-trash-review="${esc(r.id)}">删除</button>`}</div></div>`;
}
export function reviewResults(state,filters){
  const matches=queryReviews(state.reviews,filters);
  return `<p class="chart-note">找到 ${matches.length} 篇${filters.trash?'已删除':''}复盘${filters.date?' · 日期按所在周／月／年匹配':''}</p>`+(matches.length?[...new Set(matches.map(r=>r.date.slice(0,4)))].map(y=>`<details open class="review-result-year"><summary>${y} 年</summary>${matches.filter(r=>r.date.startsWith(y)&&r.kind==='year').map(r=>resultRow(r,filters.trash)).join('')}${[...new Set(matches.filter(r=>r.date.startsWith(y)&&r.kind!=='year').map(r=>r.date.slice(0,7)))].sort().reverse().map(month=>`<details open class="review-result-month"><summary>${month} 月</summary>${matches.filter(r=>r.date.startsWith(month)&&r.kind!=='year').sort((a,b)=>a.kind===b.kind?b.date.localeCompare(a.date):a.kind==='month'?-1:1).map(r=>resultRow(r,filters.trash)).join('')}</details>`).join('')}</details>`).join(''):'<p class="empty-chart">没有符合条件的复盘，可调整查询条件或点击日历打开某周。</p>');
}
export function reviewEditor(state,review,draft=false,now=new Date()){
  if(!review)return '<p class="empty-chart">点击上方日历或查询结果查看复盘，也可选择周期和日期新建。</p>';
  const r=review,weekly=r.kind==='week',s=weekly?periodStats(state.tasks,'week',r.date,now):null;
  const children=activeReviews(state.reviews).filter(child=>r.kind==='year'?child.kind==='month'&&child.date.startsWith(r.date.slice(0,4)):r.kind==='month'?child.kind==='week'&&child.date.startsWith(r.date.slice(0,7)):false);
  return `<article class="review review-editor" id="r-${esc(r.id||'draft')}" style="border-left-color:${['#65745d','#d3904c','#aa6788','#5179b1'].includes(r.color)?r.color:'#65745d'}"><div class="section-heading"><h3>${draft?'新建草稿 · ':''}${reviewLabels[r.kind]}复盘 · ${esc(r.date)}</h3><button type="button" data-close-review>${draft?'取消创建':'关闭复盘'}</button></div>
    ${s?`<p class="review-stat-brief">本周投入 ${formatElapsed(s.minutes*60)} · 本周开始事项完成 ${s.done} / ${s.tasks} 项 · 打卡 ${s.checks} 次</p>`:''}
    ${children.length?`<nav class="review-child-links" aria-label="下级复盘">${children.sort((a,b)=>a.date.localeCompare(b.date)).map(openButton).join('')}</nav>`:''}
    ${['week','month'].includes(r.kind)?`<details class="review-time-summary" open><summary>时间统计（自动生成）</summary><pre ${draft?'':`data-review-time="${esc(r.id)}"`}>${esc(timeSummary(state.tasks,r.kind,r.date,now))}</pre></details>`:''}
    ${draft?'<form id="review-draft-form">':''}<label class="review-text-label" for="review-text">我的总结</label><textarea id="review-text" ${draft?'name="text"':'data-text="'+esc(r.id)+'"'} placeholder="记录收获、问题和下一步行动…">${esc(r.text||'')}</textarea>
    ${weekly?`<label class="check-label"><input type="checkbox" ${draft?'name="key"':'data-key="'+esc(r.id)+'"'} ${r.key?'checked':''}>关键复盘（日历显示红色）</label><label class="review-color-label">复盘标记颜色<select ${draft?'name="color"':'data-color="'+esc(r.id)+'"'}>${['#65745d','#d3904c','#aa6788','#5179b1'].map(c=>option(c,c,r.color)).join('')}</select></label>`:''}
    <div class="review-editor-actions">${draft?'<button class="primary" type="submit">保存并创建</button><span class="saved">取消创建不会留下空白记录</span>':`<button type="button" data-export="${esc(r.id)}">导出 Markdown</button><button type="button" data-trash-review="${esc(r.id)}">删除复盘</button><span class="saved" id="review-save-status" role="status">输入后自动保存</span>`}</div>${draft?'</form>':''}</article>`;
}
export function reviewPage(state,ui,today=localDay(),now=new Date()){
  const selected=ui.selectedId?activeReviews(state.reviews).find(r=>r.id===ui.selectedId):null;
  return `<section class="review-calendar"><div class="section-heading"><div><h3>周复盘日历</h3><p class="chart-note">每格代表一周，数字为周一日期；悬浮查看统计，点击查看或填写复盘。</p></div><div class="review-year-control"><button type="button" data-review-year-step="-1" aria-label="上一年">←</button><label>年份<input id="review-year" type="number" min="1901" max="9998" value="${ui.year}"></label><button type="button" data-review-year-step="1" aria-label="下一年">→</button></div></div>
    <div class="review-map-scroll" id="review-map-container">${reviewMap(state,ui.year,today,now)}</div><div class="review-map-legend">${['written','key','empty','future'].map(s=>`<span><i class="review-week-${s}"></i>${labels[s]}</span>`).join('')}</div><p class="chart-note">跨月周归属周一所在月；覆盖年初的跨年周放在一月。仅有空白记录仍显示白色。</p><div id="review-week-tooltip" class="review-week-tooltip" role="tooltip" hidden></div></section>
    ${ui.undoId?`<div class="review-undo" role="status">复盘已移入回收站，可随时恢复。<button type="button" data-restore-review="${esc(ui.undoId)}">撤销删除</button></div>`:''}
    <section><h3>创建 / 定位复盘</h3><form id="review-form" class="toolbar"><label>复盘周期<select name="kind"><option value="week">周复盘</option><option value="month">月复盘</option><option value="year">年复盘</option></select></label><label>所在日期<input type="date" name="date" required value="${today}"></label><button class="primary">打开 / 新建草稿</button></form><div id="review-editor">${reviewEditor(state,ui.draft||selected,Boolean(ui.draft),now)}</div></section>
    <section><div class="section-heading"><h3>${ui.filters.trash?'复盘回收站':'查询复盘'}</h3><button type="button" data-review-trash-toggle>${ui.filters.trash?'返回复盘查询':'查看回收站'}</button></div><form id="review-query-form" class="toolbar review-query"><label>周期<select name="kind">${option('','全部周期',ui.filters.kind)}${['week','month','year'].map(k=>option(k,reviewLabels[k]+'复盘',ui.filters.kind)).join('')}</select></label><label>所在日期<input type="date" name="date" value="${esc(ui.filters.date||'')}"></label><label>关键词<input type="search" name="keyword" value="${esc(ui.filters.keyword||'')}" placeholder="总结内容或日期"></label><label>状态<select name="status">${option('','全部状态',ui.filters.status)}${option('written','已填写',ui.filters.status)}${option('empty','未填写',ui.filters.status)}${option('key','关键复盘',ui.filters.status)}</select></label><button class="primary">查询</button><button type="button" data-review-query-reset>重置</button></form>
    <div id="review-results">${reviewResults(state,ui.filters)}</div><button type="button" id="export-query" ${queryReviews(state.reviews,ui.filters).length?'':'disabled'}>导出查询结果</button> <button type="button" id="export-all">批量导出全部复盘</button></section>`;
}
