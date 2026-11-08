#Requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Install', 'Start', 'Stop', 'Restart', 'Status', 'Uninstall')]
    [string]$Action = 'Status',
    [string]$DevRoot = 'D:\dev',
    [string]$ProjectRoot = '',
    [int]$ReplaceProcessId = 0
)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$serviceName = 'Prologue'
$serviceDirectory = Join-Path $DevRoot 'services\Prologue'
$wrapper = Join-Path $serviceDirectory 'Prologue.exe'
$receiptPath = Join-Path $serviceDirectory 'installation.json'
$resultPath = Join-Path $serviceDirectory 'install-result.json'
$wrapperUrl = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW.NET4.exe'
$wrapperHash = '923111C7142B3DC783A3C722B19B8A21BCB78222D7A136AC33F0CA8A29F4CB66'

function Write-Utf8([string]$Path, [string]$Value) {
    [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false))
}

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$Executable exited with code $LASTEXITCODE" }
}

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This action requires an Administrator PowerShell window. Prepare and Status do not require elevation.'
    }
}

function Assert-Wrapper {
    if (-not (Test-Path -LiteralPath $wrapper) -or
        (Get-FileHash -LiteralPath $wrapper -Algorithm SHA256).Hash -ne $wrapperHash) {
        throw 'The WinSW binary is missing or its checksum does not match. Run Prepare again.'
    }
}

function Wait-Ready([string]$Url) {
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "The service did not become ready at $Url. Check $serviceDirectory\logs."
}

if ($Action -eq 'Prepare') {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'server.mjs'))) { throw 'Project server.mjs is missing.' }
    New-Item -ItemType Directory -Force -Path $serviceDirectory,(Join-Path $serviceDirectory 'logs') | Out-Null
    $downloadDirectory = Join-Path $DevRoot 'downloads\winsw\2.12.0'
    New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null
    $download = Join-Path $downloadDirectory 'WinSW.NET4.exe'
    if (-not (Test-Path -LiteralPath $download)) {
        Invoke-WebRequest -Uri $wrapperUrl -OutFile $download -UseBasicParsing
    }
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $wrapperHash) {
        throw 'Downloaded WinSW checksum does not match the pinned official release.'
    }
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService -and $existingService.Status -ne 'Stopped') { throw 'Stop Prologue before preparing an update.' }
    Copy-Item -LiteralPath $download -Destination $wrapper -Force
    $nodeSource = (Get-Command node -ErrorAction Stop).Source
    $nodeVersion = (& $nodeSource --version).Trim()
    if ([version]($nodeVersion.TrimStart('v')) -lt [version]'24.0.0') { throw 'Node.js 24 or later is required.' }
    $runtimeDirectory = Join-Path $DevRoot "runtimes\node-$nodeVersion"
    New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
    $nodeTarget = Join-Path $runtimeDirectory 'node.exe'
    if ([IO.Path]::GetFullPath($nodeSource) -ne [IO.Path]::GetFullPath($nodeTarget)) {
        Copy-Item -LiteralPath $nodeSource -Destination $nodeTarget -Force
    }
    if ((Get-FileHash -LiteralPath $nodeSource).Hash -ne (Get-FileHash -LiteralPath $nodeTarget).Hash) { throw 'Node.js copy verification failed.' }
    $dataDirectory = Join-Path $ProjectRoot 'data'
    New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
    $xmlNode = [Security.SecurityElement]::Escape($nodeTarget)
    $xmlProject = [Security.SecurityElement]::Escape($ProjectRoot)
    $xmlData = [Security.SecurityElement]::Escape($dataDirectory)
    $xmlLogs = [Security.SecurityElement]::Escape((Join-Path $serviceDirectory 'logs'))
    $xml = @"
<service>
  <id>Prologue</id>
  <name>Prologue Daily Journal</name>
  <description>Local daily tracker, analytics and reviews at http://127.0.0.1:3030/</description>
  <executable>$xmlNode</executable>
  <arguments>&quot;$xmlProject\server.mjs&quot;</arguments>
  <workingdirectory>$xmlProject</workingdirectory>
  <env name="PORT" value="3030" />
  <env name="DATA_DIR" value="$xmlData" />
  <startmode>Automatic</startmode>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  <onfailure action="restart" delay="10 sec" />
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
  <logpath>$xmlLogs</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@
    Write-Utf8 (Join-Path $serviceDirectory 'Prologue.xml') $xml
    $receipt = [ordered]@{ serviceName=$serviceName; projectRoot=$ProjectRoot; dataDirectory=$dataDirectory;
        node=$nodeTarget; nodeVersion=$nodeVersion; nodeSha256=(Get-FileHash -LiteralPath $nodeTarget).Hash;
        winSwVersion='2.12.0'; winSwSource=$wrapperUrl; winSwSha256=$wrapperHash;
        serviceDirectory=$serviceDirectory; url='http://127.0.0.1:3030/' }
    Write-Utf8 $receiptPath ($receipt | ConvertTo-Json)
    $receipt | ConvertTo-Json
    exit 0
}

