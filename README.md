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
- 实际耗时拆为小时和分钟：小时可选择常用值或手填，分钟可选择 0–59，默认 0 小时 30 分钟。按实际累计投入填写，不根据执行日期跨度自动折算；统计内部统一使用分钟。
- 普通任务支持手填 0–100% 的进度并展示进度条。填到 100% 会勾选完成并要求执行日期；降低已完成任务的进度会撤销完成。打卡事项只记录完成状态。
- 点击完成按钮，可确认执行开始日期、完成日期和实际耗时，也可补记过去完成的事项。执行结束不能早于开始，执行日期不能晚于今天；保存后可在事项编辑区修改。
- 未完成的过期事项自动在今日显示，保留原始计划日期。服务关闭期间不需要后台任务。
- 打卡为每日独立事项，完成后计一次；下一天需新建当天打卡。
- 已完成事项默认只展示本月成果，支持完成月份、主类型（工作 / 学习 / 生活等）、子类型和“仅看里程碑”组合筛选；结果仍按主类型分组。跨月任务按完成日期归属月份，全部实际耗时计入完成月份。
- 可将事项标记为里程碑并添加选填备注，展示在事项卡片中。创建或编辑事项时可直接输入新子类型，也可在“管理主类型 / 子类型”中预先建立。
- 周/月/年切换查看所选周期的分类用时图、计划完成率及打卡次数。用时为手动录入的分钟数；完成用时和打卡次数按完成日期归属，完成率按原计划日期归属。
- 复盘按年→月→周排列，可创建每级复盘，周复盘含统计概要；月年复盘不汇总。周一为每周开始，跨月周属于周一所在月。
- 复盘文本自动保存；周复盘可标记关键并选择颜色，在关键复盘页面定位原文。
- 每篇复盘可导出 Markdown，也可一次导出全部复盘。

## 数据

数据位于 `data/store.json`，不提交到 Git。停止服务后复制此文件即可备份。数据保存在服务端，不受浏览器清理缓存影响。当前是个人本机版本，不提供账号、远程访问或多进程并发写入。

旧记录会自动兼容：原分钟数保留，完成任务进度为 100%，未完成任务缺省为 0%，缺少子类型时显示“未分类”。旧完成记录的开始日期默认使用原计划日期（若原计划晚于完成日期，则使用完成日期），可在编辑区修正。

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

- Create custom parent categories and child subtypes, and dated tasks or check-in entries. Edit entries, mark them complete, undo completion, or delete them.
- Actual duration has separate hour and minute fields, defaulting to **0 hours 30 minutes**. Choose a suggested hour value or enter your own; choose minutes from 0–59. Duration is manually recorded cumulative effort, independent of the execution date range. Statistics store it in minutes and attribute it to the completion period.
- Ordinary tasks have editable progress from 0–100% and a progress bar. Entering 100% selects completion and requires execution dates; lowering progress on a completed task reopens it. Check-in entries only have a completion status.
- Completing an entry opens a form to confirm the execution start date, completion date, and actual duration. You can backdate completed entries and edit these details afterward. Completion cannot precede the start date; execution dates cannot be in the future.
- Overdue unfinished entries appear in today's list while retaining their original planned dates. No scheduled background process is needed.
- Each check-in is a separate daily entry. Create a new entry for the next day; completing it counts as one check-in.
- Completed entries default to the current month. Combine completion-month, parent-category, subtype, and milestone-only filters. Matching entries remain grouped by parent category. A task spanning multiple months belongs to its completion month, including its total actual duration.
- Mark entries as milestones with an optional note. Enter a new subtype when creating or editing an entry, or create it ahead of time under “管理主类型 / 子类型” (Manage categories / subtypes).
- Select a week, month, or year to see category time charts, planned-task completion rate, and check-in counts. Completed duration and check-ins belong to the completion date; completion rate groups entries by their original planned dates.
- Reviews are organized by year, month, and week. Weekly reviews include a brief statistical overview; monthly and yearly reviews do not. Weeks start on Monday and belong to the month containing that Monday.
- Review text saves automatically. Flag weekly reviews as key reviews, choose a color, and navigate to them from a dedicated page.
- Export one review or all reviews together as Markdown.

### Storage and backup

Records are stored in `data/store.json`, which is excluded from Git. Stop the server before copying this file for backup. Clearing browser storage does not remove these records. This version is for personal local use and has no accounts, remote access, or support for concurrent writes from multiple server processes.

Existing records remain compatible: recorded minutes are preserved; completed entries have 100% progress and unfinished entries default to 0%; missing subtypes appear as uncategorized. For older completed entries, the start date defaults to the earlier of the planned date and completion date. Edit it if needed.

### Development

Reuse the existing Node.js runtime. Install future tools under `D:\dev\tools`, downloads under `D:\dev\downloads`, and package-manager caches under `D:\dev\cache`. Obtain approval before installing anything on drive C.

```powershell
node --check server.mjs
node --check public/app.js
node --test
```

See [architecture and date rules](docs/design.md) for implementation decisions.
