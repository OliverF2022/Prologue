#Requires -Version 5.1
[CmdletBinding()]
param([string]$NodeDirectory='D:\dev\runtimes\node-v24.22.3-win-x64',[string]$OutputDirectory='')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
if(-not $OutputDirectory){$OutputDirectory=Join-Path $project 'dist'}
$node=Join-Path $NodeDirectory 'node.exe'
$license=Join-Path $NodeDirectory 'LICENSE'
if(-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $license)){throw 'Provide an official Node.js Windows x64 directory with node.exe and LICENSE.'}
$version=(& $node --version).Trim()
if([version]($version.TrimStart('v')) -lt [version]'24.0.0'){throw 'Node.js 24+ is required.'}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stage=Join-Path $OutputDirectory ('stage-'+[Guid]::NewGuid().ToString('N'))
$bundle=Join-Path $stage 'Prologue-Capture'
New-Item -ItemType Directory -Force -Path $bundle,(Join-Path $bundle 'public'),(Join-Path $bundle 'runtime') | Out-Null
foreach($file in @('portable-server.mjs','storage.mjs','capture-launch.mjs','package.json')){Copy-Item -LiteralPath (Join-Path $project $file) -Destination (Join-Path $bundle $file)}
foreach($file in @('portable.html','portable.css','portable-app.js','task-model.js','task-view.js','time-model.js','time-analytics.js','time-charts.js','state-sync.js','transfer-model.js','style.css')){Copy-Item -LiteralPath (Join-Path $project ('public\'+$file)) -Destination (Join-Path $bundle ('public\'+$file))}
Copy-Item -LiteralPath $node -Destination (Join-Path $bundle 'runtime\node.exe')
Copy-Item -LiteralPath $license -Destination (Join-Path $bundle 'runtime\NODE-LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $project 'docs\capture-client.md') -Destination (Join-Path $bundle 'README.md')
$encoding=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $bundle 'Start.cmd'), "@echo off`r`n`"%~dp0runtime\node.exe`" `"%~dp0capture-launch.mjs`"`r`nif errorlevel 1 pause`r`n", [Text.Encoding]::ASCII)
[IO.File]::WriteAllText((Join-Path $bundle 'Stop.cmd'), "@echo off`r`n`"%~dp0runtime\node.exe`" `"%~dp0capture-launch.mjs`" --stop`r`nif errorlevel 1 pause`r`n", [Text.Encoding]::ASCII)
$vbs=@'
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
command = Chr(34) & folder & "\runtime\node.exe" & Chr(34) & " " & Chr(34) & folder & "\capture-launch.mjs" & Chr(34)
shell.Run command, 0, False
'@
[IO.File]::WriteAllText((Join-Path $bundle 'Start.vbs'),$vbs,[Text.Encoding]::ASCII)
[IO.File]::WriteAllText((Join-Path $bundle 'package.json'),'{"name":"prologue-capture","version":"1.0.0","private":true,"type":"module","scripts":{"start":"node portable-server.mjs"}}',$encoding)
$manifest=[ordered]@{product='Prologue Capture';version='1.0.0';platform='win32-x64';nodeVersion=$version;nodeSha256=(Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash;sourceCommit=(& git -C $project rev-parse HEAD).Trim();builtAt=(Get-Date).ToString('o')}
[IO.File]::WriteAllText((Join-Path $bundle 'manifest.json'),($manifest|ConvertTo-Json),$encoding)
$zip=Join-Path $OutputDirectory 'Prologue-Capture-win-x64-1.0.0.zip'
Compress-Archive -LiteralPath $bundle -DestinationPath $zip -Force
$hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
[IO.File]::WriteAllText(($zip+'.sha256'),($hash+'  '+[IO.Path]::GetFileName($zip)),[Text.Encoding]::ASCII)
[pscustomobject]@{archive=$zip;sha256=$hash;stage=$bundle;nodeVersion=$version}|ConvertTo-Json
