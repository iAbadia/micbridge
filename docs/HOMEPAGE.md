# Project homepage

The static homepage lives in `site/` and is deployed to https://iabadia.github.io/micbridge/ by `.github/workflows/pages.yml`. Changes to the site on `main` publish automatically. GitHub Pages is configured to use Actions.

Preview locally with `python -m http.server 8765 --bind 127.0.0.1 --directory site` and open http://127.0.0.1:8765/.

## Design

The page uses the existing Micbridge identity: slate `#10181d`, panel `#18232a`, off-white `#eef2eb`, muted `#acb9be`, pale green `#c6f291`, and a restrained warm accent `#efb778`. Self-hosted Manrope supplies the typography; its SIL Open Font License is in `site/assets/OFL-Manrope.txt`.

The split hero introduces the product on the left and illustrates the phone-to-desktop connection on the right. The waveform and signal pulses are original SVG/CSS, not a recording or live session. Animation has a pause control and respects reduced motion. The remaining layout is quiet, with controls, real setup steps, download choices, and an FAQ. No testimonials or adoption statistics are supplied.

## Downloads

The page queries the public GitHub releases API for published independent versions, starting at v0.3.1. It maps assets to the Windows installer/portable app, Linux AppImage/deb, and Mac arm64/x64 DMGs. Missing assets point to source instructions. If the API is unavailable, the static links go to v0.3.1 release notes rather than the historical v0.3.0 build.

The public project homepage does not serve microphone capture or request microphone permission. The desktop serves the phone client on its own local HTTPS address.
