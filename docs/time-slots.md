# 具体时间段与统计

创建事项后点击“开始计时”，暂停、中断、完成或切换任务时保存起止时间。刷新页面或重启服务仍可还原运行中计时。也可在事项的“时间段明细 / 手动修改”中补记、修改或删除时段；今日时段清单也提供修改入口。

时间使用本机时区，区间为左闭右开，例如 09:00–10:00 与 10:00–11:00 可以相邻。任何事项之间的重叠都被拒绝，避免同一时段重复计算。手动记录不能早于事项开始日期，不能超出完成日期，不能延伸到未来；正在计时的事项需先暂停才能修改时段。

## 图表口径

- 今日饼图：任务的已定位用时 + 已过去但未记录的“其他时间” + “尚未到来”，合计覆盖全天。旧版仅有总量的用时无法推断具体小时，单独提示，不编造时间位置。
- 今日柱状图：00–23 每小时按任务堆叠，显示该小时实际投入；下方清单展示每项任务的起止时间、时长与来源。
- 周／月小时分布：按所选周期，把所有日期落在同一小时段的时间相加。比如周一 09:30–10:15、周二 09:00–10:00，则 09–10 时共 90 分钟，10–11 时共 15 分钟。
- 日期 × 小时热力图：周／月每行一天、每列一个小时，格内为分钟数，颜色按 0–60 分钟分级。未来格禁用，无记录不代表休息。点击查看与该小时相交的任务时段，跨整点时仅显示交集用时；方向键、Home、End 导航，回车打开。
- 每日分类堆叠图：周按周一至周日排列，月按当月每日排列，零投入日期保留；年按 12 个月显示。每个主类型颜色固定，悬停显示时长、占当日比例及涉及的不同事项数，点击查看该天（年视图为该月）的分类时段明细。旧版未定位用时计入堆叠总量，并在明细中单列。
- 主类型和子类型筛选同时作用于热力图、堆叠图、累计小时图及成果概览。完成事项和已完成里程碑按完成日期统计，中断按事件发生日期计数，恢复后仍保留历史事件。里程碑只统计当期完成的事项；各成果卡支持查看详情和备注。
- 跨午夜、跨月的时间分别计入实际所在日期，未完成事项同样参与统计。高投入小时代表记录的投入集中程度，图表不直接评判任务产出效率。
- 周／月复盘：自动生成总投入、各任务用时、最高投入小时段、小时分布与每日用时的文字概述，保留手写总结。单篇和批量 Markdown 导出均包含这些文字。
- 图形以分钟为轴，底层保留秒；文字显示小时、分钟、秒。零数据仍显示完整日期轴和空状态。

## 数据结构与兼容

`sessions: [{id,start,end,source}]` 保存 ISO 起止时间及 timer/manual 来源。`activeTimer` 是运行中起点。每日 `timeEntries` 和兼容字段 `minutes` 从具体时段与 `untimedEntries` 重新计算，修改同一时段不会重复累计。

旧版本的日总量保留到 `untimedEntries`，不推测原始时段。未定位总量参与总投入和每日图表，但不参与小时分布；在时段明细中可移除旧汇总再补录真实时段。重置后新记录均采用具体时段。

数据包含 `generation` 标识。重新初始化会更新标识；旧页面写入将被拒绝并提示刷新，防止旧记录重新覆盖空白数据。

## 保留数据升级

在管理员 PowerShell 中执行：

```powershell
Set-Location D:\proj\myown\Prologue
.\scripts\windows-service.ps1 -Action Reinstall -PreserveData
```

脚本停止服务后，同时备份正式和演示数据库并验证 SHA256，然后重装服务，启动前再次检查原数据库未变。任务、复盘、自建主类型和子类型，以及数据 generation 全部保留。备份文件不进入 Git。`PreserveData` 明确禁止同时指定重置开关。

## English

Timers and manual records store exact start/end intervals. Overlaps across tasks and future intervals are rejected; adjacent intervals are valid. Hour/day/month boundaries split elapsed time exactly in local time.

Today shows per-task pie allocation (with elapsed unrecorded time and future time separated), stacked hourly bars, and an interval table. Weekly/monthly analytics add date-by-hour heatmaps and category-stacked daily bars with interval drilldowns. Yearly bars group by month. Category/subtype filters also apply to completed entries, completed milestones, and interruption counts; outcome cards open read-only details. Weekly/monthly review text and Markdown exports include task, hourly, and daily statistics alongside your own reflection.

Legacy totals are retained without inventing hourly placement. `Reinstall -PreserveData` snapshots and verifies both existing real and demo databases, reinstalls the service, and preserves all records and generation tokens.
