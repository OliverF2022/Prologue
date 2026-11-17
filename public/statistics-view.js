import {timeReport,filterStatisticsTasks,periodOutcomes,statisticsTimeDetails} from './time-analytics.js';
import {formatElapsed,subtypeNames,periodStats} from './task-model.js';
import {barChart} from './time-charts.js';
import {esc} from './task-view.js';

const colors=['#657f59','#668fa3','#bf9551','#9a7ba6','#b86f67','#4a9690','#8a9150','#b87e9d'];
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const weekday=date=>['周日','周一','周二','周三','周四','周五','周六'][new Date(date+'T12:00:00').getDay()];
const hourLabel=h=>`${String(h).padStart(2,'0')}:00–${String(h+1).padStart(2,'0')}:00`;

export function heatmap(report,now=new Date()){
  let first=true;
  const rows=report.days.map((day,row)=>`<div role="row" class="heat-row"><span role="rowheader" class="heat-date">${day.date.slice(5)} ${weekday(day.date)}</span>${day.hours.map((seconds,hour)=>{
    const time=new Date(day.date+'T00:00:00');time.setHours(hour);
    const future=time>now,tab=first&&!future?0:-1;if(tab===0)first=false;
    const label=day.date+' '+weekday(day.date)+' '+hourLabel(hour)+' · '+(future?'尚未到来':seconds?'已记录 '+formatElapsed(seconds):'无记录');
    const level=seconds<=0?0:Math.min(4,Math.ceil(seconds/900));
    return `<button type="button" role="gridcell" class="heat-cell heat-level-${level}${future?' heat-future':''}" tabindex="${tab}" ${future?'disabled':''} data-cell-index="${row*24+hour}" data-heat-date="${day.date}" data-heat-hour="${hour}" aria-label="${esc(label)}" title="${esc(label)}">${future?'—':seconds?(seconds<60?'&lt;1':Math.round(seconds/60)):''}</button>`;
  }).join('')}</div>`).join('');
  return `<h3>日期 × 小时投入热力图</h3><p class="chart-note">每格为该小时已记录分钟数，颜色越深投入越多。点击查看任务和起止时间；无记录不代表休息。键盘可用方向键移动、回车查看。</p>
    <div class="heat-scroll"><div class="time-heatmap" role="grid" aria-label="日期与小时的实际投入，单位分钟"><div role="row" class="heat-row heat-header"><span role="columnheader">日期</span>${Array.from({length:24},(_,h)=>`<span role="columnheader">${String(h).padStart(2,'0')}</span>`).join('')}</div>${rows}</div></div>
    <div class="heat-legend"><span>无记录</span>${[0,1,2,3,4].map(level=>`<i class="heat-level-${level}" aria-hidden="true"></i>`).join('')}<span>60 分钟</span><span>— 尚未到来</span></div>`;
}

export function outcomeCards(tasks,kind,date,now=new Date()){
  const r=timeReport(tasks,kind,date,now),out=periodOutcomes(tasks,kind,date),cohort=periodStats(tasks,kind,date,now);
  return `<div class="metrics statistics-metrics"><article><small>本周期投入</small><strong data-stat-total>${formatElapsed(r.total)}</strong><span>包含未完成事项</span></article>
    <article><button type="button" class="outcome-summary" data-stat-outcome="completed"><small>本期完成事项</small><strong>${out.completed.length}</strong><span>普通任务 ${out.ordinary} · 打卡 ${out.checkins} · 查看明细</span></button></article>
    <article><button type="button" class="outcome-summary" data-stat-outcome="milestones"><small>本期完成里程碑</small><strong>${out.milestones.length}</strong><span>按完成日期统计 · 查看备注</span></button></article>
    <article><button type="button" class="outcome-summary" data-stat-outcome="interruptions"><small>本期中断次数</small><strong>${out.interruptions.length}</strong><span>按发生日期统计 · 查看记录</span></button></article></div>
    <p class="chart-note">本期开始事项的当前完成率：${cohort.tasks?Math.round(cohort.done/cohort.tasks*100)+'%（'+cohort.done+' / '+cohort.tasks+' 项，含打卡）':'暂无本期开始的事项'}。上方完成成果按完成日期统计。</p>`;
}

