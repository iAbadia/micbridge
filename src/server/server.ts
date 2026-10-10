import http from 'node:http';
import https from 'node:https';
import { randomBytes, randomInt, timingSafeEqual, X509Certificate } from 'node:crypto';
import { TLSSocket } from 'node:tls';
import { networkInterfaces } from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { localCertificates, certificateProfile } from './certificates.js';
import QRCode from 'qrcode';
import { decodeFrame, rms, waveHeader, HEADER_BYTES } from '../shared/audio.js';
import { VirtualMicrophone } from './virtual-mic.js';

export interface Options { directory: string; webRoot?: string; localPort?: number; mobilePort?: number; setupPort?: number; tls?: { key: string; cert: string } }
export interface StreamState {
  connected: boolean; device: string; frames: number; bytes: number; dropped: number;
  sampleRate: number; level: number; recording: boolean; recordingFile: string | null;
  gain: number; muted: boolean; noiseSuppression: boolean; error: string | null;
  virtualMic: string; virtualDrops: number;
}
const equal = (a: unknown, b: string) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function lanAddresses(): string[] {
  const rank = (ip: string) => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3;
  return [...new Set(Object.values(networkInterfaces()).flatMap(items => items ?? []).filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address))].sort((a, b) => rank(a) - rank(b));
}

