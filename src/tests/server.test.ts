import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { startServer } from '../server/server.js';
import { encodeFrame } from '../shared/audio.js';

function waitMessage(ws: WebSocket, predicate: (data: any, binary: boolean) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.off('message', listener); reject(new Error('Message timeout')); }, 5000);
    function listener(data: Buffer, binary: boolean) {
      const decoded = binary ? data : JSON.parse(data.toString());
      if (predicate(decoded, binary)) { clearTimeout(timeout); ws.off('message', listener); resolve(decoded); }
    }
    ws.on('message', listener);
  });
}
test('paired phone streams exact PCM, controls sync, records WAV, and rejects strangers', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'micbridge-test-'));
  const server = await startServer({ directory, localPort: 0, mobilePort: 0, setupPort: 0 });
  const sockets: WebSocket[] = [];
  try {
    assert.equal((await fetch(`http://127.0.0.1:${server.localPort}/api/config`)).status, 401);
    const token = (await fs.readFile(path.join(directory, 'pairing-token'), 'utf8')).trim();
    const desktop = new WebSocket(`ws://127.0.0.1:${server.localPort}/stream`); sockets.push(desktop); await once(desktop, 'open');
    let ready = waitMessage(desktop, data => data.type === 'ready'); desktop.send(JSON.stringify({ type: 'auth', role: 'desktop', token: server.adminToken })); await ready;
    const stranger = new WebSocket(`ws://127.0.0.1:${server.localPort}/stream`); sockets.push(stranger); await once(stranger, 'open');
    const rejected = once(stranger, 'close'); stranger.send(JSON.stringify({ type: 'auth', role: 'sender', token: 'wrong' })); await rejected;
    // Exercise the phone's actual TLS listener, without trusting the test certificate globally.
    const phone = new WebSocket(`wss://127.0.0.1:${server.mobilePort}/stream`, { rejectUnauthorized: false }); sockets.push(phone); await once(phone, 'open');
    ready = waitMessage(phone, data => data.type === 'ready'); phone.send(JSON.stringify({ type: 'auth', role: 'sender', token, device: 'Test phone' })); await ready;
    const samples = new Int16Array(960).fill(-1234);
    const bytes = encodeFrame({ samples, sequence: 0xffffffff, timestamp: 100, sampleRate: 48000 });
    let audio = waitMessage(desktop, (_, binary) => binary); phone.send(bytes); assert.deepEqual(await audio, Buffer.from(bytes));
    const settings = waitMessage(phone, data => data.type === 'settings' && data.gain === 6); desktop.send(JSON.stringify({ type: 'settings', gain: 9, muted: true })); assert.equal((await settings).muted, true);
    let recorded = waitMessage(desktop, data => data.type === 'state' && data.state.recording); desktop.send(JSON.stringify({ type: 'record', enabled: true })); await recorded;
    audio = waitMessage(desktop, (_, binary) => binary); phone.send(encodeFrame({ samples, sequence: 0, timestamp: 120, sampleRate: 48000 })); await audio;
    recorded = waitMessage(desktop, data => data.type === 'state' && !data.state.recording); desktop.send(JSON.stringify({ type: 'record', enabled: false })); await recorded;
    const file = await fs.readFile(server.state.recordingFile!); assert.equal(file.length, 1964); assert.equal(file.readUInt32LE(40), 1920); assert.equal(file.readInt16LE(44), -1234);
    assert.equal(server.state.dropped, 0); assert.equal(server.state.frames, 2);
    const duplicate = new WebSocket(`ws://127.0.0.1:${server.localPort}/stream`); sockets.push(duplicate); await once(duplicate, 'open');
    const duplicateClosed = once(duplicate, 'close'); duplicate.send(JSON.stringify({ type: 'auth', role: 'sender', token })); await duplicateClosed;
    const closed = once(phone, 'close'); desktop.send(JSON.stringify({ type: 'disconnect' })); await closed;
  } finally { sockets.forEach(ws => ws.terminate()); await server.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
