# 具体时间段与统计

创建事项后点击“开始计时”，暂停、中断、完成或切换任务时保存起止时间。刷新页面或重启服务仍可还原运行中计时。也可在事项的“时间段明细 / 手动修改”中补记、修改或删除时段；今日时段清单也提供修改入口。

时间使用本机时区，区间为左闭右开，例如 09:00–10:00 与 10:00–11:00 可以相邻。任何事项之间的重叠都被拒绝，避免同一时段重复计算。手动记录不能早于事项开始日期，不能超出完成日期，不能延伸到未来；正在计时的事项需先暂停才能修改时段。

## 图表口径

- 今日饼图：任务的已定位用时 + 已过去但未记录的“其他时间” + “尚未到来”，合计覆盖全天。旧版仅有总量的用时无法推断具体小时，单独提示，不编造时间位置。
- 今日柱状图：00–23 每小时按任务堆叠，显示该小时实际投入；下方清单展示每项任务的起止时间、时长与来源。
- 周／月小时分布：按所选周期，把所有日期落在同一小时段的时间相加。比如周一 09:30–10:15、周二 09:00–10:00，则 09–10 时共 90 分钟，10–11 时共 15 分钟。
- 每日柱状图：周按周一至周日排列，月按当月每个日期排列，零投入日期保留。年视图按 12 个月显示投入。
- 跨午夜、跨月的时间分别计入实际所在日期，未完成事项同样参与统计。高投入小时代表记录的投入集中程度，图表不直接评判任务产出效率。
- 周／月复盘：自动生成总投入、各任务用时、最高投入小时段、小时分布与每日用时的文字概述，保留手写总结。单篇和批量 Markdown 导出均包含这些文字。
- 图形以分钟为轴，底层保留秒；文字显示小时、分钟、秒。零数据仍显示完整日期轴和空状态。

## 数据结构与兼容

`sessions: [{id,start,end,source}]` 保存 ISO 起止时间及 timer/manual 来源。`activeTimer` 是运行中起点。每日 `timeEntries` 和兼容字段 `minutes` 从具体时段与 `untimedEntries` 重新计算，修改同一时段不会重复累计。

旧版本的日总量保留到 `untimedEntries`，不推测原始时段。未定位总量参与总投入和每日图表，但不参与小时分布；在时段明细中可移除旧汇总再补录真实时段。重置后新记录均采用具体时段。

数据包含 `generation` 标识。重新初始化会更新标识；旧页面写入将被拒绝并提示刷新，防止旧记录重新覆盖空白数据。

## 重新安装并从空白开始

在管理员 PowerShell 中执行：

```powershell
Set-Location D:\proj\myown\Prologue
.\scripts\windows-service.ps1 -Action Reinstall -ResetData
```

脚本停止服务、将原 `data/store.json` 复制到 `D:\dev\services\Prologue\backups` 并验证 SHA256，然后原子写入空白数据并重新安装、启动服务。任务、复盘、自建主类型和子类型清空，恢复工作、学习、生活三个默认类型。备份文件不进入 Git。仅执行 `Reinstall` 而不传 `ResetData` 时保留数据。

## English

Timers and manual records store exact start/end intervals. Overlaps across tasks and future intervals are rejected; adjacent intervals are valid. Hour/day/month boundaries split elapsed time exactly in local time.

Today shows per-task pie allocation (with elapsed unrecorded time and future time separated), stacked hourly bars, and an interval table. Weekly/monthly analytics show cumulative hourly distribution and daily totals with complete date axes. Weekly/monthly review text and Markdown exports include task, hourly, and daily statistics alongside your own reflection.

Legacy totals are retained without inventing hourly placement. `Reinstall -ResetData` backs up the old store, resets records and custom categories, and reinstalls the service. Refresh open pages after reset; an old data-generation token cannot overwrite the new blank store.