export async function startServer(options: Options) {
  await fs.mkdir(options.directory, { recursive: true });
  const webRoot = options.webRoot ?? fileURLToPath(new URL('../../web/', import.meta.url));
  const adminToken = randomBytes(24).toString('hex');
  let pairToken = randomBytes(24).toString('hex');
  const pairingPath = path.join(options.directory, 'pairing-token');
  try {
    const saved = (await fs.readFile(pairingPath, 'utf8')).trim();
    if (!/^[a-f0-9]{48}$/.test(saved)) throw new Error('Invalid saved pairing credential');
    pairToken = saved;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    await fs.writeFile(pairingPath, pairToken, { mode: 0o600 });
  }
  let pairingWrites: Promise<void> = Promise.resolve();
  let pairingCode = String(randomInt(100000, 1000000)), pairingExpires = Date.now() + 10 * 60000;
  const refreshCode = () => { const previous = pairingCode; do { pairingCode = String(randomInt(100000, 1000000)); } while (pairingCode === previous); pairingExpires = Date.now() + 10 * 60000; };
  const phoneCookie = (request: http.IncomingMessage) => request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('__Host-micbridge='))?.slice('__Host-micbridge='.length);
  let attempts = 0, attemptWindow = Date.now();
  const addresses = lanAddresses();
  const certificates = options.tls ? { tls: options.tls, certificate: options.tls.cert, fingerprint: new X509Certificate(options.tls.cert).fingerprint256 } : await localCertificates(options.directory, addresses);
  const tls = certificates.tls;
  const state: StreamState = { connected: false, device: '', frames: 0, bytes: 0, dropped: 0, sampleRate: 48000, level: 0, recording: false, recordingFile: null, gain: 1, muted: false, noiseSuppression: true, error: null, virtualMic: 'Stopped', virtualDrops: 0 };
  try {
    const stored = JSON.parse(await fs.readFile(path.join(options.directory, 'settings.json'), 'utf8'));
    if (typeof stored.gain === 'number' && Number.isFinite(stored.gain)) state.gain = Math.max(0, Math.min(6, stored.gain));
    if (typeof stored.noiseSuppression === 'boolean') state.noiseSuppression = stored.noiseSuppression;
  } catch { /* First launch has no saved settings. */ }
  let settingsWrites: Promise<void> = Promise.resolve();
  function saveSettings() {
    const bytes = JSON.stringify({ gain: state.gain, noiseSuppression: state.noiseSuppression });
    settingsWrites = settingsWrites.then(async () => {
      const temporary = path.join(options.directory, 'settings.json.tmp');
      await fs.writeFile(temporary, bytes); await fs.rename(temporary, path.join(options.directory, 'settings.json'));
    }).catch(err => { state.error = `Settings could not be saved: ${err.message}`; broadcastState(); });
  }
  let sender: WebSocket | null = null, lastPacket = 0, lastSequence: number | undefined;
  const receivers = new Set<WebSocket>();
  let recording: Awaited<ReturnType<typeof fs.open>> | null = null, recordingBytes = 0, recordingRate = 0;
  let recordChain: Promise<void> = Promise.resolve();
  let recordOperations: Promise<void> = Promise.resolve();
  let pendingRecordBytes = 0;
  let closed = false;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const send = (ws: WebSocket, value: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value)); };
  const broadcastState = () => { for (const ws of receivers) send(ws, { type: 'state', state }); };
  const resetStream = () => { state.connected = false; state.device = ''; state.level = 0; lastSequence = undefined; broadcastState(); };
  const control = () => { if (sender) send(sender, { type: 'settings', gain: state.gain, muted: state.muted, noiseSuppression: state.noiseSuppression }); };
  const virtual = new VirtualMicrophone(value => { state.virtualMic = value; broadcastState(); });
  let virtualOperations: Promise<void> = Promise.resolve();

  async function stopRecording() {
    state.recording = false;
    await recordChain;
    if (recording) {
      const handle = recording; recording = null;
      await handle.write(waveHeader(recordingBytes, recordingRate), 0, 44, 0);
      await handle.close();
    }
    broadcastState();
  }
  async function beginRecording() {
    if (recording) return;
    if (!state.connected || !state.frames) throw new Error('Wait for phone audio before recording');
    const filename = `micbridge-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    await fs.mkdir(path.join(options.directory, 'recordings'), { recursive: true });
    recording = await fs.open(path.join(options.directory, 'recordings', filename), 'wx');
    recordingBytes = 0; recordingRate = state.sampleRate; recordChain = Promise.resolve();
    await recording.write(waveHeader(0, recordingRate), 0, 44, 0);
    state.recording = true; state.recordingFile = path.join(options.directory, 'recordings', filename); broadcastState();
  }
  function onAudio(ws: WebSocket, bytes: Buffer) {
    if (ws !== sender) return ws.close(1008, 'Only the paired sender can send audio');
    const frame = decodeFrame(bytes);
    if (lastSequence !== undefined) {
      const delta = (frame.sequence - lastSequence) >>> 0;
      if (!delta || delta > 0x7fffffff) return;
      state.dropped += delta - 1;
    }
    if (state.frames && frame.sampleRate !== state.sampleRate) throw new Error('Audio format changed during streaming');
    lastSequence = frame.sequence; lastPacket = Date.now();
    state.frames++; state.bytes += bytes.length - HEADER_BYTES; state.sampleRate = frame.sampleRate; state.level = rms(frame.samples);
    virtual.write(bytes); state.virtualDrops = virtual.dropped;
    for (const receiver of receivers) {
      if (receiver.readyState === WebSocket.OPEN && receiver.bufferedAmount < 192000) receiver.send(bytes);
    }
    if (state.recording && recording) {
      if (pendingRecordBytes > 4 * 1024 * 1024) {
        state.error = 'Recording stopped because the disk could not keep up'; state.recording = false;
        recordOperations = recordOperations.then(stopRecording); return;
      }
      const pcm = Buffer.from(bytes.subarray(HEADER_BYTES));
      const handle = recording;
      if (recordingBytes + pcm.length > 0xfffffff0 - 44) { void stopRecording(); return; }
      const offset = 44 + recordingBytes; recordingBytes += pcm.length;
      pendingRecordBytes += pcm.length;
      recordChain = recordChain.then(async () => { await handle.write(pcm, 0, pcm.length, offset); }).catch(err => { state.error = `Recording failed: ${err.message}`; state.recording = false; }).finally(() => { pendingRecordBytes -= pcm.length; });
    }
  }
  wss.on('connection', (ws, request) => {
    let authorized = false, role = '';
    const deadline = setTimeout(() => ws.close(1008, 'Authentication timed out'), 5000);
    ws.on('error', () => {});
    ws.on('message', (data, binary) => {
      try {
        if (binary) { if (!authorized || role !== 'sender') throw new Error('Unauthenticated audio'); onAudio(ws, Buffer.from(data as Buffer)); return; }
        const message = JSON.parse(data.toString());
        if (!authorized) {
          if (message.type !== 'auth') throw new Error('Authenticate first');
          if (message.role === 'desktop' && equal(message.token, adminToken)) { role = 'desktop'; receivers.add(ws); }
          else if (message.role === 'sender' && (equal(message.token, pairToken) || (request.socket instanceof TLSSocket && equal(phoneCookie(request), pairToken)))) {
            if (sender) throw new Error('A phone is already connected');
            role = 'sender'; sender = ws; lastSequence = undefined; lastPacket = Date.now();
            state.connected = true; state.frames = 0; state.bytes = 0; state.dropped = 0; state.error = null;
            state.sampleRate = 0;
            state.device = typeof message.device === 'string' ? message.device.slice(0, 80) : 'Browser microphone';
          } else throw new Error('Invalid pairing token');
          authorized = true; clearTimeout(deadline); send(ws, { type: 'ready', state }); control(); broadcastState(); return;
        }
        if ((role === 'desktop' || role === 'sender') && message.type === 'settings') {
          if (typeof message.gain === 'number' && Number.isFinite(message.gain)) state.gain = Math.max(0, Math.min(6, message.gain));
          if (typeof message.muted === 'boolean') state.muted = message.muted;
          if (typeof message.noiseSuppression === 'boolean') state.noiseSuppression = message.noiseSuppression;
          if (role === 'desktop') control();
          saveSettings(); broadcastState();
        } else if (role === 'desktop' && message.type === 'record') {
          recordOperations = recordOperations.then(() => message.enabled ? beginRecording() : stopRecording()).catch(err => { state.error = err.message; broadcastState(); });
        } else if (role === 'desktop' && message.type === 'virtualMic') {
          virtualOperations = virtualOperations.then(() => message.enabled ? virtual.start() : virtual.stop());
        } else if (role === 'desktop' && message.type === 'disconnect') sender?.close(1000, 'Disconnected by desktop');
        else if (role === 'desktop' && message.type === 'rotate') {
          pairToken = randomBytes(24).toString('hex');
          const savedToken = pairToken;
          pairingWrites = pairingWrites.then(async () => {
            await fs.writeFile(pairingPath + '.tmp', savedToken, { mode: 0o600 }); await fs.rename(pairingPath + '.tmp', pairingPath);
          }).catch(err => { state.error = 'Pairing link could not be saved: ' + err.message; broadcastState(); });
          refreshCode(); sender?.close(1000, 'Phone pairing reset'); send(ws, { type: 'rotated' });
        } else if (role === 'desktop' && message.type === 'newCode') {
          refreshCode(); send(ws, { type: 'rotated' });
        }
      } catch (err) { send(ws, { type: 'error', message: (err as Error).message }); ws.close(1008, 'Invalid message'); }
    });
    ws.on('close', () => {
      clearTimeout(deadline); receivers.delete(ws);
      if (sender === ws) { sender = null; resetStream(); recordOperations = recordOperations.then(stopRecording); }
    });
  });
  let mobilePort = options.mobilePort ?? 8443, localPort = options.localPort ?? 0, setupPort = options.setupPort ?? 8442;
  async function config() {
    const urls = (addresses.length ? addresses : ['127.0.0.1']).map(ip => `https://${ip}:${mobilePort}/phone`);
    const qrs = await Promise.all(urls.map(url => QRCode.toDataURL(url, { width: 240, margin: 1 })));
    return { urls, qr: qrs[0], qrs, pairingCode, pairingExpires, state, platform: process.platform, version: '0.3.1', fingerprint: certificates.fingerprint,
      setupUrls: (addresses.length ? addresses : ['127.0.0.1']).map(ip => `http://${ip}:${setupPort}/setup`),
      setupQrs: await Promise.all((addresses.length ? addresses : ['127.0.0.1']).map(ip => QRCode.toDataURL(`http://${ip}:${setupPort}/setup`, { width: 240, margin: 1 }))) };
  }
  const handler: http.RequestListener = (request, response) => { void (async () => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self'; object-src 'none'; frame-ancestors 'none'");
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/pairing' && request.method === 'GET') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ paired: request.socket instanceof TLSSocket && equal(phoneCookie(request), pairToken) })); return;
    }
    if (pathname === '/api/pair' && request.method === 'POST') {
      if (!(request.socket instanceof TLSSocket) || request.headers.origin !== `https://${request.headers.host}` || !request.headers['content-type']?.startsWith('application/json')) { response.writeHead(403).end(); return; }
      if (Date.now() - attemptWindow > 60000) { attempts = 0; attemptWindow = Date.now(); }
      if (++attempts > 10) { response.setHeader('Retry-After', '60'); response.writeHead(429).end('Too many attempts. Wait one minute.'); return; }
      let body = '';
      for await (const chunk of request) { body += chunk.toString(); if (Buffer.byteLength(body) > 512) { response.writeHead(413).end(); return; } }
      let value: any;
      try { value = JSON.parse(body); } catch { response.writeHead(400).end('Invalid pairing request'); return; }
      if (!equal(value.token, pairToken) && !(Date.now() < pairingExpires && equal(value.code, pairingCode))) { response.writeHead(401).end('Code is incorrect or expired. Get a new code from the desktop.'); return; }
      response.setHeader('Set-Cookie', `__Host-micbridge=${pairToken}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
      refreshCode(); for (const ws of receivers) send(ws, { type: 'rotated' });
      response.writeHead(204).end(); return;
    }
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (pathname === '/api/config') {
      if (!equal(request.headers.authorization?.replace(/^Bearer /, ''), adminToken)) { response.writeHead(401).end(); return; }
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(await config())); return;
    }
    if (pathname === '/certificate.crt') {
      response.setHeader('Content-Type', 'application/x-x509-ca-cert'); response.setHeader('Content-Disposition', 'attachment; filename="micbridge.crt"'); response.end(certificates.certificate); return;
    }
    if (pathname === '/setup-info') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ fingerprint: certificates.fingerprint })); return;
    }
    if (pathname === '/manifest.webmanifest') {
      const manifest = JSON.parse(await fs.readFile(path.join(webRoot, 'manifest.webmanifest'), 'utf8'));
      response.setHeader('Content-Type', 'application/manifest+json'); response.end(JSON.stringify(manifest)); return;
    }
    if (pathname === '/micbridge.mobileconfig') {
      response.setHeader('Content-Type', 'application/x-apple-aspen-config'); response.setHeader('Content-Disposition', 'attachment; filename="micbridge.mobileconfig"'); response.end(certificateProfile(certificates.certificate)); return;
    }
    const files: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html'], '/setup': ['setup.html', 'text/html'], '/setup.js': ['setup.js', 'application/javascript'], '/icon.svg': ['icon.svg', 'image/svg+xml'], '/icon.png': ['icon.png', 'image/png'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/phone': ['index.html', 'text/html'],
      '/app.js': ['app.js', 'application/javascript'], '/style.css': ['style.css', 'text/css'],
      '/capture-worklet.js': ['capture-worklet.js', 'application/javascript'], '/playback-worklet.js': ['playback-worklet.js', 'application/javascript']
    };
    const file = files[pathname];
    if (!file) { response.writeHead(404).end('Not found'); return; }
    response.setHeader('Content-Type', file[1]); response.end(await fs.readFile(path.join(webRoot, file[0])));
  })().catch(err => { if (!response.headersSent) response.writeHead(500); response.end('Server error'); console.error(err); }); };
  const local = http.createServer(handler), mobile = https.createServer(tls, handler);
  // HTTP serves public onboarding material only; pairing and microphone audio stay on HTTPS.
  const setup = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (!['/setup', '/setup.js', '/setup-info', '/certificate.crt', '/micbridge.mobileconfig', '/style.css', '/icon.svg'].includes(pathname)) { response.writeHead(404).end('Not found'); return; }
    handler(request, response);
  });
  for (const server of [local, mobile]) server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    if (request.url !== '/stream' || (origin && ![`http://${request.headers.host}`, `https://${request.headers.host}`].includes(origin))) { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });
  async function listen(server: http.Server, port: number, host: string) {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(); }); });
    return (server.address() as { port: number }).port;
  }
  try {
    localPort = await listen(local, localPort, '127.0.0.1');
    mobilePort = await listen(mobile, mobilePort, '0.0.0.0');
    setupPort = await listen(setup, setupPort, '0.0.0.0');
  }
  catch (err) { local.close(); mobile.close(); setup.close();
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new Error('Micbridge needs fixed ports 8443 (microphone HTTPS) and 8442 (one-time setup). Close another Micbridge instance or the app using these ports.');
    throw err;
  }
  const timer = setInterval(() => {
    if (sender && Date.now() - lastPacket > 5000) sender.close(1000, 'Microphone stream timed out');
    broadcastState();
  }, 500);
  return {
    localUrl: `http://127.0.0.1:${localPort}/#${adminToken}`, localPort, mobilePort, setupPort, adminToken,
    config, state,
    async close() {
      if (closed) return; closed = true; clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      await virtualOperations; await virtual.stop();
      await recordOperations; await stopRecording(); await settingsWrites; await pairingWrites;
      await Promise.all([local, mobile, setup].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
      wss.close();
    }
  };
}
