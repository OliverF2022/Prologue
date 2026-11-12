import { runningSessions } from './time-model.js';
import { todayTimeCharts } from './time-charts.js';
import { completedTasks, formatDuration, formatElapsed, subtypeNames, todayTasks, stopTimer,
  totalSeconds } from './task-model.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const option = (value, label, selected) => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`;

export function subtypeOptions(state, category) {
  return subtypeNames(state, category).map(s => option(s, s)).join('');
}

function timeDetails(task, today, now) {
  const entries=stopTimer(task,now).timeEntries;
  const sessions=runningSessions(task,now).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
  return `<details class="time-details"><summary>时间段明细 / 手动修改</summary>
    <p class="chart-note">计时器自动保存起止时间，也可手动补记或修改。跨整点与跨天会自动拆分统计。</p>
    <ul class="session-list">${sessions.map(session=>`<li><div><b>${esc(new Date(session.start).toLocaleString('zh-CN'))} — ${esc(new Date(session.end).toLocaleString('zh-CN'))}</b><p>${formatElapsed((Date.parse(session.end)-Date.parse(session.start))/1000)} · ${session.source==='timer'?'计时器':'手动记录'}</p></div>${session.running?'<small>计时中，暂停后可修改</small>':`<button type="button" data-edit-session="${esc(task.id)}" data-session-id="${esc(session.id)}" ${task.activeTimer?'disabled':''}>修改</button><button type="button" data-delete-session="${esc(task.id)}" data-session-id="${esc(session.id)}" ${task.activeTimer?'disabled':''}>删除时段</button>`}</li>`).join('')||'<li>暂无具体时间段。</li>'}</ul>
    <button type="button" data-add-session="${esc(task.id)}" ${task.activeTimer?'disabled':''}>补记时间段</button>
    ${task.activeTimer?'<small>请先暂停计时，再手动修改。</small>':''}
    <details class="daily-totals"><summary>每日累计用时</summary><ul class="time-history">${entries.map(e=>`<li>${e.date}<span>${formatElapsed(e.seconds)}</span></li>`).join('')||'<li>暂无用时。</li>'}</ul></details>
    ${task.untimedEntries.length?`<p class="chart-note">旧版未定位用时：</p><ul class="time-history">${task.untimedEntries.map(e=>`<li>${e.date} · ${formatElapsed(e.seconds)}<button type="button" data-delete-untimed="${esc(task.id)}" data-date="${e.date}">移除旧汇总</button></li>`).join('')}</ul>`:''}
  </details>`;
}

function interruptionHistory(task) {
  if (!task.interruptions.length) return '';
  return `<details class="interruption-history"><summary>中断记录（${task.interruptions.length} 次）</summary><ol>${task.interruptions.map(record => `<li><b>${esc(record.reason)}</b><p>${esc(new Date(record.at).toLocaleString('zh-CN'))} 中断${record.resumedAt ? ` · ${esc(new Date(record.resumedAt).toLocaleString('zh-CN'))} 恢复` : ' · 等待恢复'}</p></li>`).join('')}</ol></details>`;
}

function milestoneFields(task) {
  return `<div class="milestone-fields"><label class="check-label"><input name="milestone" type="checkbox" ${task.milestone ? 'checked' : ''}>标记为里程碑</label>
    <label data-milestone-note ${task.milestone ? '' : 'hidden'}>里程碑备注（选填）<textarea name="milestoneNote" maxlength="1000" rows="2" placeholder="记录这一步为什么值得纪念">${esc(task.milestoneNote || '')}</textarea></label></div>`;
}

function categoryFields(state, task, suffix) {
  return `<label>主类型<select name="category">${state.categories.map(c => option(c, c, task.category)).join('')}</select></label>
    <label>子类型<input name="subtype" list="subtypes-${esc(suffix)}" maxlength="80" value="${esc(task.subtype || '')}" placeholder="选择已有子类型或输入新名称"></label>
    <datalist id="subtypes-${esc(suffix)}" data-subtype-options>${subtypeOptions(state, task.category)}</datalist>`;
}

function progressField(task) {
  return `<label data-progress ${task.kind === 'habit' ? 'hidden' : ''}>任务进度（%）<input name="progress" type="number" min="0" max="100" step="1" required value="${task.done ? 100 : (task.progress || 0)}" ${task.kind === 'habit' || task.status === 'interrupted' ? 'disabled' : ''}></label>`;
}

