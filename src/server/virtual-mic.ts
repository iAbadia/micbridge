import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { HEADER_BYTES } from '../shared/audio.js';
const exec = promisify(execFile);
export class VirtualMicrophone {
  private process: ChildProcessWithoutNullStreams | null = null;
  private modules: string[] = [];
  private starting = false;
  public dropped = 0;
  constructor(private status: (value: string) => void) {}
  async start() {
    if (this.process || this.starting) return;
    this.starting = true; this.status('Starting');
    try {
      if (process.platform === 'linux') {
        const sink = await exec('pactl', ['load-module', 'module-null-sink', 'sink_name=micbridge_sink', 'sink_properties=device.description=Micbridge']);
        this.modules.push(sink.stdout.trim());
        const source = await exec('pactl', ['load-module', 'module-remap-source', 'master=micbridge_sink.monitor', 'source_name=micbridge_mic', 'source_properties=device.description=Micbridge_Microphone']);
        this.modules.push(source.stdout.trim());
        this.process = spawn('pacat', ['--playback', '--device=micbridge_sink', '--format=s16le', '--rate=48000', '--channels=1', '--latency-msec=40']);
        await new Promise<void>((resolve, reject) => { this.process!.once('spawn', resolve); this.process!.once('error', reject); });
      } else throw new Error('Use Desktop output to route audio to an independently installed virtual audio device');
      const child = this.process!;
      child.stdin.on('error', err => this.status(`Output error: ${err.message}`));
      child.stderr.on('data', bytes => this.status(`Output: ${bytes.toString().trim().slice(0, 200)}`));
      child.once('exit', () => { if (this.process === child) { this.process = null; this.status('Stopped'); } });
      this.status('Active');
    } catch (err) { await this.stop(); this.status(`Unavailable: ${(err as Error).message}`); }
    finally { this.starting = false; }
  }
  write(frame: Buffer) {
    const child = this.process; if (!child || !child.stdin.writable) return;
    if (frame.readUInt32LE(16) !== 48000) { this.status('Requires 48 kHz capture'); return; }
    if (child.stdin.writableLength > 192000) { this.dropped++; return; }
    child.stdin.write(frame.subarray(HEADER_BYTES));
  }
  async stop() {
    const child = this.process; this.process = null;
    if (child) {
      child.stdin.end();
      await new Promise<void>(resolve => {
        let timer: ReturnType<typeof setTimeout>;
        const done = () => { clearTimeout(timer); resolve(); };
        child.once('exit', done); timer = setTimeout(() => { child.kill(); resolve(); }, 2000);
      });
    }
    for (const id of this.modules.reverse()) { if (/^\d+$/.test(id)) await exec('pactl', ['unload-module', id]).catch(() => {}); }
    this.modules = []; this.status('Stopped');
  }
}
