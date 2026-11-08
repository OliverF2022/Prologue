# Prologue · 日有所记

本机个人每日记录与复盘应用。

## 启动

需要 Node.js 24 或更高版本，无需安装第三方依赖。

```powershell
node server.mjs
```

浏览器打开 http://127.0.0.1:3030 。服务仅监听本机。可通过 PORT 环境变量更换端口。

## 功能与口径

- 每日事项支持自建主类型和归属主类型的子类型、普通任务、打卡事项，支持编辑、完成/撤销和删除。
- 添加事项只需填写名称、主类型、子类型和事项类型。创建当天自动作为开始日期，实际用时从零开始；点击完成或将进度填到 100% 时，当天自动作为结束日期。
- 事项创建后可“开始计时 / 暂停计时”，累计实际投入，并按本机时区自动跨天拆分。一次只为一个事项计时，切换会暂停上一项。开始计时后，关闭页面或重启服务仍会累计，直到暂停、中断或完成。
- 可在“每日用时 / 补记与修正”中按小时、分钟修正某日总用时，保存会替换该日记录，不会重复叠加。修改时须先暂停计时；日期须处于开始至结束之间且不晚于今天，每日手填用时不超过 24 小时。累计用时由每日记录自动汇总。
- 普通任务创建后支持手填 0–100% 的进度并展示进度条。填到 100% 自动完成；降低已完成任务的进度会撤销完成。打卡事项只记录完成状态。
- 允许中断事项，必须填写非空理由；中断停止计时并保留用时、进度和中断历史。恢复后可继续工作，再次开始计时需点击“开始计时”。
- 未完成事项（含已中断事项）第二天继续可见，保留原开始日期，不复制新任务。
- 打卡为每日独立事项，完成后计一次；下一天需新建当天打卡。
- 已完成事项默认只展示本月成果，支持完成月份、主类型（工作 / 学习 / 生活等）、子类型和“仅看里程碑”组合筛选；结果仍按主类型分组。列表按完成月份查询，并展示事项的全部累计用时。
- 可在编辑或完成事项时标记里程碑并添加选填备注。创建或编辑事项时可直接输入新子类型，也可在“管理主类型 / 子类型”中预先建立。
- 周/月/年切换查看所选周期的分类用时图、事项完成率及打卡次数。投入时间按每日用时记录归属，包含未完成事项；打卡按完成日期归属，完成率按开始日期归属。跨月事项的耗时按实际记录日期分别进入各月。
- 复盘按年→月→周排列，可创建每级复盘，周复盘含统计概要；月年复盘不汇总。周一为每周开始，跨月周属于周一所在月。
- 复盘文本自动保存；周复盘可标记关键并选择颜色，在关键复盘页面定位原文。
- 每篇复盘可导出 Markdown，也可一次导出全部复盘。

## 数据

数据位于 `data/store.json`，不提交到 Git。停止服务后复制此文件即可备份。数据保存在服务端，不受浏览器清理缓存影响。当前是个人本机版本，不提供账号、远程访问或多进程并发写入。

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

### Run locally

Requires Node.js 24 or later. No third-party dependencies are required.

```powershell
node server.mjs
```

Open http://127.0.0.1:3030 in your browser. The server listens on localhost only. Set the `PORT` environment variable to change the port.

### Features and reporting rules

- Create entries with a name, parent category, optional child subtype, and task/check-in type. The creation day automatically becomes the start date; completion day becomes the end date. New entries start with zero recorded duration. Dates and duration are absent from the creation form.
- Start or pause a timer after creation. Elapsed time splits automatically at local midnight and accumulates by day. Only one timer runs at a time; switching tasks pauses the previous timer. A running timer continues across page closure and server restarts until paused, interrupted, or completed.
- Add or correct a day's total using hours and minutes under “每日用时 / 补记与修正” (Daily time / corrections). Saving replaces that day's record. Pause the timer before editing. Dates must be within the task's execution range and no later than today; manual daily totals are limited to 24 hours. Total duration is calculated automatically from daily records.
- Ordinary tasks have editable progress from 0–100% after creation. Entering 100% completes the task today; lowering progress on a completed task reopens it. Check-ins only have a completion status.
- Interrupting an entry requires a nonblank reason, stops its timer, and retains progress, recorded effort, and interruption history. Resume the entry when ready; restart timing explicitly.
- Unfinished and interrupted entries remain visible the next day with the same start date, without creating duplicates.
- Each check-in is a separate daily entry. Create a new entry for the next day; completing it counts as one check-in.
- Completed entries default to the current month. Combine completion-month, parent-category, subtype, and milestone-only filters. Results remain grouped by parent category and show each task's cumulative duration.
- Mark entries as milestones with an optional note when editing or completing them. Enter a new subtype when creating or editing, or create it in advance under “管理主类型 / 子类型” (Manage categories / subtypes).
- Select a week, month, or year for category time charts, completion rate, and check-in counts. Time belongs to the day it was recorded, including unfinished work. Check-ins belong to the completion date; completion rate groups entries by start date. Effort spanning months is attributed to its respective recorded days.
- Reviews are organized by year, month, and week. Weekly reviews include a brief statistical overview; monthly and yearly reviews do not. Weeks start on Monday and belong to the month containing that Monday.
- Review text saves automatically. Flag weekly reviews as key reviews, choose a color, and navigate to them from a dedicated page.
- Export one review or all reviews together as Markdown.

### Storage and backup

Records are stored in `data/store.json`, which is excluded from Git. Stop the server before copying this file for backup. Clearing browser storage does not remove these records. This version is for personal local use and has no accounts, remote access, or support for concurrent writes from multiple server processes.

Existing records retain their recorded minutes and start dates. Missing start dates fall back to the original date; completed entries have 100% progress and missing subtypes appear as uncategorized. Older aggregate durations are placed on the original completion date (or start date for unfinished entries) and labeled as legacy totals. No daily distribution is invented; correct the history through daily time records as needed.

### Development

Reuse the existing Node.js runtime. Install future tools under `D:\dev\tools`, downloads under `D:\dev\downloads`, and package-manager caches under `D:\dev\cache`. Obtain approval before installing anything on drive C.

```powershell
node --check server.mjs
node --check public/app.js
node --test
```

See [architecture and date rules](docs/design.md) for implementation decisions.