export function statisticsCharts(tasks,categories,kind,date,now=new Date()){
  const r=timeReport(tasks,kind,date,now);
  const series=categories.filter(category=>r.tasks.some(t=>t.category===category)).map(category=>({category,color:colors[categories.indexOf(category)%colors.length]}));
  let rows=r.days.map((day,i)=>({label:kind==='week'?['周一','周二','周三','周四','周五','周六','周日'][i]:day.date.slice(-2),date:day.date,fullLabel:day.date+' '+weekday(day.date),seconds:day.seconds,
    values:series.map(s=>({...s,label:s.category,seconds:day.categories.find(c=>c.category===s.category)?.seconds||0,
      taskCount:day.categories.find(c=>c.category===s.category)?.taskCount||0}))}));
  if(kind==='year')rows=Array.from({length:12},(_,i)=>{
    const month=r.start.slice(0,4)+'-'+String(i+1).padStart(2,'0');
    const days=r.days.filter(d=>d.date.startsWith(month));
    return {label:`${i+1}月`,fullLabel:month,date:month+'-01',scope:'month',seconds:days.reduce((s,d)=>s+d.seconds,0),values:series.map(s=>({...s,label:s.category,
      seconds:days.reduce((sum,d)=>sum+(d.categories.find(c=>c.category===s.category)?.seconds||0),0)}))};
  });
  return `${kind==='year'?'<p class="chart-note">年视图按月查看投入构成；切换到周或月可查看日期×小时热力图。</p>':heatmap(r,now)}
    <h3 class="statistics-chart-heading">${kind==='year'?'每月':'每日'}投入构成</h3><p class="chart-note">按主类型堆叠，悬停查看时长和占比；点击色块查看具体事项。颜色在不同筛选下保持一致。</p>
    <ul class="chart-legend">${series.map(s=>`<li><i style="background:${s.color}"></i><span>${esc(s.category)}</span></li>`).join('')}</ul>
    ${barChart(rows,kind==='year'?'每月分类投入时间':'每日分类投入时间',true)}
    <details class="hourly-reference"><summary>查看每小时累计投入</summary><p class="chart-note">同一小时段在所选周期的所有日期累加，单位分钟，可超过 60 分钟。</p>${barChart(r.hours.map((seconds,h)=>({label:String(h).padStart(2,'0'),fullLabel:hourLabel(h),seconds})),'所选周期各小时段累计用时')}</details>
    ${r.untimed?`<p class="chart-note">旧版未定位用时 ${formatElapsed(r.untimed)} 已计入投入构成，未归入小时热力图。</p>`:''}`;
}

export function statisticsPage(state,kind,date,filters,now=new Date()){
  const tasks=filterStatisticsTasks(state.tasks,filters),r=timeReport(tasks,kind,date,now);
  const subtypes=filters.category?subtypeNames(state,filters.category):[...new Set(state.categories.flatMap(c=>subtypeNames(state,c)))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  return `<div class="toolbar statistics-controls"><label>周期<select id="period">${option('week','周',kind)}${option('month','月',kind)}${option('year','年',kind)}</select></label>
    <label>所在日期<input id="anchor" type="date" value="${date}" required></label>
    <label>主类型<select id="statistics-category">${option('','全部主类型',filters.category)}${state.categories.map(c=>option(c,c,filters.category)).join('')}</select></label>
    <label>子类型<select id="statistics-subtype">${option('','全部子类型',filters.subtype)}${option('__uncategorized__','未分类',filters.subtype)}${subtypes.map(c=>option(c,c,filters.subtype)).join('')}</select></label></div>
    <p class="chart-note">${r.start} 至 ${r.end}（结束日期不含） · 图表与成果概览使用同一分类筛选。</p>
    <div id="statistics-outcomes">${outcomeCards(tasks,kind,date,now)}</div>
    <section id="period-time-charts">${statisticsCharts(tasks,state.categories,kind,date,now)}</section>`;
}

export function statisticsDialog(tasks,kind,date,selection,now=new Date()){
  let title='',content='';
  if(selection.type==='outcome'){
    const out=periodOutcomes(tasks,kind,date),labels={completed:'本期完成事项',milestones:'本期完成里程碑',interruptions:'本期中断记录'};
    title=labels[selection.outcome];
    const rows=selection.outcome==='interruptions'?out.interruptions:out[selection.outcome].map(task=>({task}));
    content=rows.length?`<div class="table-scroll"><table><thead><tr><th>事项</th><th>类型</th><th>日期</th><th>备注 / 记录</th></tr></thead><tbody>${rows.map(({task,record})=>`<tr><td>${esc(task.title)}</td><td>${esc(task.category)} / ${esc(task.subtype||'未分类')}</td><td>${record?esc(new Date(record.at).toLocaleString('zh-CN')):esc(task.done)}</td><td>${esc(record?record.reason:task.milestoneNote||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-chart">本周期当前筛选下暂无记录。</p>';
  } else {
    const rows=statisticsTimeDetails(tasks,selection,now);
    title=selection.date+(selection.type==='hour'?' '+hourLabel(selection.hour):'')+(selection.category?' · '+selection.category:'');
    content=`<p>所选区间投入 ${formatElapsed(rows.reduce((s,r)=>s+r.seconds,0))}</p>`+(rows.length?`<div class="table-scroll"><table><thead><tr><th>事项 / 类型</th><th>区间内起止时间</th><th>用时</th><th>来源</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}<br><small>${esc(r.category)} / ${esc(r.subtype||'未分类')}</small></td><td>${r.untimed?esc(r.date)+'（未定位）':esc(new Date(r.start).toLocaleString('zh-CN'))+' — '+esc(new Date(r.end).toLocaleString('zh-CN'))}</td><td>${formatElapsed(r.seconds)}</td><td>${r.untimed?'旧版汇总':r.source==='timer'?'计时器':'手动'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-chart">此区间无已记录时段；无记录不代表休息或没有投入。</p>');
  }
  return `<dialog id="statistics-detail-dialog" class="statistics-dialog" aria-labelledby="statistics-detail-title"><div class="section-heading"><h3 id="statistics-detail-title">${esc(title)}</h3><button type="button" data-close-statistics>关闭</button></div>${content}</dialog>`;
}
