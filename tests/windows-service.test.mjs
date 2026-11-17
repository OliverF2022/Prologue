import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';

test('Windows PowerShell 5.1 resolves service installer defaults before reading status', {
  skip: process.platform !== 'win32',
}, () => {
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = fileURLToPath(new URL('../scripts/windows-service.ps1', import.meta.url));
  const result = spawnSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-Action', 'Status', '-DevRoot', join(tmpdir(), 'prologue-service-status-test')], {
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('service snapshots preserve both stores byte-for-byte and detect later data changes',{
  skip:process.platform!=='win32',
},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'prologue-backup-test-'));
  try{
    const data=join(directory,'data'),backup=join(directory,'backups');
    await mkdir(join(data,'demo'),{recursive:true});
    const main='{"generation":"real","tasks":[{"title":"original"}]}',demo='{"generation":"demo","reviews":[{"text":"keep me"}]}';
    await writeFile(join(data,'store.json'),main);await writeFile(join(data,'demo','store.json'),demo);
    const quote=value=>"'"+value.replaceAll("'","''")+"'";
    const helper=fileURLToPath(new URL('../scripts/data-backup.ps1',import.meta.url));
    const script=join(directory,'verify.ps1');
    await writeFile(script,`$ErrorActionPreference='Stop'
. ${quote(helper)}
$records=@(Backup-PrologueData ${quote(data)} ${quote(backup)})
Assert-PrologueDataUnchanged $records
$records | ConvertTo-Json
[IO.File]::AppendAllText($records[0].source, ' ')
try { Assert-PrologueDataUnchanged $records; throw 'Missing mismatch detection' }
catch { if ($_.Exception.Message -notlike 'Preserved data changed unexpectedly:*') { throw } }
`);
    const powershell=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const result=spawnSync(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8',windowsHide:true,timeout:20000});
    assert.equal(result.status,0,result.stderr||result.stdout);
    const records=JSON.parse(result.stdout);assert.equal(records.length,2);
    assert.equal(await readFile(records[0].backup,'utf8'),main);assert.equal(await readFile(records[1].backup,'utf8'),demo);
    assert.equal(await readFile(join(data,'demo','store.json'),'utf8'),demo);
    const installer=fileURLToPath(new URL('../scripts/windows-service.ps1',import.meta.url));
    const conflict=spawnSync(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',installer,'-Action','Reinstall','-PreserveData','-ResetData'],{encoding:'utf8',windowsHide:true,timeout:20000});
    assert.notEqual(conflict.status,0);assert.match(conflict.stderr,/PreserveData cannot be combined with ResetData/);
  }finally{await rm(directory,{recursive:true,force:true})}
});
