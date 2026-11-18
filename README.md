# Prologue · 日有所记

本机个人每日记录与复盘应用。

查看 [演示模式](http://127.0.0.1:3030/?demo=1)：包含最近一个月的假任务、具体用时段、打卡、里程碑、中断与分层复盘。演示内容有醒目标记，使用独立的 `data/demo/store.json`，可自由修改或点击“恢复示例”，不会污染正式记录。页面右上角可返回正式模式。

## 启动

需要 Node.js 24 或更高版本，无需安装第三方依赖。

```powershell
node server.mjs
```

浏览器打开 http://127.0.0.1:3030 。服务仅监听本机。可通过 PORT 环境变量更换端口。

也可安装为 Windows 系统服务，开机自动启动，无需保持终端打开。工具与运行时放在 `D:\dev`，数据保留原位；安装需要管理员授权。详见 [Windows 服务安装和管理](docs/windows-service.md)。

## 功能与口径

- 每日事项支持自建主类型和归属主类型的子类型、普通任务、打卡事项，支持编辑、完成/撤销和删除。
- 添加事项只需填写名称、主类型、子类型和事项类型。创建当天自动作为开始日期，实际用时从零开始；点击完成或将进度填到 100% 时，当天自动作为结束日期。
- 事项创建后可“开始计时 / 暂停计时”，累计实际投入，并按本机时区自动跨天拆分。一次只为一个事项计时，切换会暂停上一项。开始计时后，关闭页面或重启服务仍会累计，直到暂停、中断或完成。
- 计时器会保存具体开始和结束时间。在“时间段明细 / 手动修改”中可补记、修改或删除时段，耗时自动计算。修改前须暂停本事项计时，时段不能重叠或晚于当前时间。跨整点、跨天的部分分别进入对应小时和日期。
- 今日页面可切换任务饼图和按小时堆叠柱状图，并查看每项任务的实际执行时段。“其他”指当天已过去但未记录的时间，“尚未到来”单独显示。
- 统计页面支持周／月的日期 × 小时热力图，每格显示该小时记录的分钟数，点击查看具体事项、起止时间和来源。无记录与未来时间分开标识，支持方向键导航。
- 每日投入按主类型堆叠：周按周一至周日、月按每日、年按月份排列，颜色保持一致。悬停查看时长、占比和每日事项数，点击色块查看明细；保留可展开的每小时累计图及图表数据表。
- 统计支持主类型、子类型组合筛选，同步作用于图表、投入总量、完成事项、完成里程碑及中断次数。成果可点击查看记录和备注；完成事项与里程碑按完成日期，中断按事件日期统计。投入时长不直接代表效率。
- 普通任务创建后支持手填 0–100% 的进度并展示进度条。填到 100% 自动完成；降低已完成任务的进度会撤销完成。打卡事项只记录完成状态。
- 允许中断事项，必须填写非空理由；中断停止计时并保留用时、进度和中断历史。恢复后可继续工作，再次开始计时需点击“开始计时”。
- 未完成事项（含已中断事项）第二天继续可见，保留原开始日期，不复制新任务。
- 打卡为每日独立事项，完成后计一次；下一天需新建当天打卡。
- 已完成事项默认只展示本月成果，支持完成月份、主类型（工作 / 学习 / 生活等）、子类型和“仅看里程碑”组合筛选；结果仍按主类型分组。列表按完成月份查询，并展示事项的全部累计用时。
- 可在编辑或完成事项时标记里程碑并添加选填备注。创建或编辑事项时可直接输入新子类型，也可在“管理主类型 / 子类型”中预先建立。
- 周/月/年切换查看所选周期的投入与成果，完成事项区分普通任务和打卡次数。统计页和周复盘中的完成率按开始日期归属；今日完成率与“今日与待办”列表范围一致，包含顺延事项，投入和打卡仅统计今天。跨月事项的耗时按实际记录日期分别进入各月，包含未完成事项。
- 复盘按年→月→周排列，可创建每级复盘，周复盘含统计概要；月年复盘不汇总。周一为每周开始，跨月周属于周一所在月。
- 周／月复盘自动生成总投入、各事项用时、高投入小时段、小时分布及每日投入的文字统计，Markdown 导出同时包含统计和手写总结。
- 复盘文本自动保存；周复盘可标记关键并选择颜色，在关键复盘页面定位原文。
- 年度周复盘日历支持切换年份，悬浮查看该周投入、完成事项、打卡、里程碑和中断统计，点击进入当周复盘。已填写绿色、关键红色、未填写白色、未来灰色；空白记录不会被算作已填写。
- 复盘可按周期、所在日期、关键词和填写状态组合查询，结果保留年→月→周层级；年/月复盘中也有下级复盘跳转入口。
- 新建先打开草稿，点击“保存并创建”才写入；“取消创建”不留下记录。已有复盘继续自动保存。删除移入回收站，可撤销或在回收站恢复，正文、关键标记和颜色保留。
- 每篇复盘可导出 Markdown，也可导出查询结果或一次导出全部有效复盘。详细规则见 [复盘查询与日历](docs/reviews.md)。

## 数据

数据位于 `data/store.json`，不提交到 Git。停止服务后复制此文件即可备份。数据保存在服务端，不受浏览器清理缓存影响。当前是个人本机版本，不提供账号、远程访问或多进程并发写入。

支持同时打开多个浏览器标签页：新增或修改不同事项会自动合并；同时修改同一事项或复盘会提示冲突，保留本页修改并支持导出 JSON 备份。切回标签页会同步最新记录，页面可见时每 5 秒检查更新；正在输入的表单不会被自动刷新清空。计时横幅提供“查看事项”，可定位正在计时的记录。

服务端按 `revision` 检查保存版本，并在写入队列内再次校验，旧标签页不能覆盖新记录。更新后请刷新旧页面；旧版页面的提交会被拒绝并留存。每次写入前及被拒绝的快照分别保存在正式 `data/history`、演示 `data/demo/history`，不进入 Git。记录本身不会因为同步而复制，计时起点、时段和统计沿用原事项。详见 [多标签页同步](docs/synchronization.md)。

升级重装使用 `scripts/windows-service.ps1 -Action Reinstall -PreserveData`：停止服务后备份正式及演示数据库，校验 SHA256，确认原文件未变后重新启动。备份位于 `D:\dev\services\Prologue\backups`，不清空任务、复盘或类型。

旧记录会自动兼容：原分钟数保留，完成任务进度为 100%，未完成任务缺省为 0%，缺少子类型时显示“未分类”。原有开始日期保留，缺失时采用原日期；旧版总用时放在原完成日期（未完成时为开始日期），并标记“旧版总用时”，不会虚构逐日分布。可通过每日用时明细修正历史记录。

## 开发工具目录规划

复用系统中已有的 Node.js，本次未安装任何工具。以后新增工具安装至 `D:\dev\tools`，下载缓存置于 `D:\dev\downloads`，包管理器缓存置于 `D:\dev\cache`。需要安装 C 盘前先征得同意。

## 验证

```powershell
node --check server.mjs
node --check public/app.js
node --test
```

架构与日期规则见 [docs/design.md](docs/design.md)。

---

## English

Prologue is a local personal daily tracker with task rollover, achievement views, analytics, and hierarchical reviews.

Open [Demo mode](http://127.0.0.1:3030/?demo=1) for a month of clearly labeled synthetic tasks, time intervals, check-ins, milestones, interruptions, and reviews. Demo edits use a separate `data/demo/store.json` and never change real records. “恢复示例” restores the sample dataset; the header link returns to real records.

### Run locally

Requires Node.js 24 or later. No third-party dependencies are required.

```powershell
node server.mjs
```

Open http://127.0.0.1:3030 in your browser. The server listens on localhost only. Set the `PORT` environment variable to change the port.

For automatic startup independent of a terminal or Codex, install it as a Windows service. Tools and the runtime live under `D:\dev`; data stays in the project. Installation requires Administrator authorization. See [Windows service setup and management](docs/windows-service.md).

### Features and reporting rules

- Create entries with a name, parent category, optional child subtype, and task/check-in type. The creation day automatically becomes the start date; completion day becomes the end date. New entries start with zero recorded duration. Dates and duration are absent from the creation form.
- Start or pause a timer after creation. Elapsed time splits automatically at local midnight and accumulates by day. Only one timer runs at a time; switching tasks pauses the previous timer. A running timer continues across page closure and server restarts until paused, interrupted, or completed.
- Timers preserve exact start/end timestamps. Add, edit, or delete manual intervals under “时间段明细 / 手动修改” (Time intervals / edits); duration is calculated automatically. Pause the task before editing. Intervals must not overlap or extend into the future, and are split at clock-hour and day boundaries.
- Today offers a task pie chart, stacked hourly bars, and an execution-interval table. Unrecorded elapsed time and future time are separate pie slices.
- Weekly/monthly analytics include a date-by-hour heatmap. Cells show recorded minutes and open exact task/interval details. Empty and future cells are distinguished; arrow keys navigate the grid.
- Daily bars stack stable category colors, with duration, share, and daily task counts in tooltips and clickable interval details. Weekly axes run Monday–Sunday, monthly axes include every date, and yearly axes show months. Expand the cumulative hourly chart or chart data tables for detail.
- Combine category and subtype filters across all charts and outcome cards. Inspect completed entries, completed milestones with notes, and interruption events. Completion outcomes use completion dates; interruptions use event dates. Recorded effort is not an efficiency score.
- Ordinary tasks have editable progress from 0–100% after creation. Entering 100% completes the task today; lowering progress on a completed task reopens it. Check-ins only have a completion status.
- Interrupting an entry requires a nonblank reason, stops its timer, and retains progress, recorded effort, and interruption history. Resume the entry when ready; restart timing explicitly.
- Unfinished and interrupted entries remain visible the next day with the same start date, without creating duplicates.
- Each check-in is a separate daily entry. Create a new entry for the next day; completing it counts as one check-in.
- Completed entries default to the current month. Combine completion-month, parent-category, subtype, and milestone-only filters. Results remain grouped by parent category and show each task's cumulative duration.
- Mark entries as milestones with an optional note when editing or completing them. Enter a new subtype when creating or editing, or create it in advance under “管理主类型 / 子类型” (Manage categories / subtypes).
- Select a week, month, or year for effort and outcomes, with ordinary completions and check-ins counted separately. Time belongs to the day recorded, including unfinished work. Analytics and weekly-review completion rates group entries by start date. Today's completion rate matches its visible today/rollover list; effort and check-ins cover today only. Effort spanning months is attributed to its respective recorded days.
- Reviews are organized by year, month, and week. Weekly reviews include a brief statistical overview; monthly and yearly reviews do not. Weeks start on Monday and belong to the month containing that Monday.
- Weekly and monthly reviews automatically include textual totals, per-task durations, high-investment hours, hourly distribution, and daily totals. Markdown exports contain both these statistics and your written reflection.
- Review text saves automatically. Flag weekly reviews as key reviews, choose a color, and navigate to them from a dedicated page.
- The yearly weekly-review calendar supports year navigation, hover statistics, and opening a week's review. Filled reviews are green, key reviews red, empty reviews white, and future weeks gray. Empty saved records do not count as filled.
- Search reviews by period, containing date, keywords, and writing status. Results retain the year → month → week hierarchy. Yearly and monthly reviews link to their child reviews.
- New reviews open as drafts and persist only after “保存并创建” (Save and create). Canceling a draft leaves no record; existing reviews continue to auto-save. Deletion moves a review to a recoverable recycle bin, retaining its text, key flag, and color. Undo immediately or restore later.
- Export one review, query results, or all active reviews as Markdown. See [review navigation and calendar rules](docs/reviews.md).

### Storage and backup

Records are stored in `data/store.json`, which is excluded from Git. Stop the server before copying this file for backup. Clearing browser storage does not remove these records. This version is for personal local use and has no accounts, remote access, or support for concurrent writes from multiple server processes.

Multiple browser tabs are supported. Independent records merge automatically; conflicting edits to the same task or review preserve the local draft and offer a JSON backup. Tabs synchronize on focus and every five seconds while visible, without replacing dirty forms. Use “查看事项” in the timer banner to locate the running task. The server checks persisted revisions inside its write queue and archives previous/rejected snapshots in `data/history` (or `data/demo/history`). Refresh older pages after upgrading. See [synchronization rules](docs/synchronization.md).

Upgrade with `scripts/windows-service.ps1 -Action Reinstall -PreserveData`. After stopping the service, it snapshots both real and demo stores under `D:\dev\services\Prologue\backups`, verifies SHA256 checksums, and checks that the original files are unchanged before starting. Tasks, reviews, and categories are retained.

Existing records retain their recorded minutes and start dates. Missing start dates fall back to the original date; completed entries have 100% progress and missing subtypes appear as uncategorized. Older aggregate durations are placed on the original completion date (or start date for unfinished entries) and labeled as legacy totals. No daily distribution is invented; correct the history through daily time records as needed.

### Development

Reuse the existing Node.js runtime. Install future tools under `D:\dev\tools`, downloads under `D:\dev\downloads`, and package-manager caches under `D:\dev\cache`. Obtain approval before installing anything on drive C.

```powershell
node --check server.mjs
node --check public/app.js
node --test
```

See [architecture and date rules](docs/design.md) for implementation decisions.

详细统计口径见 [时间段和图表说明 / Time intervals and charts](docs/time-slots.md)。
