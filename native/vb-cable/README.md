# Windows virtual microphone: VB-CABLE

The Windows x64 setup includes the original base VB-CABLE package from VB-Audio.
It requires no other microphone software installation and no test-signing or Secure Boot changes.
VB-CABLE is separately licensed donationware; see [NOTICE.txt](NOTICE.txt) and
[VB-Audio's terms](https://vb-audio.com/Services/licensing.htm).

## Installation

1. Run Micbridge's setup wizard and select **Set up VB-CABLE virtual microphone**.
2. Approve Windows' administrator prompt and complete the official VB-Audio setup.
3. Restart Windows. Check that your normal speakers remain the default playback device.
4. Pair the phone, start capture, and click **Enable Micbridge microphone**.
5. Select **Micbridge Microphone (VB-Audio Virtual Cable)** in your meeting/recording app.
   An existing cable keeps its name, usually **CABLE Output (VB-Audio Virtual Cable)**.

The app provides **Set up virtual microphone** and **Rename microphone** buttons.
Setup is also available through the Start menu. Renaming is optional and applies
only to the base cable's recording endpoint through Windows’ internal audio policy interface (Windows 10/11).
If a future Windows version rejects that interface, the name can be changed
in Windows Sound settings without modifying the driver. It does not change the driver publisher, INF, catalog, or signed binaries.
The playback endpoint retains its CABLE Input name for automatic routing.

Existing VB-CABLE installations are reused. If the user renamed the playback
endpoint, select it manually under Desktop output. The base cable is shared:
other apps sending audio into it can mix with the phone stream. It is not a
separate, dedicated Micbridge driver instance. Micbridge uninstall leaves it
installed; use the official VB-Audio setup to remove it separately if no longer needed.

Portable builds carry the same setup resources, but changing the system audio
driver still requires administrator approval and a restart.

## Packaging and verification

`scripts/windows-audio-package.cjs` downloads the official Pack45 archive, checks
its pinned SHA-256, extracts it unchanged, and validates its modern x64 Microsoft
driver catalog and the vendor setup executable's Authenticode signature. A
changed upstream archive fails the build until deliberately reviewed and repinned.
The original archive and readme are preserved in installed resources. Windows
packaging must run on Windows x64 so signature verification cannot be skipped.
The download is needed during builds; setup works offline with the bundled files.
Electron Builder excludes vendor executables from its signing pass.

GitHub's disposable Windows runner verified fresh installation, a started signed
PnP device, the recording endpoint name, repeat renaming, existing-driver reuse,
and a real 48 kHz stereo PCM roundtrip. The 1 kHz test tone returned with RMS 0.150,
peak 12001 and 999 cycles. Capture consent is enabled only in the disposable test
VM; the shipping app and installer do not change Windows microphone privacy settings.
Physical Windows 10/11 phone-to-conferencing-app testing is still required before
claiming broad compatibility. The app/setup executable remains unsigned even
though VB-CABLE's driver catalog is Microsoft-signed.

The public licensing page grants conditional permission for embedding the base
package, including silent installation, while the archive's README requests author
agreement. Bundling here relies on the author's published permission, keeps the
original package intact, and exposes attribution, donations, and licensing terms
in both the wizard and app. Professional licensing obligations remain applicable.

The earlier Micbridge-owned driver source is experimental and excluded from
installers. Its unsigned artifacts are not used by this integration.
