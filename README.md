# FreqScope

**Live radar. Real frequencies. External ATC audio handoff.**

Local web app: search a US airport, watch live aircraft on a scope-style map, and open a credited **Listen** handoff to [LiveATC.net](https://www.liveatc.net/) for personal listening.

FreqScope is source-available for non-commercial use under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use, including
selling, hosting, or bundling FreqScope as part of a paid product or service,
is not permitted without a separate license from the copyright holder.

FreqScope does not grant rights to third-party services, audio streams, data,
photos, trademarks, or content. Users are responsible for complying with
[LiveATC.net's Terms of Use](https://www.liveatc.net/legal/) and the terms of
any other provider they access through or alongside this project. See
[NOTICE.md](NOTICE.md).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run build:data   # generates src/data/*.json (see scripts/README.md)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Optional: 3D aircraft models

By default, aircraft appear as 2D scope symbols. For 3D models on supported ICAO
types, download third-party GLB assets separately (GPLv2 — not part of the
FreqScope license):

```bash
npm run setup:models
```

See [`public/models/aircraft/README.md`](public/models/aircraft/README.md) for
upstream sources, the separate C172 setup, and license notes.

FreqScope is designed to run locally through the Vite dev server. Local API
routes for aircraft, METAR, SIGMET/G-AIRMET, and TFR data are served by
`dev/aircraftApiPlugin.ts`.

## Local configuration

On first run, FreqScope prompts for your **name and email** for the live
aircraft feed. You can also create `.env.local` from `.env.example` manually.
Do not leave the example values in place, and do not use `FreqScope` as your
name. Upstream ADS-B providers require callers to identify themselves, so each
person running this project must provide their own name and email:

```bash
AIRCRAFT_FEED_APPLICATION=YourName
AIRCRAFT_FEED_CONTACT=your-email@example.com
```

The local server uses these values to build upstream aircraft-feed headers:

- `User-Agent`: defaults to `${AIRCRAFT_FEED_APPLICATION}/0.1 (${AIRCRAFT_FEED_CONTACT})`
- `X-Application`: defaults to `AIRCRAFT_FEED_APPLICATION`
- `X-Contact`: defaults to `AIRCRAFT_FEED_CONTACT`

The live aircraft feed will refuse to start if these values are missing or left
as placeholders.

Optional overrides:

```bash
AIRCRAFT_FEED_USER_AGENT="YourName/0.1 (your-email@example.com)"
AIRCRAFT_FEED_X_APPLICATION=YourName
AIRCRAFT_FEED_X_CONTACT=your-email@example.com
AIRCRAFT_FEED_EXTRA_HEADERS_JSON='{"X-Example":"value"}'
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Airport search |
| `/scope` | Radar + frequency panel + LiveATC handoff (requires airport from search) |

## LiveATC handoff

- **Listen** opens a LiveATC search page for the airport in a new browser tab.
- FreqScope does not embed, proxy, fetch, record, link directly to, or
  redistribute LiveATC audio streams.
- FreqScope is not affiliated with, endorsed by, or sponsored by LiveATC.net.
- LiveATC use remains subject to
  [LiveATC.net's Terms of Use](https://www.liveatc.net/legal/). Users are
  responsible for ensuring their own use is permitted.

## Radar (ADS-B)

Aircraft positions poll through FreqScope's local API every **5 seconds** in a box around the selected airport.

1. **Primary:** [airplanes.live](https://api.airplanes.live) - enriched metadata (type, registration, military flag, emergency status)
2. **Fallback:** [adsb.lol](https://api.adsb.lol) - used when airplanes.live fails

Feed priority, fallback, and request headers are handled server-side in
`lib/aircraftFeed.ts`; the client poll interval is configured in
`shared/aircraftFeedConfig.ts`.

## Data

Airport and frequency JSON are built from **FAA NASR** when `APT_BASE.csv` and `FRQ.csv` are in `scripts/nasr/`. Otherwise the build script uses OurAirports CSV fallback (see [`scripts/README.md`](scripts/README.md)).

## Stack

Vite · React · TypeScript · React Router · Tailwind CSS · CesiumJS · static JSON · airplanes.live (+ adsb.lol fallback)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:data` | Regenerate `src/data/airports.json` and `frequencies.json` |
| `npm run setup:models` | Download optional GPLv2 aircraft GLBs (see `public/models/aircraft/README.md`) |
| `npm run lint` | ESLint |

## License

This project is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE). The code is available for
personal, educational, public research, public safety, government, charitable,
and other non-commercial uses. It is not licensed for commercial use.

The license covers only rights the copyright holder can grant in FreqScope
itself. It does not grant rights to any third-party service, feed, audio stream,
dataset, photo, trademark, or content. FreqScope is provided "as is" and is not
for aviation, operational, law enforcement, judicial, safety-critical, or other
reliance-based use. Third-party services, data, models, fonts, map tiles, and
dependencies remain subject to their own terms and licenses; see
[NOTICE.md](NOTICE.md).
