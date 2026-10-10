# Micbridge Windows virtual microphone

This experimental implementation is retained for research only. Shipped Windows
packages now use [VB-CABLE](../vb-cable/README.md); this unsigned driver is excluded.

Development implementation; not yet a production-signed, hardware-validated driver.
Windows 11 x64 is the initial target. The pinned Microsoft Simple Audio Sample
provides PortCls/WaveRT endpoints. Micbridge replaces the generated test tone with
a bounded, spin-lock-protected render-to-capture PCM buffer. Nothing from other microphone software
is used. No extra audio service, network listener, file recording, or custom IOCTL
is introduced in the driver.

The app sends audio to **Micbridge Input** through Windows audio. Other apps select
**Micbridge Microphone**. Both driver endpoints use 48 kHz stereo PCM16; Windows'
shared audio engine handles client format conversion. The ring holds at most
100 ms, drops oldest frames on overflow, emits silence on underrun, and discards
queued audio on producer pause/stop and consumer restart. Only one hardware
instance (`ROOT\MICBRIDGE\0000`) is supported.

## Build

Run `node scripts/prepare-windows-driver.mjs`, then restore the generated root
`packages.config` with NuGet and build `SimpleAudioSample.sln` for Release/x64.
The dedicated GitHub Actions workflow does this using VS 2026 and the pinned SDK/WDK
NuGet packages. Its artifact is explicitly **unsigned development software**.
The Microsoft framework keeps its MS-PL license and copyright; Micbridge's new
buffer, transformations, and setup tool are MIT. The generated binary retains the
upstream `SimpleAudioSample.sys` filename but has Micbridge device identities.

## Development validation

Use a disposable Windows 11 x64 VM with a snapshot and a driver-development
signing configuration. Follow Microsoft's test-signing procedure yourself; the
scripts never disable Secure Boot or signature enforcement. Test-sign the SYS and
catalog, install with an elevated `MicbridgeDriverSetup.exe install <INF path>`,
and check both endpoints in Windows Sound settings. The setup tool creates only
our hardware ID, updates an existing device, and removes a newly created devnode
if installation fails. Remove using elevated `MicbridgeDriverSetup.exe remove`.

Run Driver Verifier and test a known tone plus silence; then phone speech, mute,
disconnect/reconnect, consumer restart, shared-mode multiple consumers, sleep/wake,
and device removal while streaming. Record the microphone endpoint in an independent
application and inspect the recording for tone correctness, continuity, and bounded
latency. CI buffer tests and compilation do not substitute for these tests.

## Production installer

Obtain Microsoft production signing before distribution to normal Windows PCs.
`scripts/stage-windows-driver.ps1` accepts the returned signed package and checks
the catalog with the WDK's kernel-policy signature verifier before staging it in
`native/windows-driver/package`. That directory is ignored by Git. Windows packages
include it only when it exists; the setup wizard installs the driver with a separate
administrator elevation and fails clearly if installation fails. A portable app
cannot install a driver automatically; use the setup wizard once.

The unsigned development artifact is never automatically bundled or published as
a working production driver. v0.3.1 remains available with external-cable routing
until signing and real Windows audio validation are complete.

Driver installation is system-wide even if the desktop app is installed for one
user. App uninstall leaves the driver installed so other users' installations keep
working. To remove it explicitly, run the setup tool's `remove` command as an
administrator. This removes only the Micbridge devnode; the signed package may
remain in Windows' Driver Store.

## Signing handoff

1. Register an organization for Microsoft's Windows Hardware Developer Program.
   Microsoft currently requires an EV code-signing certificate for registration,
   an Entra administrator, organization verification, and a legal contact.
2. Complete disposable-machine audio and Driver Verifier testing before requesting
   a production signature. Prepare the hardware submission using the program's
   current requirements; passing this CI is not Windows certification.
3. Submit the reviewed package through Partner Center and obtain the signed files.
4. Stage those files with the verification script and build/test the setup wizard
   on a clean Windows machine with normal security settings before publishing.

No account enrollment, purchases, agreement acceptance, or security configuration
changes are performed by the repository's tooling. Keep certificate private keys
and signing credentials outside the repository.

References: [Microsoft registration requirements](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/hardware-program-register),
[driver signing](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/windows-driver-signing-tutorial),
[Microsoft audio driver framework](https://github.com/microsoft/Windows-driver-samples/tree/2dc3fd3a0cc84a2933f2194e7ec0871584979071/audio/simpleaudiosample).
