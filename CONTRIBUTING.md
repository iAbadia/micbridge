# Contributing to Micbridge

Bug reports, documentation improvements, platform testing, and focused code changes are welcome.

## Before opening a change

Discuss substantial features in an issue first. Include your platform, app version, and the audio route you are testing. Do not upload private keys, certificates, pairing cookies/codes, administrator URLs, or real recordings without the recorded person's permission.

Use Node.js 24 LTS. Run `npm ci` and `npm test`. Windows native-adapter builds additionally require the .NET 10 SDK; see [the setup guide](docs/SETUP.md).

Keep a pull request focused. Explain the user-visible change and how you checked it. Tests should cover meaningful behavior rather than reproduce the implementation. State explicitly when a platform or hardware route was not tested.

## Rights and credit

By submitting a contribution for inclusion, you offer that contribution under this project's [MIT License](LICENSE). You retain copyright in your contribution. Submit only work you have permission to contribute under MIT. Do not submit proprietary binaries, recovered/decompiled third-party source, vendor model files, or third-party branding.

The project's author is Iñaki Abadia. Contributions may be credited in release notes; preserve existing copyright and license notices.

## Security reports

Use the repository's private vulnerability reporting feature, once enabled, rather than posting exploits or credentials in a public issue. The maintainer must enable that reporting channel before the public launch.
