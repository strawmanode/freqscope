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
