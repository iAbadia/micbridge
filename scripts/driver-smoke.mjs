import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { encodeFrame } from '../dist/shared/audio.js';
const helper = spawn('native/bin/Micbridge.Driver.exe', [], { windowsHide: true });
let output = '', errors = '';
helper.stdout.on('data', bytes => { output += bytes.toString(); });
helper.stderr.on('data', bytes => { errors += bytes.toString(); });
const exit = once(helper, 'exit');
for (let i = 0; i < 50 && !output.includes('ready') && helper.exitCode === null; i++) await pause(100);
if (!output.includes('ready')) { helper.kill(); throw new Error(`Driver registration failed: ${errors}`); }
for (let i = 0; i < 10; i++) {
  const frame = encodeFrame({ sequence: i, timestamp: i * 20, sampleRate: 48000, samples: new Int16Array(960) });
  const prefix = Buffer.alloc(4); prefix.writeUInt32LE(frame.length); helper.stdin.write(Buffer.concat([prefix, frame])); await pause(20);
}
helper.stdin.end();
const [code] = await exit;
console.log(output.trim());
if (code !== 0 || errors) throw new Error(`Driver smoke failed (${code}): ${errors}`);
