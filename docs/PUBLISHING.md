# GitHub publication checklist

## Decisions before publication

- [x] Choose MIT. Commercial and corporate use are allowed without separate permission.
- [x] Credit Iñaki Abadia in LICENSE, README, and package author metadata.
- [x] Define contribution terms under the project's MIT license; contributors retain copyright in their contributions.
- [x] Confirm repository owner/name as iAbadia/micbridge and the Micbridge product name.
- [x] Add LICENSE and matching package metadata. Third-party components keep their own licenses.

## Repository and privacy

- [x] Initialize a local Git repository on main and inspect the 43 files staged for the first commit.
- [x] Add ignore rules for installed/recovered investigation material, local screenshots, generated builds, certificates, app data, and recordings. Preserve investigation material privately.
- [x] Verify staged source excludes investigation/build/app-data paths and private key/audio artifacts; inspect the public banner. Before adding release screenshots, sanitize them separately.
- [ ] Include third-party notices for dependencies and the bundled Electron/.NET runtimes in release distributions.
- [ ] Enable a private security reporting channel before publishing SECURITY.md contact instructions.
- [x] Add issue templates and MIT contribution instructions.

## Product and release readiness

- [ ] Publish as an early preview, with Windows runtime evidence and Linux/macOS validation limits clearly stated.
- [ ] Test fresh-machine Windows monitoring and an independently installed virtual audio cable. The current native adapter depends on an existing other microphone software V2 driver; its binary is not supplied.
- [ ] Review the adapter's provenance and dependency before distributing it publicly. Exclude third-party proprietary binaries, models, and artwork.
- [ ] Validate iPhone profile installation and persistent pairing inside the home-screen app, including reopen/reboot and revoked cookies.
- [ ] Disclose Safari screen-lock interruption prominently.
- [ ] Validate Linux audio module cleanup and macOS virtual output routing on actual hosts.
- [ ] Run the build matrix on GitHub; local configuration does not prove remote builds succeed.
- [x] Add pull-request CI, read-only workflow permissions, and a bounded build matrix.
- [ ] Add release checksums and a dependency/license report.
- [ ] Decide whether the first Windows release is explicitly unsigned or obtain code signing. Treat macOS signing/notarization separately.
- [ ] Tag the reviewed release and upload built artifacts after the repository and license are approved.

The README's artwork is original project branding and contains no local credentials. Screenshots under analysis are local testing evidence and should remain outside the public repository.
