# FreqScope

**Live traffic on a 3D radar scope. Real frequencies. External ATC audio handoff.**

Search a US airport, watch live aircraft move through a 3D scope with real airspace you can tilt and look inside, and open a credited **Listen** handoff to [LiveATC.net](https://www.liveatc.net/) — so you can see the traffic and hear the controllers at the same time.

<img src="screenshots/scope.png" width="900" alt="FreqScope radar scope">

## Vision

FreqScope recreates the *feel* of an air traffic control radar scope — then goes somewhere no real scope can. Operational displays are flat and intentionally bare: targets, data blocks, a few map lines, nothing else. FreqScope rebuilds the scope in **three dimensions** — real terrain, and airspace you can actually *see*. Tower, TRACON, and center volumes, special-use airspace, and TFRs are rendered as 3D shells you can tilt, orbit, and look inside, with the traffic moving through them. It blends that dimensional scope with real-world geography so a regular person can read the picture, place the traffic, and understand the shape of the sky overhead. Advanced, civilian-friendly software that's both educational and genuinely fun to watch.

## About

I'm Chris — a software engineer, and before that an air traffic controller in the U.S. Air Force for 12 years. FreqScope comes straight out of that background. I wanted to take something most people only ever see in a control room and make it approachable: real, live traffic on a true 3D scope, with the airspace drawn the way I learned to picture it.

When I went looking for software that already did this, it wasn't there. ATC *simulators* run pretend traffic; flight *trackers* show real traffic on a flat 2D map. Nothing combined real aircraft, a 3D scope, and real-world geography for a regular person to explore — so I started building it.

FreqScope isn't a literal copy of a controller's screen — real scopes are sparse and flat by design. It does the opposite: real-world mapping and 3D airspace that operational scopes don't have, so the picture is readable and explorable without a controller sitting next to you.

— Chris Dionne ([@strawmanode](https://github.com/strawmanode))

## Community — and why it matters

FreqScope sits at an intersection that surprisingly few tools occupy: it pairs **ADS-B traffic** (watching the picture) with a **LiveATC audio** handoff (hearing the controllers). These go hand in hand, but the conversations around them tend to be scattered — ADS-B questions live in one set of forums, LiveATC questions in another, so even someone interested in both ends up hopping between venues to discuss what's really one connected hobby. Because using FreqScope means doing both at once, it can be a single place to bring that overlapping interest together.

The project needs two kinds of people:

- **Aviation enthusiasts** who want to run it and explore real traffic alongside live ATC.
- **Software engineers who love this stuff** and want to push it further.

FreqScope only moves forward when developers who genuinely enjoy aviation decide to make it better. If that's you — star it, run it, open an issue or a PR, or just tell me what you'd want it to do. Questions, ideas, and introductions are welcome in [GitHub Discussions](https://github.com/strawmanode/freqscope/discussions).

## What it does

- **A true 3D scope** — built on a real 3D globe, not a flat map. Tilt, orbit, and zoom the view to see the airspace from any angle.
- **3D airspace volumes** — tower / TRACON / ARTCC boundaries, special-use airspace (MOA, restricted, warning, alert), and TFRs rendered as 3D shells you can look inside, with traffic flying through them.
- **Live ADS-B radar** — real aircraft positions polled every few seconds in a box around your selected airport.
- **Scope-style targets** — altitude-banded symbology (tower / TRACON / center / ground), VFR and emergency-squawk detection, data blocks, and trails.
- **Real-world map underlay** — terrain, city labels, and landmarks beneath the scope so the traffic has context.
- **Live weather** — METAR, plus SIGMET / G-AIRMET advisories for the area.
- **Selectable scope themes** — STARS, ERAM, and a modern light theme.
- **LiveATC handoff** — a credited **Listen** button that opens the airport's LiveATC page so you can hear the positions you're watching.
- **Optional 3D aircraft** — swap 2D symbols for 3D models on supported types (third-party assets, downloaded separately).

## Screenshots

<img src="screenshots/search.png" width="900" alt="Airport search">

## Get started

```bash
npm install
cp .env.example .env.local   # then add your own name and email
npm run dev
```

Airport, frequency, and airspace data ship prebuilt in `src/data/`. Run
`npm run build:data` only when you want to regenerate that data (requires FAA
NASR or OurAirports CSVs — see [`scripts/README.md`](scripts/README.md)).

Open [http://localhost:5173](http://localhost:5173).

Full instructions — including the required feed configuration, optional 3D
models, data sources, and troubleshooting — are in **[SETUP.md](SETUP.md)**.

> **Heads up:** the live aircraft feed requires you to identify yourself to
> upstream ADS-B providers. FreqScope prompts for your name and email on first
> run and won't start the feed until they're set. Details in
> [SETUP.md](SETUP.md#feed-configuration).

## Tech stack

Vite · React · TypeScript · React Router · Tailwind CSS · CesiumJS · static JSON · [airplanes.live](https://api.airplanes.live) (with [adsb.lol](https://api.adsb.lol) fallback)

## Project docs

- **[SETUP.md](SETUP.md)** — install, configuration, data, and scripts
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to contribute
- **[SECURITY.md](SECURITY.md)** — reporting vulnerabilities
- **[NOTICE.md](NOTICE.md)** — third-party services, data, and license notices

## License & disclaimer

FreqScope is **source-available, not open source.** It is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE) for personal, educational,
research, public-safety, government, charitable, and other non-commercial use.
Commercial use — selling, hosting, or bundling FreqScope as part of a paid
product or service — requires a separate license from the copyright holder.

The license covers only what the copyright holder can grant in FreqScope itself.
It does **not** grant rights to any third-party service, feed, audio stream,
dataset, photo, trademark, or content. FreqScope is provided "as is" and is
**not** for aviation, operational, law-enforcement, judicial, safety-critical,
or other reliance-based use. Users are responsible for complying with
[LiveATC.net's Terms of Use](https://www.liveatc.net/legal/) and the terms of
any other provider they access. See [NOTICE.md](NOTICE.md).
