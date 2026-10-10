# Micbridge 0.3.0 — early preview

Historical notes: the device adapter described below was removed in v0.3.1. Use v0.3.1 or later for an independent build.

Turn your phone into a microphone for your desktop over your local network.

## Downloads

- **Micbridge-0.3.0-windows-x64.exe**: portable Windows x64 desktop. Download and run; no separate phone app is required.
- **Micbridge-0.3.0-notices.zip**: MIT license, dependency inventory, and third-party license texts. These are also included inside the portable application's resources.
- **SHA256SUMS.txt**: checksums for the executable and notices archive. On Windows, compare with `Get-FileHash -Algorithm SHA256`.

## Included

- Browser microphone capture and desktop audio monitoring, gain, mute, and WAV recording.
- Fixed HTTPS port 8443 and a clean `/phone` URL suitable for bookmarking or adding to the iPhone home screen.
- One-time pairing codes with persistent secure cookies; paired phones can be revoked from the desktop.
- Local certificate setup with an iPhone installation profile and trust instructions.
- Integrated desktop window controls, tray icon, and original Micbridge branding.

## Getting started

Run the desktop on the same local network as your phone. Follow its certificate setup instructions, open the phone URL, pair using the desktop code, and start the microphone. Use headphones when enabling desktop monitoring to avoid feedback.

## Preview limitations

- This Windows build is **unsigned**. Windows may display a SmartScreen warning.
- Windows monitoring with iPhone/Safari has been tested. Fresh-machine setup and virtual microphone consumption by conferencing apps still need validation.
- Safari may stop microphone streaming when the phone locks or the web app moves into the background. Keep the app visible and the screen awake.
- Windows virtual microphone routing requires a separately installed virtual audio cable or an existing other microphone software V2 device. The included independent user-mode adapter supplies no proprietary kernel driver and does not install one.
- Linux and macOS source support is included, but downloadable binaries and hardware audio routing validation are not part of this release.
- Neural noise reduction and compressed WebRTC/Opus transmission are not implemented. Browser audio processing is used where supported.

Audio stays on your local network. Recordings are saved locally when requested. The application is released under MIT, copyright 2026 Iñaki Abadia; dependencies retain their own licenses.