if ($Action -eq 'Status') {
    Get-Service -Name $serviceName -ErrorAction SilentlyContinue | Format-List Name,DisplayName,Status,StartType
    if (Test-Path -LiteralPath $receiptPath) { Get-Content -LiteralPath $receiptPath }
    exit 0
}

try {
    Assert-Administrator
    Assert-Wrapper
    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    $existingService = Get-CimInstance Win32_Service -Filter "Name='Prologue'"
    if ($existingService -and $existingService.PathName.Trim('"') -ne $wrapper) {
        throw 'Another Prologue service already exists at a different path. No changes were made.'
    }
    if ($Action -eq 'Install') {
        if (-not $existingService) {
            $listeners = @(Get-NetTCPConnection -LocalPort 3030 -State Listen -ErrorAction SilentlyContinue)
            if ($listeners.Count) {
                # Replace only the explicitly selected standalone process after elevation succeeds.
                $standalone = Get-CimInstance Win32_Process -Filter "ProcessId=$ReplaceProcessId"
                $serverPath = Join-Path $receipt.projectRoot 'server.mjs'
                if ($ReplaceProcessId -le 0 -or -not $standalone -or
                    $standalone.ExecutablePath -ne $receipt.node -or
                    $standalone.CommandLine.IndexOf($serverPath, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or
                    @($listeners | Where-Object { $_.OwningProcess -ne $ReplaceProcessId }).Count) {
                    throw 'Port 3030 is already in use. Stop the existing local server before installing the service.'
                }
                Invoke-Checked 'taskkill.exe' @('/PID', [string]$ReplaceProcessId, '/F')
            }
            # The service runs without administrator privileges; only data and logs are writable.
            Invoke-Checked 'icacls.exe' @($DevRoot, '/grant', '*S-1-5-19:RX')
            Invoke-Checked 'icacls.exe' @((Split-Path -Parent $receipt.node), '/grant', '*S-1-5-19:(OI)(CI)RX')
            Invoke-Checked 'icacls.exe' @($serviceDirectory, '/grant', '*S-1-5-19:(OI)(CI)RX')
            Invoke-Checked 'icacls.exe' @((Join-Path $serviceDirectory 'logs'), '/grant', '*S-1-5-19:(OI)(CI)M')
            Invoke-Checked 'icacls.exe' @($receipt.projectRoot, '/grant', '*S-1-5-19:RX')
            Invoke-Checked 'icacls.exe' @((Join-Path $receipt.projectRoot 'server.mjs'), '/grant', '*S-1-5-19:RX')
            Invoke-Checked 'icacls.exe' @((Join-Path $receipt.projectRoot 'public'), '/grant', '*S-1-5-19:(OI)(CI)RX')
            Invoke-Checked 'icacls.exe' @($receipt.dataDirectory, '/grant', '*S-1-5-19:(OI)(CI)M')
            Invoke-Checked $wrapper @('install')
        }
        Start-Service -Name $serviceName
    }
    if ($Action -eq 'Start') { Start-Service -Name $serviceName }
    if ($Action -eq 'Stop') { Stop-Service -Name $serviceName }
    if ($Action -eq 'Restart') { Restart-Service -Name $serviceName }
    if ($Action -eq 'Uninstall') {
        if ((Get-Service -Name $serviceName).Status -ne 'Stopped') { Stop-Service -Name $serviceName }
        Invoke-Checked $wrapper @('uninstall')
    }
    if ($Action -in @('Install','Start','Restart')) { Wait-Ready $receipt.url }
    $result = [ordered]@{ok=$true; action=$Action; url=$receipt.url; time=(Get-Date).ToString('o')}
    Write-Utf8 $resultPath ($result | ConvertTo-Json)
    $result | ConvertTo-Json
} catch {
    if (Test-Path -LiteralPath $serviceDirectory) {
        Write-Utf8 $resultPath (@{ok=$false;action=$Action;error=$_.Exception.Message;time=(Get-Date).ToString('o')} | ConvertTo-Json)
    }
    Write-Error $_
    exit 1
}
