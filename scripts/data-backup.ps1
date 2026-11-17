# Consistent snapshots: call only after the service has fully stopped.
function Get-PrologueFileHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '') }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Backup-PrologueData([string]$DataDirectory, [string]$BackupRoot) {
    $directory = Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N'))
    $records = @()
    foreach ($relative in @('store.json', 'demo\store.json')) {
        $source = Join-Path $DataDirectory $relative
        if (-not (Test-Path -LiteralPath $source)) { continue }
        $target = Join-Path $directory $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
        $hash = Get-PrologueFileHash $source
        if ((Get-PrologueFileHash $target) -ne $hash) { throw 'Data backup verification failed. Reinstallation stopped.' }
        $records += [pscustomobject]@{source=$source; backup=$target; sha256=$hash}
    }
    if ($records.Count) {
        [IO.File]::WriteAllText((Join-Path $directory 'manifest.json'), (ConvertTo-Json -InputObject $records), [Text.UTF8Encoding]::new($false))
    }
    return $records
}

function Assert-PrologueDataUnchanged([object[]]$Records) {
    foreach ($record in $Records) {
        if (-not (Test-Path -LiteralPath $record.source) -or
            (Get-PrologueFileHash $record.source) -ne $record.sha256) {
            throw "Preserved data changed unexpectedly: $($record.source). Verified backup: $($record.backup)"
        }
        if ((Get-PrologueFileHash $record.backup) -ne $record.sha256) {
            throw "Backup changed unexpectedly: $($record.backup)"
        }
    }
}
