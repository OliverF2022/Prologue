# 多标签页同步

原问题：每个标签页只在打开时读取一次完整数据库，保存时整体替换。A 新建并计时、B 使用打开时的旧快照新建另一项，B 就会抹掉 A 的事项。另一标签页也不会主动同步，因此能出现本页列表、计时和实际服务器记录不一致。

现在每个数据库包含 `generation` 和 `revision`。generation 区分重新初始化，revision 每次成功写入递增。旧记录缺少 revision 时，服务只在内存中兼容为 0，不在启动时改写文件。PUT 必须提交当前版本；检查、校验、历史存档、原子替换和版本递增全部在同一写入队列内执行。成功返回权威完整状态，过期版本返回 409，不能覆盖当前数据。无版本的旧版页面也会被拒绝。

客户端按事项 ID、复盘 ID、类型名及子类型归属做三方合并：以最后确认的数据为基础，只应用本次修改，保留其他标签新增或修改的独立记录。同名但不同 ID 的事项不会被擅自合并。两边修改同一记录、或一边删除而另一边修改时，停止保存并保留本页修改，不猜测哪一方正确。队列自动保存按输入顺序执行，失败后不会继续提交后面的旧快照。不同事项并发开始计时仍受服务端单计时器和时段不重叠校验保护。

保存后通过 BroadcastChannel 通知其他同模式标签；切回标签页及页面可见时每 5 秒拉取最新状态。正式与演示通知分开。编辑中的表单、打开的对话框或未保存复盘草稿会阻止自动替换界面，保存时再合并。刷新请求使用序号检查，较晚到达的旧响应不能让列表倒退。

发生冲突或保存失败，当前修改会尽力保存到本机浏览器 localStorage，并显示“导出未保存修改”和“载入最新记录”。导出的 JSON 是用于核对、恢复的本页数据备份，不会自动导入覆盖服务端；载入前仍应复制尚未提交的表单输入。复制标签页的备份键相互独立。服务端每次写入前保留完整快照，被拒绝的旧版本提交也单独留存，位置为正式 `data/history`、演示 `data/demo/history`。历史文件不自动清理、不进入 Git；恢复时应比对具体事项并保留当前记录，不能直接用旧文件覆盖整个数据库。

排查时可对照 `/api/state` 的事项 ID、activeTimer 和当前今日筛选。如果服务器里事项仍存在但旧页未显示，应同步页面；不要为了恢复显示而新建同名事项或伪造计时时段。计时横幅的“查看事项”可以直接定位正在计时的任务。

另一个曾造成误解的口径是今日页顶部原来显示本周的完成比例，列表却只显示今日与未完成事项。例如本周 4 项、昨天完成 1 项时，顶部是 1/4，今日列表是 3 项。今日卡片现已统一到今日与待办列表的范围，今天用时及打卡也按今天计算；此前已完成的事项在成果页按完成月份查看。

## English

Each database uses a generation token and a monotonically increasing revision. Writes compare both inside the same serialized transaction before validation, snapshotting, and atomic replacement. Stale and legacy clients cannot overwrite newer records. The client merges independent record changes by ID, while same-record edit/delete conflicts preserve the local draft for review. Queued auto-saves retain their order; a failed save blocks later stale submissions.

Tabs synchronize through same-mode broadcasts, focus events, and visible-page polling. Dirty forms, dialogs, and review drafts prevent automatic UI replacement. Out-of-order reads cannot roll back newer state. Conflicts offer a local JSON backup; server-side before-write and rejected snapshots remain under the corresponding database's history folder. Timer endpoints and task IDs are preserved rather than recreated.
