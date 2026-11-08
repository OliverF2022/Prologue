# Windows 服务

服务名为 `Prologue`，显示名为 `Prologue Daily Journal`。访问地址为 http://127.0.0.1:3030/ ，仅供本机访问。

服务使用 [WinSW 2.12.0 官方发布文件](https://github.com/winsw/winsw/releases/tag/v2.12.0)，配置参考 [官方 XML 文档](https://winsw.github.io/v2/doc/xmlConfigFile/)。安装脚本固定下载地址并校验 SHA256。复用已安装的 Node.js 24+，将运行时复制到 D 盘，不依赖 Codex 缓存目录长期运行。

| 目录 | 用途 |
| --- | --- |
| `D:\dev\downloads\winsw\2.12.0` | 官方 WinSW 下载缓存 |
| `D:\dev\runtimes\node-v24.22.1` | 本机本次准备的独立 Node.js 运行时 |
| `D:\dev\services\Prologue` | 服务程序、XML 配置、安装结果及来源清单 |
| `D:\dev\services\Prologue\logs` | 标准输出、错误及服务包装器日志，按大小轮转 |
| `D:\proj\myown\Prologue\data` | 原有记录数据，继续使用，不迁移 |

## 安装

在仓库目录运行准备步骤（需要能写入 `D:\dev`）：

```powershell
.\scripts\windows-service.ps1 -Action Prepare
```

检查生成的 `D:\dev\services\Prologue\Prologue.xml`。关闭原来的手工 `node server.mjs` 进程，释放 3030 端口。然后在**管理员 PowerShell** 中运行：

```powershell
Set-Location D:\proj\myown\Prologue
.\scripts\windows-service.ps1 -Action Install
```

安装需要 Windows 管理员授权，注册系统服务本身使用 Windows 的系统服务配置；软件文件均位于 D 盘。服务配置为开机自动启动、异常退出后等待 10 秒重启，并以 `LocalService` 账户运行。安装脚本授予运行文件读取权限，以及数据和日志目录写入权限。服务安装后无需保持终端或 Codex 打开。

## 管理

查询状态无需管理员权限：

```powershell
.\scripts\windows-service.ps1 -Action Status
```

在管理员 PowerShell 中执行以下管理命令：

```powershell
.\scripts\windows-service.ps1 -Action Restart
.\scripts\windows-service.ps1 -Action Stop
.\scripts\windows-service.ps1 -Action Start
```

更新服务器代码后执行 `Restart`。服务直接运行当前仓库的 `server.mjs`，前端资源从 `public` 读取，数据持续保存在原目录。不要在服务运行时额外启动同端口的手工服务器。

卸载服务注册（保留记录数据和工具文件）：

```powershell
.\scripts\windows-service.ps1 -Action Uninstall
```

安装或管理结果写入 `D:\dev\services\Prologue\install-result.json`。启动失败时检查该文件及 `logs` 中的错误日志。运行中的计时仍遵循应用规则：持续到暂停、中断或完成，服务重启不会丢失计时起点。

## English

Prepare the runtime and wrapper with `scripts/windows-service.ps1 -Action Prepare`, then run `-Action Install` from an Administrator PowerShell window. Stop any manually launched server using port 3030 first. Files stay under `D:\dev`; journal data remains in the project's `data` directory.

The service is named `Prologue`, starts automatically at boot, runs as `LocalService`, and restarts 10 seconds after a failure. Open http://127.0.0.1:3030/ on this computer. Use `-Action Status` to inspect it, or elevated `Start`, `Stop`, `Restart`, and `Uninstall` actions to manage it. Uninstalling the service preserves records and tool files. Restart after server-code updates.
