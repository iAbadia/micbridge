import { decodeFrame, encodeFrame } from '../shared/audio';
const root = document.querySelector<HTMLDivElement>('#app')!;
const phone = location.pathname === '/phone';
let token = location.hash.slice(1);
if (phone) {
  try { if (!token) token = localStorage.getItem('micbridge-pairing') ?? ''; } catch {}
}
const desktopPlatform = new URLSearchParams(location.search).get('desktop');
if (desktopPlatform) document.body.classList.add('desktop-shell', `desktop-${desktopPlatform}`);
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let socket: WebSocket | null = null;
const settings = { gain: 1, muted: false, noiseSuppression: true };
function showError(error: unknown) { byId('error').textContent = error instanceof Error ? error.message : String(error); }
function send(value: unknown) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
function connect(role: string, device?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/stream`); socket = ws; ws.binaryType = 'arraybuffer';
    let ready = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', role, token, device }));
    ws.onerror = () => { if (!ready) reject(new Error('Cannot connect to desktop. Check the network and certificate.')); };
    ws.onmessage = event => {
      if (typeof event.data !== 'string') { receiveAudio(event.data); return; }
      const msg = JSON.parse(event.data);
      if (msg.type === 'ready') { ready = true; resolve(); if (!phone) updateState(msg.state); }
      if (msg.type === 'state') updateState(msg.state);
      if (msg.type === 'settings') { Object.assign(settings, msg); void applyPhoneSettings(); }
      if (msg.type === 'rotated') void loadConfig();
      if (msg.type === 'error') { showError(msg.message); if (!ready) reject(new Error(msg.message)); }
    };
    ws.onclose = event => {
      if (!ready) reject(new Error('Connection closed. Use the current pairing link.'));
      if (phone) { if (sending && event.reason) showError(event.reason); void stopCapture().then(checkPairing); }
      else { byId('status').textContent = 'Desktop connection closed'; showError('Restart the app to reconnect.'); }
    };
  });
}

let captureContext: AudioContext | null = null, microphone: MediaStream | null = null, capture: AudioWorkletNode | null = null, wakeLock: any = null;
let dropped = 0, sending = false;
let paired = false;
function drawPairing() {
  byId('phone-pairing').hidden = paired;
  byId<HTMLButtonElement>('start').disabled = !paired;
}
async function pairPhone(value: { code?: string; token?: string }) {
  const response = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error(await response.text());
  paired = true; token = ''; history.replaceState(null, '', '/phone');
  try { localStorage.removeItem('micbridge-pairing'); } catch {}
  drawPairing();
}
async function checkPairing() {
  try {
    if (token) { try { await pairPhone({ token }); return; } catch { token = ''; } }
    const response = await fetch('/api/pairing');
    if (!response.ok) throw new Error('Open the phone app using trusted HTTPS.');
    paired = (await response.json()).paired; drawPairing();
  } catch (err) { showError(err); paired = false; drawPairing(); }
}
function drawPhoneSettings() { byId<HTMLInputElement>('gain').value = String(settings.gain); byId('gain-value').textContent = `${Math.round(settings.gain * 100)}%`; byId<HTMLButtonElement>('mute').textContent = settings.muted ? 'Unmute' : 'Mute'; byId<HTMLInputElement>('noise').checked = settings.noiseSuppression; }
async function applyPhoneSettings() {
  if (!phone) return;
  capture?.port.postMessage(settings); drawPhoneSettings();
  if (microphone) { try { await microphone.getAudioTracks()[0].applyConstraints({ noiseSuppression: settings.noiseSuppression }); } catch { showError('This browser cannot change noise suppression while streaming.'); } }
}
async function startCapture() {
  byId('error').textContent = '';
  byId<HTMLButtonElement>('start').disabled = true;
  try {
    if (!isSecureContext || !navigator.mediaDevices) throw new Error('Microphone access requires trusted HTTPS. Trust the desktop certificate or use a trusted TLS certificate.');
    if (!paired) throw new Error('Enter the six-digit code from your desktop to pair this phone once.');
    microphone = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: settings.noiseSuppression, echoCancellation: false, autoGainControl: false }, video: false });
    captureContext = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    await captureContext.audioWorklet.addModule('/capture-worklet.js');
    capture = new AudioWorkletNode(captureContext, 'micbridge-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    capture.port.postMessage(settings);
    capture.port.onmessage = ({ data }) => {
      if (!sending || socket?.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 48000) { dropped++; byId('dropped').textContent = String(dropped); return; }
      const bytes = encodeFrame(data); socket.send(bytes);
      let sum = 0; for (const s of data.samples) sum += (s / 32768) ** 2;
      byId<HTMLProgressElement>('meter').value = Math.min(1, Math.sqrt(sum / data.samples.length) * 3);
    };
    await connect('sender', microphone.getAudioTracks()[0].label || navigator.platform || 'Phone browser');
    sending = true; dropped = 0;
    captureContext.createMediaStreamSource(microphone).connect(capture); capture.connect(captureContext.destination); await captureContext.resume();
    try { wakeLock = await (navigator as any).wakeLock?.request('screen'); } catch { /* Streaming still works while foreground. */ }
    byId('status').textContent = 'Streaming to desktop'; byId<HTMLButtonElement>('start').textContent = 'Stop microphone'; byId<HTMLButtonElement>('start').disabled = false;
    byId('format').textContent = `${captureContext.sampleRate / 1000} kHz · mono · 20 ms`;
    microphone.getAudioTracks()[0].onended = () => void stopCapture();
    captureContext.onstatechange = () => { if (captureContext?.state === 'suspended') showError('Audio is suspended. Keep this page in the foreground and tap Resume.'); };
  } catch (err) { showError(err); await stopCapture(); }
}
async function stopCapture() {
  sending = false;
  const ws = socket; socket = null; if (ws) { ws.onclose = null; ws.close(); }
  microphone?.getTracks().forEach(track => track.stop()); microphone = null;
  capture?.disconnect(); capture = null;
  const ctx = captureContext; captureContext = null; await ctx?.close();
  try { await wakeLock?.release(); } catch {} wakeLock = null;
  byId('status').textContent = 'Ready when you are'; byId<HTMLProgressElement>('meter').value = 0;
  byId<HTMLButtonElement>('start').textContent = 'Start microphone'; byId<HTMLButtonElement>('start').disabled = !paired;
}

let playbackContext: AudioContext | null = null, playback: AudioWorkletNode | null = null;
let outputEnabled = false;
let receiverPlatform = '';
let windowsVirtualEnabled = false;
async function enableWindowsMicrophone() {
  if (windowsVirtualEnabled) {
    if (outputEnabled) await enableOutput();
    windowsVirtualEnabled = false;
    byId('windows-virtual').textContent = 'Enable Micbridge microphone';
    byId('windows-virtual-status').textContent = 'Stopped';
    return;
  }
  // Device labels become available after the existing local device permission step.
  await listDevices();
  const devices = await navigator.mediaDevices.enumerateDevices();
  const target = devices.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default'
    && d.deviceId !== 'communications' && /Micbridge Input/i.test(d.label));
  if (!target) throw new Error('Micbridge driver is not installed. A signed Micbridge driver package is required. The development driver is for a separate test machine; you can still use Desktop output with a virtual audio cable.');
  // Start suspended: never send a frame to the default speakers while switching.
  if (!playbackContext) await prepareOutput();
  const context = playbackContext as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (!context.setSinkId) throw new Error('Use the Micbridge desktop app for virtual microphone routing.');
  await context.suspend(); outputEnabled = false;
  windowsVirtualEnabled = false;
  byId('windows-virtual').textContent = 'Enable Micbridge microphone';
  byId('windows-virtual-status').textContent = 'Starting';
  await context.setSinkId(target.deviceId);
  playback?.port.postMessage({ reset: true });
  await context.resume(); outputEnabled = true; windowsVirtualEnabled = true;
  byId<HTMLSelectElement>('device').value = target.deviceId;
  byId('windows-virtual').textContent = 'Stop Micbridge microphone';
  byId('windows-virtual-status').textContent = 'Active · Select Micbridge Microphone in your meeting or recording app';
  byId('output').textContent = 'Stop audio output';
}
async function prepareOutput() {
  if (playbackContext) return;
  playbackContext = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  await playbackContext.suspend();
  try {
    await playbackContext.audioWorklet.addModule('/playback-worklet.js');
    playback = new AudioWorkletNode(playbackContext, 'micbridge-playback', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    playback.port.onmessage = ({ data }) => { byId('queue').textContent = `${Math.round(data.queueMs)} ms`; byId('underruns').textContent = String(data.underruns); };
    playback.connect(playbackContext.destination);
  } catch (error) { await playbackContext.close(); playbackContext = null; playback = null; throw error; }
}
async function enableOutput() {
  await prepareOutput();
  outputEnabled = !outputEnabled;
  if (outputEnabled) await playbackContext!.resume(); else { await playbackContext!.suspend(); playback?.port.postMessage({ reset: true }); windowsVirtualEnabled = false; if (receiverPlatform === 'win32') { byId('windows-virtual').textContent = 'Enable Micbridge microphone'; byId('windows-virtual-status').textContent = 'Stopped'; } }
  byId<HTMLButtonElement>('output').textContent = outputEnabled ? 'Stop audio output' : 'Enable audio output';
}
function receiveAudio(buffer: ArrayBuffer) {
  if (!outputEnabled || !playback) return;
  try { const frame = decodeFrame(new Uint8Array(buffer)); playback.port.postMessage({ samples: frame.samples, sampleRate: frame.sampleRate }, [frame.samples.buffer]); } catch (err) { showError(err); }
}
async function listDevices() {
  try {
    const permission = await navigator.mediaDevices.getUserMedia({ audio: true }); permission.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = byId<HTMLSelectElement>('device'); select.replaceChildren();
    select.add(new Option('System default output', ''));
    for (const device of devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications')) select.add(new Option(device.label || 'Audio output', device.deviceId));
  } catch (err) { showError(err); }
}
let currentState: any = null;
function updateState(state: any) {
  if (phone) return;
  currentState = state;
  byId('status').textContent = state.connected ? 'Phone connected' : 'Waiting for a phone';
  byId('device-name').textContent = state.device || 'No microphone connected';
  byId('stream-format').textContent = state.frames ? `${state.sampleRate / 1000} kHz · PCM16 mono` : 'Audio stays on your local network';
  byId('frames').textContent = state.frames.toLocaleString(); byId('bytes').textContent = `${(state.bytes / 1024 / 1024).toFixed(1)} MB`;
  byId('loss').textContent = String(state.dropped); byId<HTMLProgressElement>('meter').value = Math.min(1, state.level * 3);
  byId('gain-value').textContent = `${Math.round(state.gain * 100)}%`; byId<HTMLInputElement>('gain').value = String(state.gain);
  byId('virtual-status').textContent = `${state.virtualMic} · ${state.virtualDrops} frames dropped`;
  byId<HTMLButtonElement>('virtual').textContent = state.virtualMic === 'Active' ? 'Stop virtual microphone' : 'Enable virtual microphone';
  byId<HTMLInputElement>('noise').checked = state.noiseSuppression; byId<HTMLButtonElement>('mute').textContent = state.muted ? 'Unmute phone' : 'Mute phone';
  byId<HTMLButtonElement>('record').textContent = state.recording ? 'Stop recording' : 'Record WAV'; byId<HTMLButtonElement>('record').disabled = !state.connected && !state.recording;
  byId('recording-file').textContent = state.recordingFile ? `Recording: ${state.recordingFile}` : 'Recordings are saved locally.';
  if (state.error) showError(state.error);
}
async function loadConfig() {
  const response = await fetch('/api/config', { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Open the desktop URL printed by the server.');
  const config = await response.json();
  byId<HTMLImageElement>('qr').src = config.qr;
  const network = byId<HTMLSelectElement>('network'); network.replaceChildren();
  for (let i = 0; i < config.urls.length; i++) network.add(new Option(new URL(config.urls[i]).hostname, String(i)));
  try { const saved = localStorage.getItem('micbridge-network'); const index = config.urls.findIndex((url: string) => new URL(url).hostname === saved); if (index >= 0) network.value = String(index); } catch {}
  let setupMode = false;
  const drawPairing = () => {
    const index = Number(network.value);
    byId<HTMLImageElement>('qr').src = setupMode ? config.setupQrs[index] : config.qrs[index];
    byId('pairing-title').textContent = setupMode ? 'Set up trusted HTTPS.' : 'Your everyday phone link.';
    byId('pairing-caption').textContent = setupMode ? 'Scan this once on your iPhone to install the certificate profile.' : 'Save this address to your home screen. Pair once using the code below; this phone will remember your desktop.';
    byId('setup-toggle').textContent = setupMode ? 'Show microphone link' : 'First-time iPhone setup';
    byId<HTMLAnchorElement>('phone-link').href = config.urls[index];
    byId('phone-link').textContent = config.urls[index];
    byId<HTMLAnchorElement>('setup-link').href = config.setupUrls[index];
    byId('setup-link').textContent = config.setupUrls[index];
  };
  network.onchange = () => { try { localStorage.setItem('micbridge-network', new URL(config.urls[Number(network.value)]).hostname); } catch {} drawPairing(); };
  byId('setup-toggle').onclick = () => { setupMode = !setupMode; drawPairing(); };
  byId('copy-link').onclick = () => { void navigator.clipboard.writeText(config.urls[Number(network.value)]).then(() => { byId('copy-link').textContent = 'Copied'; }).catch(showError); };
  const urls = byId('urls'); urls.replaceChildren();
  for (const url of config.urls) { const p = document.createElement('p'); p.className = 'url'; p.textContent = url; urls.append(p); }
  byId('linux-routing').hidden = config.platform !== 'linux';
  receiverPlatform = config.platform;
  byId('windows-routing').hidden = config.platform !== 'win32';
  byId('platform').textContent = `${config.platform} · v${config.version}`;
  byId('fingerprint').textContent = config.fingerprint;
  byId('pairing-code').textContent = config.pairingCode;
  byId('code-expiry').textContent = Date.now() < config.pairingExpires ? 'Enter this code once in your phone app. Valid for 10 minutes.' : 'Code expired. Generate a new one to pair a phone.';
  drawPairing();
  updateState(config.state);
}

if (phone) {
  root.innerHTML = `<div class="phone"><div class="brand"><img class="brand-icon" src="/icon.svg" alt="">Micbridge</div><p class="eyebrow">Your phone, your microphone</p><h1>Sound travels.<br>You stay here.</h1><p class="muted">Send your microphone to the desktop on the same network.</p><section class="card center"><div class="status-orb">◉</div><h2 id="status">Ready when you are</h2><p class="muted" id="format">Tap below to allow microphone access.</p><div class="level"><progress id="meter" max="1" value="0"></progress></div><form id="phone-pairing" class="pairing-form"><label for="pair-code">Pair this phone once</label><p class="muted">Enter the six-digit code shown on your desktop.</p><input id="pair-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="123456" required aria-label="Desktop pairing code"><button class="primary full spacer" id="pair-submit" type="submit">Pair phone</button><p id="pair-error" class="error" role="alert"></p></form><button class="primary full" id="start" disabled>Start microphone</button><div class="actions"><button id="mute">Mute</button><button id="resume">Resume audio</button></div><div class="field"><label for="gain">Input gain</label><input id="gain" type="range" min="0" max="6" step=".01" value="1"><span id="gain-value">100%</span></div><div class="field"><label for="noise">Browser noise reduction</label><input type="checkbox" id="noise" checked></div><p class="error" id="error"></p></section><p class="foot">Keep this page open. Mobile browsers may stop capture when the screen locks. <span id="dropped">0</span> frames skipped to keep audio live.</p></div>`;
  byId<HTMLFormElement>('phone-pairing').onsubmit = event => {
    event.preventDefault(); byId('pair-error').textContent = ''; byId<HTMLButtonElement>('pair-submit').disabled = true;
    void pairPhone({ code: byId<HTMLInputElement>('pair-code').value.trim() }).catch(err => { byId('pair-error').textContent = err.message; }).finally(() => { byId<HTMLButtonElement>('pair-submit').disabled = false; });
  };
  void checkPairing();
  byId('start').onclick = () => { if (sending) void stopCapture(); else void startCapture(); };
  byId('resume').onclick = () => { void captureContext?.resume(); };
  byId('mute').onclick = () => { settings.muted = !settings.muted; void applyPhoneSettings(); send({ type: 'settings', ...settings }); };
  byId<HTMLInputElement>('gain').oninput = event => { settings.gain = Number((event.target as HTMLInputElement).value); void applyPhoneSettings(); send({ type: 'settings', ...settings }); };
  byId<HTMLInputElement>('noise').onchange = event => { settings.noiseSuppression = (event.target as HTMLInputElement).checked; void applyPhoneSettings(); send({ type: 'settings', ...settings }); };
  window.addEventListener('pagehide', () => void stopCapture());
} else {
  root.innerHTML = `<div class="shell"><header class="top"><div class="brand"><img class="brand-icon" src="/icon.svg" alt="">Micbridge</div><span class="badge" id="platform">Desktop receiver</span></header><div class="hero"><div><p class="eyebrow">A microphone, without the cable</p><h1>Bring your phone into the mix.</h1><p class="muted">Pair a browser, stream your voice, and route the audio wherever you need it.</p></div><span class="live" id="status">Starting receiver</span></div><div class="grid"><div class="stack"><section class="card"><div class="card-head"><h2>Live input</h2><span class="badge">LOCAL NETWORK</span></div><h3 id="device-name">No microphone connected</h3><p class="muted" id="stream-format">Audio stays on your local network</p><div class="level"><div class="level-head"><span>INPUT LEVEL</span><span>PCM · 20 ms frames</span></div><progress id="meter" max="1" value="0"></progress></div><div class="stats"><div><b id="frames">0</b><small>FRAMES RECEIVED</small></div><div><b id="bytes">0 MB</b><small>AUDIO TRANSFERRED</small></div><div><b id="loss">0</b><small>FRAMES SKIPPED</small></div></div><div class="actions"><button id="mute">Mute phone</button><button id="disconnect" class="danger">Disconnect phone</button><button id="record">Record WAV</button></div><p class="foot" id="recording-file">Recordings are saved locally.</p></section><section class="card"><div class="card-head"><h2>Audio controls</h2><span class="muted" id="gain-value">100%</span></div><div class="field"><label for="gain">Input gain<small>Applied on the phone before sending</small></label><input id="gain" type="range" min="0" max="6" step=".01" value="1"></div><div class="field"><label for="noise">Browser noise reduction<small>Uses the phone browser’s built-in processing</small></label><input type="checkbox" id="noise" checked></div><div id="windows-routing" hidden><hr><h3>Micbridge Microphone</h3><p class="muted spacer">Send your phone audio to Micbridge’s own Windows virtual microphone. Select Micbridge Microphone in your meeting or recording app.</p><button id="windows-virtual" class="primary spacer">Enable Micbridge microphone</button><p id="windows-virtual-status" class="foot">Requires a signed Micbridge driver installation. Development builds are not yet ready for normal installation.</p></div><div id="linux-routing"><hr><h3>Linux virtual microphone</h3><p class="muted spacer">Create a temporary PulseAudio-compatible microphone. Windows and macOS use Desktop output below.</p><button id="virtual" class="primary spacer">Enable virtual microphone</button><p id="virtual-status" class="foot">Stopped</p></div><hr><h3>Desktop output</h3><p class="muted spacer">Choose speakers for monitoring, or a virtual audio device to use the stream in other apps.</p><div class="actions"><button id="devices">Find audio devices</button><button id="output" class="primary">Enable audio output</button></div><select id="device" class="full spacer"><option value="">System default output</option></select><div class="level-head spacer"><span>Playback queue: <b id="queue">0 ms</b></span><span>Underruns: <b id="underruns">0</b></span></div><details><summary>Use this as a virtual microphone</summary><div class="routing"><ol><li>Windows: install a virtual audio cable and choose its playback endpoint here.</li><li>macOS: choose a virtual audio device such as BlackHole as output.</li><li>Linux: create a PulseAudio/PipeWire virtual sink and expose its monitor as a microphone.</li><li>In your meeting or recording app, select the corresponding virtual microphone.</li></ol><p>Windows and macOS use an independently installed virtual audio device; Linux requires pactl and pacat. No other phone microphone application is required. Use headphones when monitoring to avoid feedback.</p></div></details><p id="error" class="error"></p></section></div><aside class="stack"><section class="card"><p class="eyebrow">01 / Pair your phone</p><h2 class="spacer" id="pairing-title">Your everyday phone link.</h2><p class="muted spacer" id="pairing-caption">Bookmark once, connect anytime.</p><div class="pairing-code-box"><p class="eyebrow">One-time pairing code</p><b id="pairing-code" class="pairing-code">······</b><p class="foot" id="code-expiry"></p><button id="new-code" class="full spacer">Generate new code</button></div><div class="qr-wrap"><img id="qr" alt="Phone pairing QR code"></div><label for="network" class="muted">Desktop network address</label><select id="network" class="full spacer"></select><ol class="steps"><li>Connect phone and desktop to the same network.</li><li>Scan this code with your phone camera.</li><li>Enter the desktop code once, then tap Start microphone.</li></ol><div class="notice">One-time setup: install and trust the local certificate on your iPhone. Then save your microphone link.</div><details><summary>Certificate setup</summary><p>On your iPhone, open the setup link above and install the certificate profile. Then enable full trust in Settings → General → About → Certificate Trust Settings. This desktop keeps its certificate authority across restarts and address changes.</p><p><a href="/certificate.crt" download="micbridge.crt">Download local certificate</a></p><p>SHA-256 fingerprint:</p><p id="fingerprint" class="url"></p><p>Your phone port stays at 8443. To keep bookmarks working when the router assigns addresses, reserve this desktop’s current IP address in your router. Safari’s Share → Add to Home Screen gives you a Micbridge icon.</p></details><div class="bookmark-link"><a id="phone-link" class="url" href="#"></a><button id="copy-link" class="full spacer">Copy phone link</button></div><button id="setup-toggle" class="full spacer">First-time iPhone setup</button><p class="foot">One-time setup link</p><a id="setup-link" class="url" href="#"></a><details><summary>Other network addresses</summary><div id="urls"></div></details><button id="rotate" class="full spacer">Forget paired phones</button></section><section class="card"><p class="eyebrow">Built for your devices</p><p class="muted spacer">Windows, Linux, and macOS desktop. Android and iPhone browser capture.</p><p class="foot">Cross-platform preview. Virtual device setup and phone background capture remain platform-dependent.</p></section></aside></div></div>`;
  byId('gain').oninput = event => send({ type: 'settings', gain: Number((event.target as HTMLInputElement).value) });
  byId<HTMLInputElement>('noise').onchange = event => send({ type: 'settings', noiseSuppression: (event.target as HTMLInputElement).checked });
  byId('mute').onclick = () => send({ type: 'settings', muted: !currentState?.muted });
  byId('disconnect').onclick = () => send({ type: 'disconnect' });
  byId('record').onclick = () => send({ type: 'record', enabled: !currentState?.recording });
  byId('new-code').onclick = () => send({ type: 'newCode' });
  byId('rotate').onclick = () => send({ type: 'rotate' });
  byId('virtual').onclick = () => send({ type: 'virtualMic', enabled: currentState?.virtualMic !== 'Active' });
  byId('windows-virtual').onclick = () => { const button = byId<HTMLButtonElement>('windows-virtual'); button.disabled = true; void enableWindowsMicrophone().catch(showError).finally(() => { button.disabled = false; }); };
  byId('output').onclick = () => { void enableOutput().catch(showError); };
  byId('devices').onclick = () => void listDevices();
  byId<HTMLSelectElement>('device').onchange = () => {
    if (!playbackContext) { showError('Enable audio output before selecting a device.'); return; }
    const ctx = playbackContext as AudioContext & { setSinkId?: (device: string) => Promise<void> };
    if (!ctx.setSinkId) { showError('Audio output selection is not supported by this browser. Use the desktop app.'); return; }
    void ctx.setSinkId(byId<HTMLSelectElement>('device').value).then(() => {
      windowsVirtualEnabled = false;
      if (receiverPlatform === 'win32') {
        byId('windows-virtual').textContent = 'Enable Micbridge microphone';
        byId('windows-virtual-status').textContent = 'Using Desktop output';
      }
    }).catch(showError);
  };
  void loadConfig().then(() => connect('desktop')).catch(showError);
}
