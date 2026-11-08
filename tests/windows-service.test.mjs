import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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
