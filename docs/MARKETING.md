# Micbridge launch and search plan

Prepared October 11, 2026. Budget: zero. Author: Iñaki Abadia.

## Positioning

**Use your iPhone as a Windows microphone. Open source. No phone app.**

The first audience is people who want a phone microphone for their Windows PC,
especially iPhone users who prefer a browser to another app download. People exploring browser-based audio tools are a secondary audience.

Do not market this as better audio quality, lower latency, or an effortless
replacement. We have no comparative benchmarks. Be clear about certificate
setup, Safari needing an awake screen, unsigned desktop packages, and separately
licensed VB-CABLE. Do not present Android, Linux or macOS hardware support as
validated. Explain that capture uses Micbridge’s own browser page.

## Search pages shipped

| Search intent | Page | What the visitor gets |
| --- | --- | --- |
| phone as PC microphone / open-source phone microphone | [Homepage](https://iabadia.github.io/micbridge/) | Product explanation, downloads, requirements |
| iPhone as Windows PC microphone / no phone app | [Setup guide](https://iabadia.github.io/micbridge/iphone-as-pc-microphone.html) | Certificate, pairing, VB-CABLE and troubleshooting |

These are editorial targets, not measured search-volume data. No ranking or
traffic guarantee. Each page has a unique title, description, canonical URL,
social preview and structured data. They link to each other and appear in the
[sitemap](https://iabadia.github.io/micbridge/sitemap.xml).

Google's [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
emphasizes useful content, descriptive titles and crawlable links. Its
[sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
explains sitemap submission. A project-level robots.txt would not control
crawling: robots.txt is read at the origin root, not `/micbridge/robots.txt`.

## First distribution work

1. Record a real 30–60 second demonstration: iPhone Safari → Micbridge → a
   receiving app's input meter and recorded voice. Show actual setup, not just
   the animated homepage. Do not claim compatibility with an app until tested.
2. Add the site to Google Search Console as a URL-prefix property using exactly
   `https://iabadia.github.io/micbridge/`. The owner's Google account is needed.
   Obtain its HTML verification file or meta tag, add it to Pages, verify, and
   submit `sitemap.xml`. Request indexing for the two pages. Ownership and
   indexing are not yet configured or confirmed.
3. Post a maker announcement on an appropriate project-sharing community after
   checking current rules. Hacker News Show HN and Reddit project-sharing
   communities are candidates to review, not guaranteed promotion channels.
4. Where someone has recently asked for an iPhone/PC microphone alternative,
   answer the actual question, disclose authorship and include the limitations.
   Avoid old-thread mass replies, unsolicited direct messages, competitor
   community promotion and copied comments across many threads.
5. Prioritize real installation feedback over directory submissions. Only list
   Micbridge in a directory if it supports our license and platform caveats.

No community posts, messages or submissions have been sent. External outreach
requires the owner's explicit instruction. Current community rules must be
checked before posting.

## Ready-to-edit maker announcement

**Title:** I built an open-source way to use an iPhone as a Windows microphone—no phone app

I'm Iñaki, the maker of Micbridge. I wanted to use my phone as a PC microphone
without installing a mobile app, so I built a desktop receiver with a browser
microphone page.

On Windows, the installer offers VB-CABLE setup. Open the local link in Safari,
pair once, enable the virtual microphone on the desktop, and select its recording
endpoint in the app receiving your audio. It includes gain, mute, headphone
monitoring and local WAV recording. The audio stays on your local network.

The Windows/iPhone path has been tested. There are real tradeoffs: one-time HTTPS
certificate trust, Safari needs to stay visible with the screen awake, and the
desktop installer is unsigned. VB-CABLE has separate donationware and professional
licensing terms. Linux/macOS builds exist, but their hardware audio routes still
need testing.

The Micbridge code is MIT licensed. I'd appreciate feedback on installation and
whether your receiving app gets clean audio.

Project: https://iabadia.github.io/micbridge/
Source and downloads: https://github.com/iAbadia/micbridge

## Reply when an alternative is requested

Disclosure: I make Micbridge. If you're using an iPhone with a Windows PC and
prefer a browser rather than a phone app, it might fit. It sends Safari microphone
audio over your local network into VB-CABLE, so another app can select it as a
microphone. It's open source, but you need a one-time certificate trust step and
the iPhone screen must stay awake. The driver also has separate license terms.
Here's the setup guide: https://iabadia.github.io/micbridge/iphone-as-pc-microphone.html

Adapt this to the actual question. Do not post it unless it addresses the person's
need; locked-screen use, USB audio and Android-only requests may be poor fits.

## Measure before expanding

After Search Console is connected, record indexed pages, query impressions,
clicks and click-through rate weekly. Compare changes over several weeks, not
hours. GitHub release asset downloads indicate downloads, not active users or
successful installations. Ask testers for OS, browser, receiving app and outcome.
Keep a separate count of confirmed successful setups and recurring failures.

Do not add third-party visitor tracking just for launch. Search Console and
aggregate GitHub downloads are enough to start. No analytics script was added.

Next pages should answer actual support questions. Consider an OBS or Discord
guide only after validating that app. Avoid thin pages that repeat the same copy
with different competitor names.

## Source and brand caution

Keep marketing focused on Micbridge’s documented features and tested behavior.
Avoid claims about competing products’ ads, subscriptions, safety or audio
superiority based on third-party anecdotes.

Search surfaced another project using the name MicBridge in a Moonlight/LAN
microphone context. Treat this as a possible search-disambiguation issue, not a
trademark determination. Use **Micbridge by Iñaki Abadia** and the exact GitHub URL
in announcements. A rename or custom domain is an owner decision; neither is
required for this initial zero-budget launch.
