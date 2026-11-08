import { completedTasks, formatDuration, subtypeNames } from './task-model.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const option = (value, label, selected) => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`;

export function subtypeOptions(state, category) {
  return subtypeNames(state, category).map(s => option(s, s)).join('');
}

function durationFields(minutes = 30) {
  return `<fieldset class="duration-fields"><legend>实际耗时</legend>
    <div class="duration-inputs"><label>小时<input name="hours" type="number" list="hour-options" min="0" max="10000" step="1" required value="${Math.floor(minutes / 60)}"></label>
    <label>分钟<select name="minutes">${Array.from({ length: 60 }, (_, i) => option(String(i), String(i), String(minutes % 60))).join('')}</select></label></div>
    <small>小时可选择或手填，分钟可选择。按实际累计投入填写。</small></fieldset>`;
}

function executionFields(task, today) {
  return `<label>执行开始日期<input type="date" name="started" max="${today}" value="${esc(task.started || '')}" ${task.done ? 'required' : ''}></label>
    <label class="check-label"><input type="checkbox" name="completed" ${task.done ? 'checked' : ''}>已完成</label>
    <label data-finish ${task.done ? '' : 'hidden'}>完成日期<input type="date" name="done" max="${today}" value="${esc(task.done || today)}" ${task.done ? 'required' : 'disabled'}></label>`;
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
  return `<label data-progress ${task.kind === 'habit' ? 'hidden' : ''}>任务进度（%）<input name="progress" type="number" min="0" max="100" step="1" required value="${task.done ? 100 : (task.progress || 0)}" ${task.kind === 'habit' ? 'disabled' : ''}></label>`;
}

export function taskCard(task, state, today) {
  return `<article class="task" data-task-id="${esc(task.id)}">
    <button type="button" class="completion-toggle" data-${task.done ? 'reopen' : 'complete'}="${esc(task.id)}" aria-label="${task.done ? '撤销完成' : '完成事项'}：${esc(task.title)}">${task.done ? '✓' : '○'}</button>
    <div class="task-body"><div class="task-heading"><b>${esc(task.title)}</b>${task.milestone ? '<span class="milestone-badge">◆ 里程碑</span>' : ''}</div>
      <p>${esc(task.category)} / ${esc(task.subtype || '未分类')} · ${task.kind === 'habit' ? '打卡' : '普通任务'} · ${task.done ? '实际耗时' : '已记录耗时'} ${formatDuration(task.minutes)}</p>
      ${!task.done && task.date < today ? `<p class="rollover">顺延自 ${esc(task.date)}</p>` : ''}
      ${task.kind !== 'habit' ? `<div class="task-progress"><progress max="100" value="${task.progress}" aria-label="任务进度"></progress><span>${task.progress}%</span></div>` : ''}
      ${task.done ? `<p>执行日期：<time>${esc(task.started)}</time> 至 <time>${esc(task.done)}</time></p>` : ''}
      ${task.milestone && task.milestoneNote ? `<p class="milestone-note">${esc(task.milestoneNote)}</p>` : ''}
      <details class="task-editor"><summary>编辑事项${task.kind === 'habit' ? '' : ' / 进度'}</summary>
        <form class="entry-form" data-task-edit="${esc(task.id)}" aria-label="编辑 ${esc(task.title)}">
          <label class="wide">事项名称<input name="title" required maxlength="200" value="${esc(task.title)}"></label>
          ${categoryFields(state, task, task.id)}${progressField(task)}
          ${executionFields(task, today)}${durationFields(task.minutes)}${milestoneFields(task)}
          <p class="form-error wide" role="alert"></p><div class="wide"><button class="primary">保存修改</button></div>
        </form>
      </details>
    </div><button type="button" class="delete-task" data-delete="${esc(task.id)}">删除</button>
  </article>`;
}

export function dailyPage(state, today, summary) {
  const initial = { category: state.categories[0], kind: 'task', progress: 0 };
  const entries = state.tasks.filter(t => t.date <= today && (!t.done || t.done === today));
  return `<p class="lead">把今天的专注，变成明天的积累。</p>${summary}
    <section><h3>添加事项</h3><form id="task-form" class="entry-form">
      <label class="wide">事项名称<input name="title" required maxlength="200" placeholder="今天想完成什么？"></label>
      ${categoryFields(state, initial, 'new')}
      <label>事项类型<select name="kind"><option value="task">普通任务</option><option value="habit">打卡事项</option></select></label>
      <label>计划日期<input type="date" name="date" value="${today}" required></label>
      ${progressField(initial)}${executionFields(initial, today)}${durationFields()}${milestoneFields(initial)}
      <p class="form-error wide" role="alert"></p><div class="wide"><button class="primary">添加事项</button></div>
    </form>
    <details class="category-manager"><summary>管理主类型 / 子类型</summary>
      <form id="category-form"><label>新主类型<input name="name" required maxlength="80" placeholder="如：健康"></label><button>添加主类型</button></form>
      <form id="subtype-form"><label>所属主类型<select name="category">${state.categories.map(c => option(c, c)).join('')}</select></label><label>新子类型<input name="name" required maxlength="80" placeholder="如：项目开发、阅读"></label><button>添加子类型</button></form>
      <p>${state.categories.map(c => `${esc(c)}：${subtypeNames(state, c).map(esc).join('、') || '暂无子类型'}`).join('； ')}</p>
    </details></section>
    <h3>今日与待办 <small>${entries.length} 项</small></h3>
    ${entries.map(t => taskCard(t, state, today)).join('') || '<section class="empty-state">今天还没有事项，开始记录吧。</section>'}`;
}

export function completedPage(state, filters, today) {
  const categories = state.categories;
  const subtypes = filters.category ? subtypeNames(state, filters.category)
    : [...new Set(categories.flatMap(c => subtypeNames(state, c)))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const matches = completedTasks(state.tasks, filters);
  const total = matches.reduce((sum, t) => sum + t.minutes, 0);
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
      <small>按完成日期归属月份；跨月任务的实际耗时计入完成月。</small></section>
    ${groups || '<section class="empty-state">当前筛选条件下没有已完成事项，可调整月份或类型。</section>'}`;
}

export function completionDialog(task, today) {
  const started = task.started || (task.date < today ? task.date : today);
  return `<dialog id="completion-dialog" aria-labelledby="completion-title"><h3 id="completion-title">完成事项 · ${esc(task.title)}</h3>
    <p>确认执行日期与实际耗时，记录这一步成果。</p>
    <form class="entry-form" data-completion="${esc(task.id)}">
      <input name="completed" type="hidden" value="on">
      <label>执行开始日期<input name="started" type="date" required max="${today}" value="${esc(started)}"></label>
      <label>完成日期<input name="done" type="date" required max="${today}" value="${today}"></label>
      ${durationFields(task.minutes)}${milestoneFields(task)}
      <p class="form-error wide" role="alert"></p><div class="dialog-actions wide"><button type="button" data-cancel-completion>取消</button><button class="primary">确认完成</button></div>
    </form></dialog>`;
}

export const hourOptions = `<datalist id="hour-options">${[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 48, 72, 100].map(h => option(String(h), String(h))).join('')}</datalist>`;
