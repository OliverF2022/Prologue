# Prologue · 日有所记

本机个人每日记录与复盘应用。

## 启动

需要 Node.js 24 或更高版本，无需安装第三方依赖。

```powershell
node server.mjs
```

浏览器打开 http://127.0.0.1:3030 。服务仅监听本机。可通过 PORT 环境变量更换端口。

## 功能与口径

- 每日事项支持自建类型、普通任务、打卡事项、日期和分钟数，支持完成/撤销和删除。
- 未完成的过期事项自动在今日显示，保留原始计划日期。服务关闭期间不需要后台任务。
- 打卡为每日独立事项，完成后计一次；下一天需新建当天打卡。
- 已完成事项按自建类型展示。
- 周/月/年切换查看所选周期的分类用时图、计划完成率及打卡次数。用时为手动录入的分钟数；完成用时和打卡次数按完成日期归属，完成率按原计划日期归属。
- 复盘按年→月→周排列，可创建每级复盘，周复盘含统计概要；月年复盘不汇总。周一为每周开始，跨月周属于周一所在月。
- 复盘文本自动保存；周复盘可标记关键并选择颜色，在关键复盘页面定位原文。
- 每篇复盘可导出 Markdown，也可一次导出全部复盘。

## 数据

数据位于 `data/store.json`，不提交到 Git。停止服务后复制此文件即可备份。数据保存在服务端，不受浏览器清理缓存影响。当前是个人本机版本，不提供账号、远程访问或多进程并发写入。

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

- Create custom categories and dated tasks or check-in entries. Mark entries complete, undo completion, or delete them.
- The time field defaults to **30 minutes**. It is manually entered task duration, used in time statistics when the entry is completed; it is not a countdown timer.
- Overdue unfinished entries appear in today's list while retaining their original planned dates. No scheduled background process is needed.
- Each check-in is a separate daily entry. Create a new entry for the next day; completing it counts as one check-in.
- Browse completed entries grouped by category.
- Select a week, month, or year to see category time charts, planned-task completion rate, and check-in counts. Completed duration and check-ins belong to the completion date; completion rate groups entries by their original planned dates.
- Reviews are organized by year, month, and week. Weekly reviews include a brief statistical overview; monthly and yearly reviews do not. Weeks start on Monday and belong to the month containing that Monday.
- Review text saves automatically. Flag weekly reviews as key reviews, choose a color, and navigate to them from a dedicated page.
- Export one review or all reviews together as Markdown.

### Storage and backup

Records are stored in `data/store.json`, which is excluded from Git. Stop the server before copying this file for backup. Clearing browser storage does not remove these records. This version is for personal local use and has no accounts, remote access, or support for concurrent writes from multiple server processes.

### Development

Reuse the existing Node.js runtime. Install future tools under `D:\dev\tools`, downloads under `D:\dev\downloads`, and package-manager caches under `D:\dev\cache`. Obtain approval before installing anything on drive C.

```powershell
node --check server.mjs
node --check public/app.js
node --test
```

See [architecture and date rules](docs/design.md) for implementation decisions.
