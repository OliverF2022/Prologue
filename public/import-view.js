import {esc} from './task-view.js';
import {formatElapsed} from './task-model.js';
const labels={added:'新增',updated:'更新',merged:'合并时段',duplicate:'重复 / 旧版本',skipped:'跳过',conflict:'冲突'};
export function importPage(state,ui){
 const preview=ui.preview;
 return `<section><h3>导入便携客户端记录</h3><p class="capture-import-note">选择客户端导出的 .prologue.json 数据包。导入后参与现有用时、完成和打卡统计；每日记录不会顺延成以后的待办。同名事项默认分别保留。</p><p><a href="/downloads/Prologue-Capture-win-x64-1.0.0.zip" download>下载 Windows 便携客户端（ZIP）</a></p>
 <label class="import-file-label">选择数据包<input id="task-import-file" type="file" accept=".json,.prologue.json,application/json"></label>${ui.fileName?`<p>已选择：${esc(ui.fileName)}</p>`:''}
 ${ui.result?`<p class="import-result" role="status">导入完成：新增 ${ui.result.added} 项、更新 ${ui.result.updated} 项、合并 ${ui.result.merged} 项；重复 ${ui.result.duplicate} 项、跳过 ${ui.result.skipped} 项。</p>`:''}
 ${ui.error?`<p class="form-error" role="alert">${esc(ui.error)}</p>`:''}
 ${ui.packet?'<button type="button" id="preview-task-import">重新预览</button>':''}</section>
 ${preview?`<section><h3>导入预览</h3><p>来源：${esc(preview.device.name)} · 工作日 ${esc(preview.workDate)}</p><p class="chart-note">来源时区 ${esc(preview.device.timeZone)}；小时分布按本机时区 ${esc(preview.timeZone)} 计算，原始时间戳保持不变。</p>
 <div class="import-counts">${Object.entries(preview.counts).map(([key,count])=>`<span>${labels[key]} <b>${count}</b></span>`).join('')}</div><div class="table-scroll"><table class="import-table"><thead><tr><th>事项 / 用时</th><th>处理方式</th><th>预览结果</th></tr></thead><tbody>${preview.rows.map(r=>{
  const choice=ui.choices[r.key]||{};
  return `<tr><td><b>${esc(r.title)}</b><br><small>${esc(r.category)} · ${formatElapsed(r.seconds)}</small></td><td><label><input type="checkbox" data-import-skip="${esc(r.key)}" ${choice.skip?'checked':''}>跳过此事项</label><select data-import-target="${esc(r.key)}" ${r.lockedTarget?'disabled title="已导入的事项沿用原关联，不重新分配"':''} aria-label="${esc(r.title)} 的导入目标"><option value="">保留为独立的当日事项</option>${state.tasks.map(t=>`<option value="${esc(t.id)}" ${choice.targetId===t.id?'selected':''}>合并时段到：${esc(t.title)}</option>`).join('')}</select></td><td><span class="import-status ${r.status}">${labels[r.status]}</span><p>${esc(r.message)}</p></td></tr>`;
 }).join('')}</tbody></table></div><p class="chart-note">合并到已有事项只导入时间段，保留主程序的进度与完成状态。冲突不会静默覆盖或重复计时；可先修正原时段，或勾选跳过后重新预览。</p><button type="button" id="commit-task-import" class="primary" ${preview.canImport&&!ui.dirty?'':'disabled'}>确认导入</button>${ui.dirty?'<p class="chart-note">选择已改变，请重新预览后再导入。</p>':''}</section>`:''}`;
}
