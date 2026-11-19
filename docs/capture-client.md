# Prologue Capture · 便携事项客户端

适用于 Windows 10/11 x64。这是独立的离线事项采集工具，只处理事项、打卡、进度、中断、里程碑及具体计时时段，不包含复盘或统计图表。汇总图表在主程序导入后查看。

## 启动和退出

1. 将整个 Prologue-Capture 文件夹解压到有写入权限的位置，再双击 Start.vbs。它会在默认浏览器打开客户端，不需要管理员权限或另装 Node.js。系统禁用 VBS 时可双击 Start.cmd；出错信息会留在窗口或 capture-data/client.log。
2. 所有记录存在本文件夹的 capture-data 中，不依赖浏览器缓存。可将整个文件夹放在 U 盘携带；移动、备份、升级前先退出客户端。不要只复制网页文件或删除 capture-data。
3. 同一目录再次启动会打开原客户端；不同副本自动选择可用的本机端口。仅监听 127.0.0.1，不提供局域网访问。
4. 退出时点击页面“暂停并退出”，或双击 Stop.cmd；它会暂停计时并保存。只关闭浏览器不会暂停计时，下次启动仍按原起点计算，可在事项中修正时间段。

多台电脑并行记录时，每台从空白便携压缩包独立解压、启动以获得不同设备 ID。包含 capture-data 的整个目录用于单一来源的迁移，请先退出原副本，避免同时编辑同一份迁移数据。

## 每日记录与重置

新建事项当天自动开始，之后可填写进度、完成、打卡或填写理由中断。支持主类型和子类型、自定义分类、计时及手动补记/修正具体时段，一次只能为一项计时。计时和补记时段不能相互重叠。

客户端的工作日固定到手动重置为止。跨天只提醒，不自动清空、不复制或顺延未完成事项。请先导出，再重置开始新一天；跨天后仍可暂停及整理原工作日记录，但不能在旧工作日创建或开始新的计时事项。

“重置 / 开始新一天”提供：

- 导出并重置：确认时结算正在计时的事项，先将完整数据包写入 capture-data/exports，再清空当前事项。页面提供下载入口。导出失败不会清空，也不会把计时标记为完成。
- 直接重置：结算后清空当前事项，不生成交换数据包。自动保留重置前快照于 capture-data/reset-backups；已有导出包和类型目录保留。
- 取消：不改变记录、计时或工作日。

重置会创建新的工作区及数据版本，即使同一天多次重置、重新创建同名事项，也有独立 ID；旧标签页不能把已重置的事项重新覆盖回来。历史写入及被拒绝提交也保存在 capture-data/history。没有永久清除历史备份的自动任务。

## 导出和导入主程序

“暂停并导出”会保存全部当前事项为 .prologue.json 文件，并保留在 capture-data/exports。数据包含设备 ID、工作区、工作日、事项 ID、事项版本、分类、进度及真实起止时间，不包含复盘或主程序数据库版本。客户端独立运行，不需要连接家中电脑或互联网。

将文件带回主程序，在“数据导入”页面选择文件。先查看预览，必要时跳过冲突事项或手动选择归入已有任务，重新预览后确认：

- 默认作为独立的当日历史事项导入。未完成仍保留真实进度，只在原工作日的今日列表中显示，不会自动成为以后待办；用时、打卡、完成和里程碑统计沿用原规则。
- 同一文件或重复导出的同一版本不会重复创建、重复计时；旧版本不会覆盖新版本。导出后继续修改，再导出的新版本会合并独立修改；同一字段或时段两端都改过会提示冲突。
- 同名事项默认不合并。手动选择合并到已有任务时，仅追加/更新本来源时段，保留主程序的名称、进度和完成状态。新时段必须在该任务执行范围内；否则可选择独立导入或先修正主程序记录。
- 时间重叠、未来时段、数据格式错误会明确提示；不会裁剪时长或静默覆盖。主程序若还在为另一事项计时，先核实真实执行时间并修正/暂停后再重新预览。
- 导入预览和确认之间若有其他标签页保存，必须重新预览。导入与普通保存使用相同的版本校验、写入队列及历史备份。复盘、自建类型和其他任务不会被整库替换。
- 时段保留 UTC 时间戳，主程序按自己的时区划分日/小时；预览会展示两端时区。若涉及跨时区，原始日期保存在来源信息中，执行起止边界扩展到覆盖真实时段。
- 在客户端删除事项，不会自动删除主程序中已导入的历史记录；请在主程序明确处理。当前版本不把主程序的长期事项下发到客户端，已有任务可以在导入时手动归并时段。

## 数据和故障恢复

不要在服务运行时直接编辑 store.json。保存冲突时当前输入保留，可以导出未保存修改备份后载入最新记录。导出的恢复备份用于核对，不是可直接覆盖主程序的数据包。误操作可结合 exports、history、reset-backups 恢复具体事项，不能直接拿旧文件替换正在使用的数据库。

便携包包含 Node.js 24 Windows x64 运行时及其授权说明 runtime/NODE-LICENSE.txt；业务代码无第三方依赖。压缩包不包含个人数据，首次启动是空白记录。

## English

Extract the entire folder on Windows 10/11 x64 and double-click Start.vbs (or Start.cmd). The bundled Node.js runtime opens a local browser interface; no installation or administrator rights are needed. Records live in capture-data beside the application. Use Pause and exit or Stop.cmd before moving or backing up the folder. Closing only the browser leaves timing active.

Create tasks/check-ins, manage categories, edit progress, interrupt with a reason, and record exact timer/manual intervals. Each workspace is one workday. A date change prompts manual export/reset without automatically deleting or rolling tasks over. Reset offers Export and reset, Reset directly, and Cancel. Export is durably written before clearing; failure preserves the records. Direct reset retains a recovery snapshot.

Bring .prologue.json files to the main application's Data import page. Preview new/updated/duplicate/conflicting records before committing. IDs and source versions prevent duplicate time and stale overwrites. Imported daily tasks retain incomplete progress and do not roll over into future pending lists. Explicit mapping appends source intervals to a host task while preserving its lifecycle. Overlaps and concurrent writes require resolution rather than silent replacement. Reviews are never included or modified.
