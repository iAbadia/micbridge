# Micbridge 0.3.1 — independent desktop preview

Micbridge no longer uses a other microphone software device, application, or driver. The legacy native adapter and its bundled .NET helper have been removed from source, runtime, installers, and CI.

## Downloads

- Windows x64 setup wizard and portable EXE.
- Linux x64 AppImage and Debian package.
- macOS Apple Silicon (arm64) and Intel (x64) DMGs.
- Per-platform license notices and combined SHA256SUMS.txt.

The Windows setup wizard supports current-user or all-users installation, a custom destination, desktop/Start menu shortcuts, and uninstall. CI checks silent current-user installation and uninstall. Interactive wizard navigation and all-users elevation still need manual validation.

## Changes

- Independent Windows audio routing through Desktop output and an externally installed virtual audio cable. No other phone microphone application is required.
- Linux keeps its PulseAudio/PipeWire-compatible virtual microphone route. macOS routes through an independently installed virtual audio device.
- New animated GitHub Pages homepage with setup guidance, downloads, and honest platform limitations.
- No .NET SDK or bundled native helper is needed to build Micbridge.

## Preview limitations

The packages are unsigned; macOS packages are unnotarized. Hardware audio routing on Linux/macOS, Android capture, and fresh-machine conferencing compatibility still need validation. A Micbridge-owned Windows virtual microphone driver is not implemented: monitoring and recording work without a virtual device, but other applications need an independent virtual audio cable.

Safari can interrupt recording when the phone locks or the browser moves into the background. Keep the phone page visible and the screen awake. Follow the desktop's local HTTPS certificate setup and pair once using its six-digit code.

MIT license, copyright 2026 Iñaki Abadia. Audio stays on the local network; recordings are saved locally when requested.
