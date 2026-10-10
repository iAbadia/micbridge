# Micbridge 0.4.0 — Windows virtual microphone setup

The Windows x64 installer now bundles the Microsoft-signed base VB-CABLE driver
with an optional setup page, VB-Audio attribution, donation links, and licensing
information. No other microphone software installation or Windows test-signing is required.

Complete the official VB-Audio setup when prompted, restart Windows, then click
**Enable Micbridge microphone**. A fresh installation receives the display name
**Micbridge Microphone (VB-Audio Virtual Cable)**. Existing installations retain their names;
select their recording endpoint, usually **CABLE Output**, in the consuming app.
An optional rename button is available in Micbridge. The shared VB-CABLE remains
installed when Micbridge is removed.

Setup preserves available speaker/microphone defaults when the new cable replaces
them. Check your Windows sound settings after restarting. The official setup and
driver package are preserved unchanged with their original publisher signatures.

Validation includes 14 application tests, Windows app installation/uninstall,
fresh signed driver installation, endpoint naming, existing-driver reuse, and a
real 48 kHz stereo tone recorded through the cable on a disposable Windows runner.
Phone-to-conferencing-app validation on physical Windows 10/11 hardware remains
the final manual check; this release is kept as a draft preview for that review.

The desktop app also includes setup/retry buttons and a Start menu setup shortcut.
Automatic routing targets the base CABLE Input, with silence during switching and
no intentional fallback to default speakers when the virtual device is missing.

VB-CABLE retains its own donationware terms. Professional/organizational use may
require a paid VB-Audio license. Micbridge remains MIT, copyright Iñaki Abadia.
The Microsoft-signed driver does not sign the Micbridge app: the app and its setup
remain unsigned and may receive Windows SmartScreen warnings. macOS builds remain
unnotarized. Linux/macOS hardware routing and Android capture remain unverified.

On iPhone/Safari, keep the phone page visible and the screen awake. Pair once and
follow the desktop's HTTPS certificate setup instructions.