export function taskCard(task, state, today, now = new Date()) {
  const todaySeconds = stopTimer(task, now).timeEntries.find(e => e.date === today)?.seconds || 0;
  const interrupted = task.status === 'interrupted';
  return `<article class="task" data-task-id="${esc(task.id)}">
    <button type="button" class="completion-toggle" data-${task.done ? 'reopen' : 'complete'}="${esc(task.id)}" ${interrupted ? 'disabled title="请先恢复事项"' : ''} aria-label="${task.done ? '撤销完成' : '完成事项'}：${esc(task.title)}">${task.done ? '✓' : '○'}</button>
    <div class="task-body"><div class="task-heading"><b>${esc(task.title)}</b><span class="status-badge ${interrupted ? 'interrupted' : ''}">${task.done ? '已完成' : interrupted ? '已中断' : task.activeTimer ? '计时中' : '进行中'}</span>${task.milestone ? '<span class="milestone-badge">◆ 里程碑</span>' : ''}</div>
      <p>${esc(task.category)} / ${esc(task.subtype || '未分类')} · ${task.kind === 'habit' ? '打卡' : '普通任务'}</p>
      <p class="time-summary">累计实际用时 <strong data-task-time="${esc(task.id)}">${formatElapsed(totalSeconds(task, now))}</strong> · 今日 <span data-task-today="${esc(task.id)}">${formatElapsed(todaySeconds)}</span></p>
      ${!task.done && task.started < today ? '<p class="rollover">未完成，今日继续可见</p>' : ''}
      ${task.kind !== 'habit' ? `<div class="task-progress"><progress max="100" value="${task.progress}" aria-label="任务进度"></progress><span>${task.progress}%</span></div>` : ''}
      <p>开始日期：<time>${esc(task.started)}</time>${task.done ? ` · 完成日期：<time>${esc(task.done)}</time>` : ''}</p>
      ${interrupted ? `<p class="interruption-reason">中断理由：${esc(task.interruptions.at(-1)?.reason)}</p>` : ''}
      ${!task.done ? `<div class="task-actions">${interrupted ? `<button type="button" data-resume="${esc(task.id)}">恢复事项</button>` : `<button type="button" data-${task.activeTimer ? 'pause-time' : 'start-time'}="${esc(task.id)}">${task.activeTimer ? '暂停计时' : '开始计时'}</button><button type="button" data-interrupt="${esc(task.id)}">中断事项</button>`}</div>` : ''}
      ${task.activeTimer ? '<p class="timer-help">计时会持续到暂停、中断或完成；关闭页面后仍会累计。跨天自动按日拆分。</p>' : ''}
      ${task.milestone && task.milestoneNote ? `<p class="milestone-note">${esc(task.milestoneNote)}</p>` : ''}
      ${timeDetails(task, today, now)}${interruptionHistory(task)}
      <details class="task-editor"><summary>编辑事项${task.kind === 'habit' ? '' : ' / 进度'}</summary>
        <form class="entry-form" data-task-edit="${esc(task.id)}" aria-label="编辑 ${esc(task.title)}">
          <label class="wide">事项名称<input name="title" required maxlength="200" value="${esc(task.title)}"></label>
          ${categoryFields(state, task, task.id)}${progressField(task)}
          <small class="wide">创建当天自动开始，完成当天自动结束。进度填到 100% 即标记完成。</small>${milestoneFields(task)}
          <p class="form-error wide" role="alert"></p><div class="wide"><button class="primary">保存修改</button></div>
        </form>
      </details>
    </div><button type="button" class="delete-task" data-delete="${esc(task.id)}">删除</button>
  </article>`;
}

export function dailyPage(state, today, summary, chartMode='pie') {
  const initial = { category: state.categories[0], kind: 'task', progress: 0 };
  const entries = todayTasks(state.tasks, today);
  return `<p class="lead">把今天的专注，变成明天的积累。</p>${summary}
    <section><h3>添加事项</h3><form id="task-form" class="entry-form">
      <label class="wide">事项名称<input name="title" required maxlength="200" placeholder="今天想完成什么？"></label>
      ${categoryFields(state, initial, 'new')}
      <label>事项类型<select name="kind"><option value="task">普通任务</option><option value="habit">打卡事项</option></select></label>
      <small class="wide">创建当天自动作为开始日期。创建后可以更新进度、计时或中断；未完成事项次日继续可见。</small>
      <p class="form-error wide" role="alert"></p><div class="wide"><button class="primary">添加事项</button></div>
    </form>
    <details class="category-manager"><summary>管理主类型 / 子类型</summary>
      <form id="category-form"><label>新主类型<input name="name" required maxlength="80" placeholder="如：健康"></label><button>添加主类型</button></form>
      <form id="subtype-form"><label>所属主类型<select name="category">${state.categories.map(c => option(c, c)).join('')}</select></label><label>新子类型<input name="name" required maxlength="80" placeholder="如：项目开发、阅读"></label><button>添加子类型</button></form>
      <p>${state.categories.map(c => `${esc(c)}：${subtypeNames(state, c).map(esc).join('、') || '暂无子类型'}`).join('； ')}</p>
    </details></section>
    <section id="today-time-charts">${todayTimeCharts(state.tasks,today,chartMode)}</section>
    <h3>今日与待办 <small>${entries.length} 项</small></h3>
    ${entries.map(t => taskCard(t, state, today)).join('') || '<section class="empty-state">今天还没有事项，开始记录吧。</section>'}`;
}

