import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const url = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip';
export const sha256 = 'b950e39f01af1d04ea623c8f6d8eb9b6ea5c477c637295fabf20631c85116bfb';
export async function prepareVbCable() {
  if (process.platform !== 'win32') throw new Error('VB-CABLE staging requires Windows signature verification.');
  const directory = path.resolve('.tools/vb-cable-package');
  const archive = path.join(directory, 'VBCABLE_Driver_Pack45.zip');
  await fs.mkdir(directory, { recursive: true });
  let bytes;
  try { bytes = await fs.readFile(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== sha256) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`VB-CABLE download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('VB-CABLE archive checksum mismatch; refusing changed upstream package.');
    await fs.writeFile(archive, bytes);
  }
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
    path.resolve('native/vb-cable/verify.ps1'), '-Archive', archive], { stdio: 'inherit' });
  await fs.copyFile('native/vb-cable/NOTICE.txt', path.join(directory, 'NOTICE.txt'));
  console.log('Staged original VB-CABLE package with verified SHA-256 and publisher signatures.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareVbCable();
