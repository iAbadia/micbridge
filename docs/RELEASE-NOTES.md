# Micbridge preview

Phone microphone streaming to a desktop over your local network. Open the phone web app served by the desktop; no separate phone installation is required.

Downloads include Windows x64 setup and portable EXEs, Linux x64 AppImage and Debian package, and separate macOS Apple Silicon (arm64) and Intel (x64) DMGs. Each platform has a license notices archive. SHA256SUMS.txt covers every download.

On Windows, use the **setup** EXE for a guided installation with license, installation scope, destination folder, shortcuts, and an uninstaller. The **portable** EXE runs without installing. On macOS, open the DMG and drag Micbridge into Applications. On Linux, install the Debian package using the package manager, or make the AppImage executable and run it.

These builds are unsigned; macOS builds are also unnotarized. Operating systems may block them or display warnings. Linux/macOS packaging success does not establish hardware audio routing compatibility. Windows requires an externally installed virtual audio device to expose received audio as a microphone in other apps. No proprietary kernel driver is supplied.

On iPhone/Safari, keep the web app visible and the screen awake: locking or backgrounding can interrupt streaming. Follow the desktop's local certificate installation and pairing instructions.

MIT license, copyright 2026 Iñaki Abadia. Dependencies retain their own licenses. Review platform testing and these notes before publishing this draft.
