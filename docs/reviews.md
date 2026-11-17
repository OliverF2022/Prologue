# 复盘查询与日历

“复盘空间”顶部为按月份排列的年度周历，每格是一周，数字为周一日期。周一开始、周日结束；跨月周属于周一所在月，覆盖年初的跨年周在一月展示。未来周为灰色且不可点击。已标记关键的周复盘为红色；有非空总结为绿色；没有总结（包括保存过的空白记录）为白色。关键标记优先于是否填写，未来状态优先级最高。原有自选颜色保留在复盘正文边框，周历关键状态统一用红色。

悬浮或键盘聚焦格子时显示起止日期、填写状态、该周实际投入、涉及事项数、完成事项、打卡、完成里程碑和中断次数。投入按实际用时日期、完成成果按完成日期、中断按事件日期归属；未完成任务的投入也会计入。点击进入相应周复盘，已有记录直接打开，不会重复创建。只浏览、查询或点击未填写格子不会写入数据库。

“创建 / 定位复盘”可打开周、月、年复盘。新建先进入未保存草稿，支持取消；仅点击“保存并创建”后持久化。已有复盘输入后自动保存。月复盘可跳转其周一归属本月的周复盘，年复盘可跳转当年月复盘。

“查询复盘”支持周期、所在日期、关键词和状态组合筛选。“所在日期”匹配包含这一天的周／月／年；关键词匹配总结、日期和周期名称，例如输入 `2026-11` 可查十一月开始的复盘。未选择日期时查询全部日期。查询不会创建复盘，结果按年、月、周组织。支持导出单篇、当前查询结果和全部有效复盘为 Markdown。

删除操作只添加 `deletedAt`，记录移入回收站。页面可立即“撤销删除”，也可刷新后进入回收站恢复。删除年／月复盘不会删除下级复盘，也不影响任务和时间统计。已删除记录不参与周历、普通查询、关键复盘及全部导出。恢复时若相同周期已有另一篇有效复盘，会提示冲突，不覆盖任何正文。未提供永久清除入口。

升级继续使用 `scripts/windows-service.ps1 -Action Reinstall -PreserveData`，停止服务后备份并校验正式和演示数据库；不重置记录或 generation。旧复盘无须迁移，缺少 `deletedAt` 即视为有效。

## English

The yearly calendar groups weeks by their Monday's month, with the week covering January 1 shown in January. Future weeks are disabled and gray; key reviews are red; nonblank written reviews green; empty or missing reviews white. Hover or focus a cell for its date range and effort/outcome statistics. Click to open an existing weekly review or an unsaved draft.

Drafts persist only after Save and create. Canceling leaves no record. Existing reviews auto-save. Search by period, containing date, keyword, and writing status; browse the year/month/week hierarchy or follow child-review links. Export one review, query results, or all active reviews to Markdown.

Deletion is recoverable: `deletedAt` excludes a review from active navigation without removing its content. Undo immediately or restore from the recycle bin after reload. Deleting a parent review does not delete child reviews or task data. Restoration refuses to overwrite another active review for the same period. Upgrades back up and retain both real and demo databases with `Reinstall -PreserveData`.
