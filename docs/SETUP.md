# Micbridge setup guide

Micbridge is a cross-platform desktop receiver with a browser microphone companion. The Windows virtual microphone route has been tested with iPhone/Safari; other platform routes still need hardware validation.

## Run

Node.js 22+ and npm are required.

```sh
npm ci
npm start
```

For a browser desktop dashboard without Electron:

```sh
npm run serve
```

Open the printed **Desktop** URL. It includes the local administrator token; keep the full URL. The desktop dashboard shows the phone pairing QR and network addresses. Select the address reachable on your phone's Wi-Fi network. Only one phone can stream at a time. Both devices must be able to communicate on the TCP port shown in the pairing URL (fixed at 8443 by default; Micbridge reports a conflict instead of silently changing it). Network isolation/firewall restrictions may need adjustment.

## Phone connection and HTTPS

1. On the desktop, choose **First-time iPhone setup** and scan that setup QR. The HTTP setup page uses port 8442 and carries only public certificate material, never audio or pairing credentials. Compare its fingerprint with the desktop, download the iPhone profile, then install it in Settings → General → VPN & Device Management. Enable full trust in Settings → General → About → Certificate Trust Settings. Android trust and browser handling vary.
2. Return to the clean microphone link `https://...:8443/phone` and use Safari Share → Add to Home Screen. Open the home-screen app and enter the six-digit code displayed on the desktop once. Pairing is stored in a persistent Secure, HttpOnly cookie; credentials are absent from the URL and manifest. On Safari 17.2+, existing cookies are copied at installation, but pairing directly inside an existing home-screen app also works. **Forget paired phones** revokes stored pairings. If website data is cleared, pair again.
3. Tap **Start microphone** and allow microphone access. Keep the browser foreground; a wake lock is requested when supported, but browsers may suspend audio when locked/backgrounded.
4. Enable desktop audio output for monitoring, or enable an available virtual microphone adapter. Use headphones to avoid acoustic feedback.

There is no need to deploy the mobile client: the desktop serves it over your local network. The local certificate authority persists in the app data directory. Server certificates renew under that same authority when IP addresses change; trust remains valid until the authority expires or app data is removed. Earlier preview CA certificates are reused where valid. Never distribute any private `*-key.pem` or `key.pem` files. A fixed port does not fix a DHCP address: reserve the desktop’s IP in your router to keep the bookmarked address stable.

For a trusted certificate, the CLI accepts `MICBRIDGE_TLS_KEY` and `MICBRIDGE_TLS_CERT` (absolute file paths). The certificate must cover the IP/hostname used by the phone. `MICBRIDGE_DATA` sets the data directory, `MICBRIDGE_PORT` sets the fixed HTTPS port, and `MICBRIDGE_SETUP_PORT` sets the setup port (default 8442). These also work in Electron. Electron defaults to its own app data directory; the CLI defaults to `.micbridge`.

## Audio routing

- **Windows**: enable Desktop output for headphone monitoring. To use received audio in a meeting/recording app, install an independent virtual audio cable, choose its playback endpoint in Micbridge, then select its recording endpoint as the microphone in the consuming app. The Windows installer offers optional signed VB-CABLE setup and automatic routing.
- **Linux**: the adapter uses `pactl` and `pacat` with PulseAudio or PipeWire's PulseAudio compatibility service. It creates a null sink and remapped microphone on explicit enable and unloads its modules when disabled or the app exits. Select **Micbridge Microphone** in the consuming app. These tools must already be installed. Linux routing is implemented but not tested on this Windows host.
- **macOS**: select an installed virtual audio device as Desktop output, then its input endpoint in the consuming app. A built-in CoreAudio virtual driver is not implemented. macOS runtime/packaging needs validation on a Mac.

Desktop monitoring runs separately from the native virtual adapter; enable only the outputs you need. Browser noise suppression uses the phone browser rather than a bundled neural model. PCM16 mono over WebSocket prioritizes simple browser support over codec/network parity. It uses about 96 KB/s audio payload, plus framing, before transport overhead. TCP can add latency under loss; WebRTC Opus is the next media transport candidate.

## Builds and checks

```sh
npm test
npm run package    # unpacked app on the current OS
npm run dist:win
npm run dist:linux
npm run dist:mac
```

Generate runtime notices with `node scripts/release-notices.mjs` before packaging. No native Windows helper or .NET SDK is required. Build each OS on its own host. Packages are unsigned previews. GitHub builds have passed for Windows, Linux, and both macOS architectures; hardware audio routing still needs platform validation.

Tests cover malformed frames, signed sample preservation, sequence wrap, TLS WebSocket pairing, admission rejection, synchronized controls, WAV finalization and capture/playback worklets. Microphone permission and real-phone streaming still need human device validation. No real microphone was captured during automated testing.

## Limitations

Safari screen-lock streaming is not reliable. Linux/macOS routing remains unverified. Windows routing to other apps requires an independently installed virtual audio cable; an integrated virtual driver is not yet implemented.

User audio stays on the local network. There is no vendor telemetry or third-party media upload. WAV recordings are saved locally only when Record WAV is enabled. Pairing credentials persist locally and can be revoked using Forget paired phones. Six-digit pairing codes are single-use, expire after ten minutes, and have a global limit of ten pairing attempts per minute. The HTTPS-only pairing endpoint requires a same-origin JSON POST. Legacy full pairing links migrate to the persistent cookie and then clear their fragment. The desktop administrator token remains temporary and separate. Receiver and recording queues are bounded where implemented; transport/head-of-line behavior remains a measured-performance gap.

Manual input gain ranges from 0% to 600% and is applied on the phone before transmission. Automatic gain is disabled. Use the lowest boost that makes speech comfortably audible; lower it if loud speech distorts. Gain settings persist between sessions.

The desktop uses an integrated, draggable title bar with OS window controls. Closing hides Micbridge in the tray; choose Quit from the tray to shut it down. The microphone icon is used by the app, tray, web pages, and phone home screen.

Version 0.3.0 removes credential-bearing manifest URLs. Existing home-screen shortcuts ending in `/phone` can be kept: open them after updating the desktop and pair once inside the standalone app. IP/hostname changes still create a different cookie origin and need a new pairing.
