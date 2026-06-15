# FreqScope

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![Version](https://img.shields.io/github/v/tag/strawmanode/freqscope?label=version)](https://github.com/strawmanode/freqscope/releases)

**See live air traffic on a true 3D radar scope — and hear the controllers working it.**

FreqScope puts **real ADS-B traffic, 3D airspace, and a credited LiveATC handoff** in one view. Search any major US airport, watch aircraft move through tower, TRACON, and center volumes on a globe you can tilt and orbit, then open the matching [LiveATC.net](https://www.liveatc.net/) feed with one click.

<p align="center">
  <a href="./screenshots/scope.png">
    <img src="screenshots/scope.png" width="900" alt="FreqScope radar scope showing live traffic and 3D airspace">
  </a>
</p>

[Download](#download) · [Quick start](#quick-start) · [Highlights](#highlights) · [Contributing](CONTRIBUTING.md) · [Setup guide](SETUP.md) · [Report a bug](https://github.com/strawmanode/freqscope/issues/new) · [Security](SECURITY.md)

**New here?** Download the [desktop app](#download) — no Node or terminal required. Developers can jump to the [quick start](#quick-start) below.

---

## Download

Installers for macOS, Windows, and Linux are published on
[GitHub Releases](https://github.com/strawmanode/freqscope/releases).

| Platform | Download |
| -------- | -------- |
| **macOS** (Apple Silicon & Intel) | [DMG](https://github.com/strawmanode/freqscope/releases/latest/download/FreqScope-mac.dmg) · [ZIP](https://github.com/strawmanode/freqscope/releases/latest/download/FreqScope-mac.zip) |
| **Windows** (x64) | [Installer](https://github.com/strawmanode/freqscope/releases/latest/download/FreqScope-win.exe) |
| **Linux** (x64) | [AppImage](https://github.com/strawmanode/freqscope/releases/latest/download/FreqScope-linux.AppImage) |

On first launch, enter your name and email when prompted — that's all the live
aircraft feed needs.

<details>
<summary><strong>macOS: “Apple can’t check app for malicious software”?</strong></summary>

FreqScope is not code-signed yet, so macOS Gatekeeper blocks the first launch.
This is expected for early releases built outside the Mac App Store.

1. Try to open **FreqScope** once (double-click or from the DMG). macOS will block it.
2. Open **System Settings** → **Privacy & Security**.
3. Scroll to **Security** — you should see a message about FreqScope being blocked.
4. Click **Open Anyway** (this option appears for about an hour after you try to open the app).
5. Enter your Mac login password and confirm.

FreqScope is then saved as an exception and opens normally from then on. Full
notes (Windows SmartScreen, code signing plans) are in
[SETUP.md § Desktop app](SETUP.md#opening-freqscope-on-macos-unsigned-build).

</details>

> **Windows** may show a similar SmartScreen warning until builds are signed.
> See [SETUP.md](SETUP.md#windows-smartscreen-unsigned-build).

---

## Quick start

For local development in a browser:

```bash
git clone https://github.com/strawmanode/freqscope.git
cd freqscope
npm install
cp .env.example .env.local   # add your name and email
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

**Desktop app from source:**

```bash
npm run electron:dev     # dev window with hot reload
npm run electron:build   # installer for your OS into release/
```

Airport, frequency, and airspace data ship prebuilt in `src/data/`. Full
configuration, feed setup, optional 3D models, and troubleshooting are in
**[SETUP.md](SETUP.md)**.

---

## Highlights

- **True 3D scope** — Cesium globe with tilt, orbit, and zoom; not a flat map.
- **3D airspace** — tower / TRACON / ARTCC boundaries, SUA, and TFRs as shells you can look inside.
- **Live ADS-B radar** — real aircraft positions polled every few seconds around your airport.
- **Scope symbology** — altitude-banded targets, VFR and emergency-squawk detection, data blocks, trails.
- **Weather layer** — METAR plus SIGMET / G-AIRMET advisories for the area.
- **Scope themes** — STARS, ERAM, and a modern light theme.
- **LiveATC handoff** — credited **Listen** button opens the airport's LiveATC page.
- **Desktop app** — double-click install with bundled server and automatic updates via GitHub Releases.
- **Optional 3D aircraft** — swap 2D symbols for GLB models on supported types ([setup](public/models/aircraft/README.md)).

<p align="center">
  <a href="./screenshots/search.png">
    <img src="screenshots/search.png" width="700" alt="FreqScope airport search">
  </a>
</p>

---

## Get involved

FreqScope is source-available and built in the open. We'd love your help making
it better — whether you fly, code, write docs, or just love watching traffic.

| | |
| --- | --- |
| **Try it & report bugs** | [Open an issue](https://github.com/strawmanode/freqscope/issues/new) with steps to reproduce, your OS, and a screenshot if you can. |
| **Contribute code** | Read **[CONTRIBUTING.md](CONTRIBUTING.md)**, pick an issue (or propose one), and open a pull request. |
| **Improve docs** | Setup guides, screenshots, and README polish are always welcome. |
| **Aviation & data** | Airport defaults, frequency mappings, airspace edge cases, and reference-data scripts live in [`scripts/`](scripts/README.md). |
| **Scope & UI** | Themes, symbology, performance with heavy traffic, and radar UX feedback. |
| **Desktop & packaging** | Electron builds, code signing, and cross-platform testing (especially Windows and Linux). |

Before opening a PR: `npm run lint` and `npm run build` should pass. Security
issues go through **[SECURITY.md](SECURITY.md)** — please don't file them
publicly.

---

## Project docs

| Doc | What's in it |
| --- | --- |
| **[SETUP.md](SETUP.md)** | Install, feed configuration, data sources, desktop app, scripts |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to contribute, PR checklist, license note |
| **[SECURITY.md](SECURITY.md)** | Reporting vulnerabilities |
| **[NOTICE.md](NOTICE.md)** | Third-party services, data, and license notices |
| **[scripts/README.md](scripts/README.md)** | Regenerating airport, frequency, and airspace data |

## Tech stack

Vite · React · TypeScript · Tailwind CSS · CesiumJS · Electron ·
[airplanes.live](https://api.airplanes.live) (with [adsb.lol](https://api.adsb.lol) fallback)

---

## License & disclaimer

FreqScope is **source-available, not open source.** It is licensed under the
[PolyForm Noncommercial License 1.0.0](LICENSE) for personal, educational,
research, public-safety, government, charitable, and other non-commercial use.
Commercial use requires a separate license from the copyright holder.

The license covers only what the copyright holder can grant in FreqScope itself.
It does **not** grant rights to third-party services, feeds, audio streams,
datasets, or trademarks. FreqScope is provided **"as is"** and is **not** for
aviation, operational, safety-critical, or reliance-based use. Users must comply
with [LiveATC.net's Terms of Use](https://www.liveatc.net/legal/) and all
other provider terms. See [NOTICE.md](NOTICE.md).
