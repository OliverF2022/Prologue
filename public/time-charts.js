import { timeReport, dayBudget } from './time-analytics.js';
import { formatElapsed } from './task-model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = ['#657f59','#668fa3','#bf9551','#9a7ba6','#b86f67','#4a9690','#8a9150','#b87e9d'];
const hourLabel = h => `${String(h).padStart(2,'0')}:00–${String(h+1).padStart(2,'0')}:00`;
const timeLabel = (value,date) => (value.slice(0,10)===date?'':'') + new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

function legend(items) {
  return `<ul class="chart-legend">${items.map(item=>`<li><i style="background:${item.color}"></i><span>${esc(item.label)}</span>${item.seconds!==undefined?`<b>${formatElapsed(item.seconds)}</b>`:''}</li>`).join('')}</ul>`;
}

export function barChart(rows, title, stacked = false) {
  const width=960,height=255,left=56,bottom=210,top=20,plotHeight=bottom-top,slot=(width-left-14)/rows.length;
  const max=Math.max(0,...rows.map(r=>r.seconds/60));
  const step=max<=4?1:Math.ceil(max/4/5)*5,maximum=step*4;
  const grid=Array.from({length:5},(_,i)=>{
    const value=i*step,y=bottom-value/maximum*plotHeight;
    return `<line x1="${left}" x2="946" y1="${y}" y2="${y}" stroke="#e5e9e0"/><text x="${left-9}" y="${y+4}" text-anchor="end">${value}</text>`;
  }).join('');
  const bars=rows.map((row,i)=>{
    const x=left+i*slot+slot*.16,w=slot*.68;
    let offset=0;
    const series=stacked?row.values:[{seconds:row.seconds,color:'#718b63',label:row.label}];
    const rects=series.map(value=>{
      const h=value.seconds/60/maximum*plotHeight,y=bottom-offset-h;offset+=h;
      return value.seconds>0?`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${value.color}" rx="2" tabindex="0" role="img" aria-label="${esc(row.label+' '+value.label+' '+formatElapsed(value.seconds))}"><title>${esc(row.label+' · '+value.label+'：'+formatElapsed(value.seconds))}</title></rect>`:'';
    }).join('');
    return `${rects}<text x="${left+(i+.5)*slot}" y="${bottom+21}" text-anchor="middle">${esc(row.label)}</text>`;
  }).join('');
  return `<div class="bar-scroll" tabindex="0" aria-label="${esc(title)}，可横向滚动"><svg class="time-bar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><text x="12" y="12">分钟</text>${grid}${bars}</svg></div>
    <details class="chart-data"><summary>查看图表数据</summary><table><thead><tr><th>时间</th><th>累计投入</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.fullLabel||r.label)}</td><td>${formatElapsed(r.seconds)}</td></tr>`).join('')}</tbody></table></details>`;
}

function pieChart(items,total,recorded) {
  let offset=0;
  const circles=items.filter(item=>item.seconds>0).map(item=>{
    const percent=item.seconds/total*100;
    const circle=`<circle cx="112" cy="112" r="78" fill="none" stroke="${item.color}" stroke-width="35" pathLength="100" stroke-dasharray="${percent} ${100-percent}" stroke-dashoffset="${-offset}" transform="rotate(-90 112 112)" role="img" aria-label="${esc(item.label+' '+formatElapsed(item.seconds))}"><title>${esc(item.label+'：'+formatElapsed(item.seconds)+'（'+(percent).toFixed(1)+'%）')}</title></circle>`;
    offset+=percent;return circle;
  }).join('');
  return `<div class="pie-layout"><svg viewBox="0 0 224 224" class="time-pie" role="img" aria-label="今日任务、其他未记录时间与未来时间占比"><title>今日时间分配</title>${circles}<text x="112" y="102" text-anchor="middle" class="pie-caption">已记录</text><text x="112" y="130" text-anchor="middle" class="pie-value">${Math.floor(recorded/60)} 分钟</text></svg>${legend(items)}</div>`;
}

export function todayTimeCharts(tasks,date,mode='pie',now=new Date()) {
  const r=timeReport(tasks,'day',date,now),budget=dayBudget(r,date,now);
  const taskItems=r.tasks.filter(t=>t.positioned>0).map(t=>({id:t.id,label:t.title,seconds:t.positioned,color:colors[Math.max(0,tasks.findIndex(a=>a.id===t.id))%colors.length]}));
  const items=[...taskItems,{label:'其他（已过去但未记录）',seconds:budget.other,color:'#c5cbbf'},
    {label:'尚未到来',seconds:budget.future,color:'#edf0e9'}];
  const rows=r.hours.map((seconds,hour)=>({label:String(hour).padStart(2,'0'),fullLabel:hourLabel(hour),seconds,
    values:taskItems.map(item=>({label:item.label,color:item.color,seconds:r.tasks.find(t=>t.id===item.id).hours[hour]}))}));
  return `<div class="section-heading"><h3>今日时间分配</h3><div class="chart-switch" role="group" aria-label="今日图表类型"><button type="button" data-day-chart="pie" aria-pressed="${mode==='pie'}" class="${mode==='pie'?'active':''}">饼状图</button><button type="button" data-day-chart="bar" aria-pressed="${mode==='bar'}" class="${mode==='bar'?'active':''}">柱状图</button></div></div>
    <p class="chart-note">${date} · 按本机时间统计。“其他”只包含已经过去的未记录时间。</p>
    ${mode==='pie'?pieChart(items,budget.available,r.positioned):barChart(rows,'今日每小时各任务投入（分钟）',true)+legend(taskItems)}
    ${r.untimed?`<p class="chart-note">另有旧版未定位用时 ${formatElapsed(r.untimed)}，未纳入饼图及小时分布。</p>`:''}
    <h4>实际执行时间段</h4>${r.timeline.length?`<div class="table-scroll"><table class="timeline-table"><thead><tr><th>事项</th><th>时间段</th><th>实际用时</th><th>来源</th><th>操作</th></tr></thead><tbody>${r.timeline.map(t=>`<tr><td>${esc(t.title)}</td><td>${timeLabel(t.start,date)}–${timeLabel(t.end,date)}</td><td>${formatElapsed(t.seconds)}</td><td>${t.source==='timer'?'计时器':'手动'}</td><td>${tasks.find(task=>task.id===t.taskId)?.activeTimer?'<small>计时中</small>':`<button type="button" data-edit-session="${esc(t.taskId)}" data-session-id="${esc(t.sessionId)}">修改时段</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-chart">今天还没有时间段。可在事项中开始计时或补记起止时间。</p>'}`;
}

export function periodTimeCharts(tasks,kind,date,now=new Date()) {
  const r=timeReport(tasks,kind,date,now);
  const hourly=r.hours.map((seconds,h)=>({label:String(h).padStart(2,'0'),fullLabel:hourLabel(h),seconds}));
  let daily=r.days.map((day,i)=>({label:kind==='week'?['周一','周二','周三','周四','周五','周六','周日'][i]:day.date.slice(-2),fullLabel:day.date,seconds:day.seconds}));
  if(kind==='year') daily=Array.from({length:12},(_,i)=>({label:`${i+1}月`,seconds:r.days.filter(d=>Number(d.date.slice(5,7))===i+1).reduce((s,d)=>s+d.seconds,0)}));
  return `<h3>各小时段累计投入</h3><p class="chart-note">横轴 00–23 表示一天中的每个小时段；纵轴为所选周期内该小时段的累计分钟数，可超过 60 分钟。</p>${barChart(hourly,'所选周期各小时段累计用时')}
    <h3>${kind==='year'?'每月':'每日'}投入时间</h3><p class="chart-note">${kind==='week'?'周一至周日':kind==='month'?'按本月每天排列':'按本年每月排列'}，包含未完成事项的实际投入。</p>${barChart(daily,'所选周期每日投入时间')}
    ${r.untimed?`<p class="chart-note">旧版未定位用时 ${formatElapsed(r.untimed)} 已计入每日投入，未归入小时段。</p>`:''}`;
}
