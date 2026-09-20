# FreqScope setup

FreqScope is no longer maintained. These instructions are retained for running
and building the source independently. Official installers and ongoing support
are no longer provided. See the [README](README.md) for the project overview.

FreqScope is designed to run locally through the Vite dev server. The local API
routes for aircraft, METAR, SIGMET/G-AIRMET, and TFR data are served by
`server/aircraftApiPlugin.ts`.

## Prerequisites

- A recent **Node.js LTS** (Node 20 or newer) and npm.
- Network access for the aircraft, weather, and FAA data feeds.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your own name and email
npm run dev
```

Airport, frequency, and runway JSON ship prebuilt in `src/data/`. Run
`npm run build:data` only when you want to regenerate them (requires FAA NASR
or OurAirports CSVs — see [`scripts/README.md`](scripts/README.md)).

Open [http://localhost:5173](http://localhost:5173).

## Desktop app

FreqScope can also be packaged as a double-click desktop app (Electron) so
non-technical users can run it without Node or a terminal. The app bundles a
small production server, serves the built client, and opens it in its own
window. Your name/email is stored per-user in the OS app-data directory instead
of a project `.env.local`.

### Run the desktop app from source

```bash
npm install
npm run electron:dev     # builds the main process, starts Vite, opens a window
```

### Build installers

```bash
npm run electron:build   # full installer(s) for the current OS into release/
npm run electron:pack    # faster unpacked build (no installer) for testing
```

`electron-builder` produces a `.dmg`/`.zip` on macOS, an NSIS `.exe` on Windows,
and an `.AppImage` on Linux. Build for the appropriate platform locally.

The historical `.github/workflows/release.yml` workflow is disabled in this
repository through GitHub settings. Its historical definition is retained as a
reference for independent maintainers. Anyone distributing their own builds must configure
their own publishing destination and signing credentials.

### Retired application updates

Existing packaged builds contain an application-update check against GitHub
Releases. No further application releases are planned, and the installer release
has been removed. Failed update checks are logged without preventing startup.

The historical update-feed configuration remains in `electron-builder.yml`.
Independent distributors must configure their own update feed before publishing.
The separate frozen reference-data snapshot is described below.

### Headless server (optional)

To serve the production build in a browser without an Electron window (handy for
self-hosting or testing):

```bash
npm run build && npm run build:electron
npm run serve            # serves the built app at http://127.0.0.1:4173
```

`HOST`, `PORT`, and `FREQSCOPE_CONFIG_DIR` env vars override the defaults.

### Icons

A placeholder radar-scope icon ships at `build/icon.png` (1024×1024).
electron-builder auto-generates the macOS `.icns`, Windows `.ico`, and Linux
icon set from that single file, so to rebrand just replace `build/icon.png`.

### Build architectures

The builds target the architectures real users have: a **universal** macOS
binary (Apple Silicon + Intel), **Windows x64** (NSIS), and **Linux x64**
(AppImage). Adjust the `arch` entries in `electron-builder.yml` to add others
(e.g. Windows arm64).

### Unsigned local builds

Locally built installers may be unsigned. macOS Gatekeeper or Windows
SmartScreen may display warnings because the publisher cannot be verified.
Source availability does not establish that a build is safe. Anyone distributing
builds is responsible for evaluating them and arranging appropriate signing.

### Code signing

- **macOS** — an Apple Developer ID certificate plus notarization. Provide
  `CSC_LINK`, `CSC_KEY_PASSWORD`, and the Apple notarization credentials to
  electron-builder (see its docs); the CI workflow leaves slots for these.
- **Windows** — an Authenticode certificate via `CSC_LINK` / `CSC_KEY_PASSWORD`.

Signing requires your own certificates and cannot be done for you.

## Feed configuration

On first run, FreqScope prompts for your **name and email** for the live
aircraft feed. You can also create `.env.local` from `.env.example` manually.
Do not leave the example values in place, and do not use `FreqScope` as your
name. Upstream ADS-B providers require callers to identify themselves, so each
person running this project must provide their own name and email:

```bash
AIRCRAFT_FEED_APPLICATION=YourName
AIRCRAFT_FEED_CONTACT=your-email@example.com
```

The local server uses these values to build the upstream aircraft-feed headers:

- `User-Agent`: defaults to `${AIRCRAFT_FEED_APPLICATION}/0.1 (${AIRCRAFT_FEED_CONTACT})`
- `X-Application`: defaults to `AIRCRAFT_FEED_APPLICATION`
- `X-Contact`: defaults to `AIRCRAFT_FEED_CONTACT`

The live aircraft feed will refuse to start if these values are missing or left
as placeholders. Never commit `.env.local`.

### Optional overrides

```bash
AIRCRAFT_FEED_USER_AGENT="YourName/0.1 (your-email@example.com)"
AIRCRAFT_FEED_X_APPLICATION=YourName
AIRCRAFT_FEED_X_CONTACT=your-email@example.com
AIRCRAFT_FEED_EXTRA_HEADERS_JSON='{"X-Example":"value"}'
```

## Optional: 3D aircraft models

By default, aircraft appear as 2D scope symbols. For 3D models on supported ICAO
types, download third-party GLB assets separately (GPLv2 — **not** part of the
FreqScope license):

```bash
npm run setup:models
```

See [`public/models/aircraft/README.md`](public/models/aircraft/README.md) for
upstream sources, the separate C172 setup, and license notes. Do not commit
`.glb` files.

## Radar data (ADS-B)

Aircraft positions poll through FreqScope's local API every **5 seconds** in a
box around the selected airport.

1. **Primary:** [airplanes.live](https://api.airplanes.live) — enriched metadata
   (type, registration, military flag, emergency status).
2. **Fallback:** [adsb.lol](https://api.adsb.lol) — used when airplanes.live
   fails.

Feed priority, fallback, and request headers are handled server-side in
`server/aircraftFeed.ts`; the client poll interval is configured in
`shared/aircraftFeedConfig.ts`.

## Airport & frequency data

Airport and frequency JSON are built from **FAA NASR** when `APT_BASE.csv` and
`FRQ.csv` are placed in `scripts/nasr/`. Otherwise the build script uses the
OurAirports CSV fallback. See [`scripts/README.md`](scripts/README.md) for
details.

## Reference data freshness

- **Live data** — aircraft positions, TFRs, SIGMET/G-AIRMET, and METAR — is
  requested from upstream providers at runtime. Availability and freshness
  depend on those providers; this project no longer maintains the integrations.
- **Reference data** — airports, frequencies, runways, and airspace volumes —
  comes from bundled or previously downloaded files and can become outdated.

Build scripts stamp `src/data/data-meta.json` with each dataset's generation
date and source. The search page's reference-data badge reflects the copy in
use. Regenerate your own data using the instructions in [scripts/README.md](scripts/README.md).

### Final reference-data snapshot

The [`data-latest` release](https://github.com/strawmanode/freqscope/releases/tag/data-latest)
is preserved as a frozen snapshot generated on **September 20, 2026 (UTC)**.
No further refreshes are planned. Its tag and filenames remain unchanged so
existing desktop installations can continue downloading it.

On launch, a packaged app checks the manifest and downloads the snapshot if its
version differs from the local copy. It serves downloaded reference data when
available, with bundled files as a fallback if a download is unavailable.
This reference-data check is separate from the retired application-update feed.

The data-publishing workflow is disabled in this repository through GitHub
settings. Its historical definition and the local generation scripts remain
available for independent maintainers. Regenerating data locally does not refresh the published
snapshot unless a maintainer explicitly publishes it.

## Routes

| Path            | Description                                                              |
|-----------------|--------------------------------------------------------------------------|
| `/`             | Airport search                                                           |
| `/scope/:icao`  | Radar + frequency panel + LiveATC handoff (requires an airport from search) |

## LiveATC handoff

- **Listen** opens a LiveATC search page for the airport in a new browser tab.
- FreqScope does not embed, proxy, fetch, record, link directly to, or
  redistribute LiveATC audio streams.
- FreqScope is not affiliated with, endorsed by, or sponsored by LiveATC.net.
- LiveATC use remains subject to
  [LiveATC.net's Terms of Use](https://www.liveatc.net/legal/). Users are
  responsible for ensuring their own use is permitted.

## Scripts

| Command                 | Description                                                            |
|-------------------------|-----------------------------------------------------------------------|
| `npm run dev`           | Development server                                                     |
| `npm run build`         | Production build                                                       |
| `npm run build:data`    | Regenerate `src/data/airports.json` and `frequencies.json`            |
| `npm run build:airspace`| Regenerate airspace data                                              |
| `npm run setup:models`  | Download optional GPLv2 aircraft GLBs (see `public/models/aircraft/README.md`) |
| `npm run lint`          | ESLint                                                                 |

## Troubleshooting

- **Feed won't start / "identify yourself" error** — `.env.local` is missing,
  or still contains placeholder values. Set `AIRCRAFT_FEED_APPLICATION` and
  `AIRCRAFT_FEED_CONTACT` to your real name and email.
- **No aircraft appear** — confirm network access to the ADS-B providers and
  that traffic exists in range; try a busier airport or a larger range ring.
- **Empty airport search** — confirm `src/data/airports.json` exists in your
  checkout. If you deleted generated data, run `npm run build:data` after
  placing FAA NASR or OurAirports CSVs in `scripts/nasr/` (see
  [`scripts/README.md`](scripts/README.md)).
- **3D models not showing** — they are optional and downloaded separately via
  `npm run setup:models`; without them, aircraft render as 2D scope symbols.
