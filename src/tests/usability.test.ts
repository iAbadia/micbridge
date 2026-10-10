import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { once } from 'node:events';
import { X509Certificate } from 'node:crypto';
import https from 'node:https';
import type http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/server.js';
import { localCertificates, certificateProfile } from '../server/certificates.js';

test('bookmarked pairing survives restart, rotation persists, and trusted HTTPS verifies', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'micbridge-pairing-'));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const sockets: WebSocket[] = [];
  let mobilePort = 0, setupPort = 0;
  const launch = () => startServer({ directory, localPort: 0, mobilePort, setupPort });
  try {
    server = await launch();
    mobilePort = server.mobilePort; setupPort = server.setupPort;
    const config = await server.config(); const original = (await fs.readFile(path.join(directory, 'pairing-token'), 'utf8')).trim();
    await assert.rejects(launch, /fixed ports/);
    const ca = await fs.readFile(path.join(directory, 'root-ca.pem'), 'utf8');
    const localBase = `http://127.0.0.1:${server.localPort}`;
    assert.equal((await (await fetch(localBase + '/manifest.webmanifest')).json()).start_url, '/phone');
    assert.equal((await (await fetch(localBase + '/manifest.webmanifest?token=wrong')).json()).start_url, '/phone');
    assert.equal((await (await fetch(localBase + '/manifest.webmanifest?token=' + original)).json()).start_url, '/phone');
    await new Promise<void>((resolve, reject) => {
      https.get(`https://127.0.0.1:${server!.mobilePort}/phone`, { ca }, response => {
        assert.equal(response.statusCode, 200); response.resume(); response.on('end', resolve);
      }).on('error', reject);
    });
    const base = `http://127.0.0.1:${server.setupPort}`;
    assert.equal((await fetch(base + '/phone')).status, 404);
    assert.equal((await fetch(base + '/api/config')).status, 404);
    assert.equal((await fetch(base + '/setup')).status, 200);
    assert.equal((await (await fetch(base + '/setup-info')).json()).fingerprint, config.fingerprint);
    const profile = await (await fetch(base + '/micbridge.mobileconfig')).text();
    assert.ok(profile.includes(new X509Certificate(ca).raw.toString('base64')));
    await server.close(); server = await launch();
    assert.deepEqual((await server.config()).urls, config.urls);
    assert.equal((await fs.readFile(path.join(directory, 'pairing-token'), 'utf8')).trim(), original);
    assert.equal((await server.config()).fingerprint, config.fingerprint);
    const desktop = new WebSocket(`ws://127.0.0.1:${server.localPort}/stream`); sockets.push(desktop);
    await once(desktop, 'open');
    const ready = once(desktop, 'message'); desktop.send(JSON.stringify({ type: 'auth', role: 'desktop', token: server.adminToken })); await ready;
    const rotated = new Promise<void>(resolve => desktop.on('message', data => { if (JSON.parse(data.toString()).type === 'rotated') resolve(); }));
    desktop.send(JSON.stringify({ type: 'rotate' })); await rotated;
    desktop.terminate(); await server.close(); const newToken = await fs.readFile(path.join(directory, 'pairing-token'), 'utf8'); assert.notEqual(newToken, original);
    server = await launch();
    assert.equal(await fs.readFile(path.join(directory, 'pairing-token'), 'utf8'), newToken);
    const oldPhone = new WebSocket(`wss://127.0.0.1:${server.mobilePort}/stream`, { ca }); sockets.push(oldPhone);
    await once(oldPhone, 'open'); const closed = once(oldPhone, 'close');
    oldPhone.send(JSON.stringify({ type: 'auth', role: 'sender', token: original })); await closed;
  } finally { sockets.forEach(ws => ws.terminate()); await server?.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('address changes renew the server certificate while preserving the trusted authority', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'micbridge-ca-'));
  try {
    const first = await localCertificates(directory, ['192.168.1.10']);
    const next = await localCertificates(directory, ['192.168.1.20']);
    assert.equal(first.certificate, next.certificate);
    assert.notEqual(first.tls.cert, next.tls.cert);
    const leaf = new X509Certificate(next.tls.cert), root = new X509Certificate(next.certificate);
    assert.equal(leaf.ca, false); assert.ok(leaf.checkIP('192.168.1.20')); assert.ok(leaf.verify(root.publicKey));
    assert.ok(certificateProfile(next.certificate).includes('com.apple.security.root'));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('one-time code sets secure persistent cookie, authenticates audio, and survives restart', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'micbridge-cookie-'));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const sockets: WebSocket[] = [];
  const launch = () => startServer({ directory, localPort: 0, mobilePort: 0, setupPort: 0 });
  try {
    server = await launch();
    const ca = await fs.readFile(path.join(directory, 'root-ca.pem'), 'utf8');
    const request = (route: string, body?: unknown, cookie?: string, origin?: string) => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = https.request(`https://127.0.0.1:${server!.mobilePort}${route}`, { ca, method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Origin: origin ?? `https://127.0.0.1:${server!.mobilePort}`, ...(cookie ? { Cookie: cookie } : {}) } }, response => {
        let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: text }));
      }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
    });
    assert.equal(JSON.parse((await request('/api/pairing')).body).paired, false);
    const code = (await server.config()).pairingCode;
    assert.equal((await request('/api/pair', { code }, undefined, 'https://elsewhere.test')).status, 403);
    assert.equal((await request('/api/pair', { code: '000000' })).status, 401);
    const paired = await request('/api/pair', { code }); assert.equal(paired.status, 204);
    const setCookie = paired.headers['set-cookie']![0];
    assert.match(setCookie, /HttpOnly; Secure; SameSite=Strict/); assert.match(setCookie, /Max-Age=31536000/);
    const cookie = setCookie.split(';')[0];
    assert.equal(JSON.parse((await request('/api/pairing', undefined, cookie)).body).paired, true);
    assert.equal((await request('/api/pair', { code })).status, 401);
    const phone = new WebSocket(`wss://127.0.0.1:${server.mobilePort}/stream`, { ca, headers: { Cookie: cookie } }); sockets.push(phone);
    await once(phone, 'open'); const ready = once(phone, 'message'); phone.send(JSON.stringify({ type: 'auth', role: 'sender' }));
    assert.equal(JSON.parse((await ready)[0].toString()).type, 'ready');
    phone.terminate(); await server.close(); server = await launch();
    assert.equal(JSON.parse((await request('/api/pairing', undefined, cookie)).body).paired, true);
    const desktop = new WebSocket(`ws://127.0.0.1:${server.localPort}/stream`); sockets.push(desktop); await once(desktop, 'open');
    const auth = once(desktop, 'message'); desktop.send(JSON.stringify({ type: 'auth', role: 'desktop', token: server.adminToken })); await auth;
    const rotated = new Promise<void>(resolve => desktop.on('message', bytes => { if (JSON.parse(bytes.toString()).type === 'rotated') resolve(); }));
    desktop.send(JSON.stringify({ type: 'rotate' })); await rotated;
    assert.equal(JSON.parse((await request('/api/pairing', undefined, cookie)).body).paired, false);
    for (let i = 0; i < 10; i++) await request('/api/pair', { code: '000000' });
    assert.equal((await request('/api/pair', { code: (await server.config()).pairingCode })).status, 429);
    assert.equal((await fetch(`http://127.0.0.1:${server.localPort}/api/pair`, { method: 'POST', body: JSON.stringify({ code }) })).status, 403);
  } finally { sockets.forEach(ws => ws.terminate()); await server?.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
