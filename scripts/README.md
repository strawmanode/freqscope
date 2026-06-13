# Data build scripts

## `npm run build:data`

Generates [`../src/data/airports.json`](../src/data/airports.json), [`../src/data/frequencies.json`](../src/data/frequencies.json), and [`../src/data/runways.json`](../src/data/runways.json).

### Preferred: FAA NASR (28-day subscription)

1. Download the current CSV bundle from the [FAA 28-Day NASR Subscription](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/).
2. Extract into `scripts/nasr/`:
   - `APT_BASE.csv` (required)
   - `FRQ.csv` (required)
   - `APT_ATT.csv` (optional, improves city/state)
   - `APT_RWY.csv` (optional, runway centerlines and headings)
3. Run:

```bash
npm run build:data
```

The script selects up to **500** US airports (ICAO `K…`), prioritized by facility size.

Prebuilt outputs are checked into `src/data/` so a fresh clone can run without
this step. Use `npm run build:data` when you need to refresh airport,
frequency, or runway JSON from newer source CSVs.

### Fallback: OurAirports CSV

If `APT_BASE.csv` / `FRQ.csv` are not present, the script uses `airports.csv`, `airport-frequencies.csv`, and optionally `runways.csv` from [OurAirports](https://ourairports.com/data/) when placed in `scripts/nasr/`. A warning is printed to the console.

Runway data uses `APT_RWY.csv` when building from NASR, or falls back to OurAirports `runways.csv` in `scripts/nasr/`. If neither file is present, `runways.json` is written as `{}` with a console warning.

`scripts/nasr/*.csv` is gitignored except when you choose to commit generated outputs under `src/data/`.

## `npm run setup:models`

Downloads optional GPLv2 aircraft GLB models into `public/models/aircraft/`.
These files are gitignored and not part of the PolyForm-licensed FreqScope
source. See [`../public/models/aircraft/README.md`](../public/models/aircraft/README.md).

## LiveATC

Generated frequency data intentionally excludes LiveATC stream mount URLs. FreqScope only links users to LiveATC search pages for personal listening under LiveATC.net's Terms of Use.

## Tuning airspace / phases

Flight phase classification (tower green, TRACON cyan, departing, climbout, etc.) reads per-airport geometry and optional thresholds from [`../src/data/airspace.json`](../src/data/airspace.json). Defaults live in `PHASE_DEFAULTS` in [`../src/lib/airspace.ts`](../src/lib/airspace.ts); do not tune one airport by changing shared constants in [`../src/lib/flightPhase.ts`](../src/lib/flightPhase.ts).

### Geometry (adjust first)

Each verified airport entry can set:

| Field | Role |
|-------|------|
| `twr_radius_nm` / `twr_ceil_ft` | Tower cylinder (path A) — descending traffic inside → **tower** (green): `final` or `arrival` |
| `tracon_radius_nm` / `tracon_ceil_ft` | TRACON cylinder — descending outside tower but inside TRACON → **tracon** (cyan): `approach` |

**Path B — final centerline:** descending traffic on an active runway’s extended inbound centerline within `final_radius_nm` of the threshold (default 7 nm) also counts as tower green, even outside the airport cylinder. Tune with `final_radius_nm`, `final_lateral_nm`, and `final_heading_tolerance_deg` in `phase` overrides.

Example: KDEN uses `twr_ceil_ft: 7000` and `tracon_ceil_ft: 12000`, so traffic between 7,000–12,000 ft AGL inside the lateral bounds classifies as TRACON cyan, not tower green.

### Phase threshold overrides (optional)

If geometry alone is not enough, add a `"phase"` object with only the keys you need to override:

```json
"KATL": {
  "class": "B",
  "twr_ceil_ft": 4000,
  "twr_radius_nm": 8,
  "tracon_ceil_ft": 10000,
  "tracon_radius_nm": 40,
  "phase": {
    "tower_descent_fpm": 150
  }
}
```

Supported keys match `PhaseThresholds` in `airspace.ts`: `cruise_alt_ft`, `cruise_level_fpm`, `departing_radius_nm`, `departing_climb_fpm`, `departing_max_agl_ft`, `departing_min_kts`, `tower_descent_fpm`, `tracon_descent_fpm`, `climbout_climb_fpm`, `arrival_radius_nm`, `final_radius_nm`, `final_lateral_nm`, `final_heading_tolerance_deg`.

### Tuning workflow

1. Open the scope at the target airport and watch misclassified traffic.
2. Adjust `twr_*` and `tracon_*` in `airspace.json` first.
3. Only if still wrong, add `"phase": { ... }` overrides for that ICAO.
4. Run `npm run build` to confirm types still resolve.
