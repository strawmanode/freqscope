# FreqScope setup

Everything you need to run FreqScope locally. For what the project is and why it
exists, see the [README](README.md).

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
and an `.AppImage` on Linux. Each OS must be built on (or cross-built for) that
platform — the easiest way to produce all three is the
`.github/workflows/release.yml` GitHub Actions workflow, which builds on a
macOS/Windows/Linux matrix when you push a `v*` tag and attaches the installers
to a GitHub Release.

### Automatic updates

The desktop app updates itself via [electron-updater](https://www.electron.build/auto-update),
using GitHub Releases as the update feed (configured under `publish:` in
`electron-builder.yml`). On launch, a packaged app checks the latest release,
downloads a newer version in the background, and installs it on the next
restart. Update problems (offline, no release yet) are logged and never block
startup.

For this to work end to end:

1. **Bump `version` in `package.json`** and push a matching `vX.Y.Z` tag. The
   release workflow runs `electron-builder --publish always`, which uploads the
   installers **and** the `latest*.yml` + `.blockmap` metadata electron-updater
   reads. It creates a *draft* release — review and publish it to go live.
2. **Sign the builds.** Auto-update requires a valid signature — it is
   mandatory on macOS and strongly recommended on Windows. Unsigned builds
   install manually but will not auto-update on macOS. See
   [Code signing](#code-signing) below.

To smoke-test the update flow locally, point electron-updater at a feed with a
`dev-app-update.yml` in the project root and run a packaged build; see the
electron-updater docs.

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

### Opening FreqScope on macOS (unsigned build)

Unsigned builds run fine but macOS Gatekeeper may show:

> **Apple can't check app for malicious software**

That happens because the app is not signed with an Apple Developer ID yet — not
because macOS detected anything wrong with FreqScope specifically.

**To open the app the first time:**

1. Try to open **FreqScope** once (from the DMG or Applications). macOS will block it.
2. Open **System Settings** → **Privacy & Security**.
3. Under **Security**, find the message about FreqScope being blocked.
4. Click **Open Anyway** (this button is available for about an hour after you try to open the app).
5. Enter your Mac login password and confirm.

The app is saved as a security exception and opens normally after that.

On older macOS versions, **right-click** the app → **Open** the first time may
also work.

### Windows SmartScreen (unsigned build)

Windows may show **Windows protected your PC** (SmartScreen). Click
**More info** → **Run anyway** for the first launch.

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

Two kinds of data exist in FreqScope:

- **Live data** — aircraft, TFRs, SIGMET/G-AIRMET, and METAR — is fetched at
  runtime and is always current, including in a downloaded desktop build.
- **Reference data** — airports, frequencies, runways, and airspace volumes —
  is generated at build time and baked into the app. The FAA NASR datasets
  follow a 28-day cycle, so a downloaded build slowly goes out of date.

The build scripts stamp `src/data/data-meta.json` with the date and source of
each reference dataset. The search page shows a small "REFERENCE DATA · <date>"
badge that turns amber after one cycle (28 days) and red after two, so users can
tell when a newer release is worth downloading. Regenerate the data with
`npm run build:data` and `npm run build:airspace`; the stamp updates
automatically.

### Automatic reference-data updates

Reference data refreshes without shipping a new app version:

1. **Publisher** — `.github/workflows/data-update.yml` runs on a schedule
   (and on demand), regenerates the data from OurAirports, and publishes the
   JSON plus a `data-manifest.json` to a moving **`data-latest`** GitHub
   release.
2. **App** — on every launch the client fetches `/data/*.json` from the
   embedded server, which serves a downloaded copy when present
   (`server/dataHandler.ts`). The Electron app checks the `data-latest`
   manifest in the background and, if newer, downloads the bundle into the
   user's data folder; it takes effect on the **next** launch (same model as
   app updates — never blocks startup, never serves a half-written file). The
   bundled copy is always the offline fallback, so the app works with no
   network.

The freshness badge reflects whichever copy is in use, so it goes green again
once a newer bundle has been downloaded.

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