export function completedPage(state, filters, today) {
  const categories = state.categories;
  const subtypes = filters.category ? subtypeNames(state, filters.category)
    : [...new Set(categories.flatMap(c => subtypeNames(state, c)))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const matches = completedTasks(state.tasks, filters);
  const total = Math.floor(matches.reduce((sum, t) => sum + totalSeconds(t), 0) / 60);
  const groups = categories.map(category => {
    const entries = matches.filter(t => t.category === category);
    return entries.length ? `<section class="completed-group"><h3>${esc(category)} <small>${entries.length} 项</small></h3>${entries.map(t => taskCard(t, state, today)).join('')}</section>` : '';
  }).join('');
  return `<p class="lead">按完成月份，回看每一份积累。</p>
    <section class="filter-panel"><div class="toolbar">
      <label>完成月份<input id="completed-month" type="month" required value="${esc(filters.month)}"></label>
      <label>主类型<select id="completed-category">${option('', '全部主类型', filters.category)}${categories.map(c => option(c, c, filters.category)).join('')}</select></label>
      <label>子类型<select id="completed-subtype">${option('', '全部子类型', filters.subtype)}${option('__uncategorized__', '未分类', filters.subtype)}${subtypes.map(s => option(s, s, filters.subtype)).join('')}</select></label>
      <label class="check-label"><input type="checkbox" id="only-milestones" ${filters.milestones ? 'checked' : ''}>仅看里程碑</label>
      <button type="button" id="reset-completed">重置筛选</button></div>
      <p class="filter-summary" role="status">共 ${matches.length} 项 · 实际耗时 ${formatDuration(total)} · ${matches.filter(t => t.milestone).length} 个里程碑</p>
      <small>按完成日期归属月份，列表显示事项累计用时；统计页面按实际投入日期计算。</small></section>
    ${groups || '<section class="empty-state">当前筛选条件下没有已完成事项，可调整月份或类型。</section>'}`;
}

export function completionDialog(task, today) {
  return `<dialog id="completion-dialog" aria-labelledby="completion-title"><h3 id="completion-title">完成事项 · ${esc(task.title)}</h3>
    <p>开始日期 ${esc(task.started)} · 完成日期 ${today}</p><p>累计实际用时 <strong data-task-time="${esc(task.id)}">${formatElapsed(totalSeconds(task))}</strong>。完成后自动停止计时。</p>
    <form class="entry-form" data-completion="${esc(task.id)}">
      ${milestoneFields(task)}
      <p class="form-error wide" role="alert"></p><div class="dialog-actions wide"><button type="button" data-cancel-completion>取消</button><button class="primary">确认完成</button></div>
    </form></dialog>`;
}

export function interruptionDialog(task) {
  return `<dialog id="interruption-dialog" aria-labelledby="interruption-title"><h3 id="interruption-title">中断事项 · ${esc(task.title)}</h3>
    <p>中断会停止计时，保留已有进度和用时。之后可以恢复。</p>
    <form data-interruption="${esc(task.id)}"><label>中断理由（必填）<textarea name="reason" maxlength="1000" required placeholder="说明为什么需要中断"></textarea></label>
      <p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-cancel-interruption>取消</button><button class="primary">确认中断</button></div></form></dialog>`;
}

function localInput(value) {
  const d=new Date(value),pad=v=>String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function sessionDialog(task, session, now=new Date()) {
  const last=task.done?Math.min(new Date(task.done+'T23:59:59').getTime(),now.getTime()):now.getTime();
  const first=Math.max(new Date(task.started+'T00:00:00').getTime(),last-30*60*1000);
  return `<dialog id="session-dialog" aria-labelledby="session-title"><h3 id="session-title">${session?'修改':'补记'}时间段 · ${esc(task.title)}</h3>
    <p class="chart-note">使用本机时间。时长根据起止时间自动计算；时段不能重叠，也不能晚于当前时间。</p>
    <form class="entry-form" data-session-form="${esc(task.id)}" data-session-id="${esc(session?.id||'')}">
      <label>开始时间<input type="datetime-local" name="start" required step="1" value="${localInput(session?.start||first)}"></label>
      <label>结束时间<input type="datetime-local" name="end" required step="1" value="${localInput(session?.end||last)}"></label>
      <p class="form-error wide" role="alert"></p><div class="dialog-actions wide"><button type="button" data-cancel-session>取消</button><button class="primary">保存时间段</button></div>
    </form></dialog>`;
}

export function timerBanner(state) {
  const task = state.tasks.find(t => t.activeTimer);
  return task ? `<div class="timer-banner" role="status"><span>正在计时：${esc(task.title)} · 累计 <strong data-task-time="${esc(task.id)}">${formatElapsed(totalSeconds(task))}</strong></span><button type="button" data-pause-time="${esc(task.id)}">暂停计时</button></div>` : '';
}

export const hourOptions = `<datalist id="hour-options">${[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24].map(h => option(String(h), String(h))).join('')}</datalist>`;
