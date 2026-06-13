# FreqScope Notices

FreqScope is an independent source-available project by Chris Dionne. It is
not affiliated with, endorsed by, or sponsored by LiveATC.net, airplanes.live,
adsb.lol, planespotters.net, CARTO, Google, the FAA, NOAA/NWS, Flightradar24,
OurAirports, or any other third-party provider.

## Third-Party Services and Data

FreqScope may display, link to, request, or help users locate information from
third-party services and public data sources. The FreqScope license applies only
to rights the copyright holder can grant in this repository. It does not grant
any rights to third-party services, feeds, audio streams, photos, datasets,
trademarks, logos, or other content.

Users are solely responsible for reviewing and complying with all third-party
terms, licenses, acceptable-use policies, attribution requirements, rate limits,
and applicable laws before using FreqScope with any third-party service or data
source.

Known third-party services and data sources include:

| Provider | How FreqScope uses it | User responsibility |
| --- | --- | --- |
| LiveATC.net | Opens airport search pages in a browser tab. | Follow LiveATC.net terms. Do not embed, proxy, record, automate retrieval of, directly expose, or redistribute streams without permission. |
| airplanes.live | Runtime ADS-B aircraft feed through the local dev API. | Follow airplanes.live API terms, including non-commercial use and rate limits. |
| adsb.lol | Runtime fallback ADS-B aircraft feed through the local dev API. | Follow adsb.lol terms and ODbL/open-data requirements. |
| Aviation Weather Center / aviationweather.gov | Runtime METAR, SIGMET, and G-AIRMET requests through the local dev API. | Keep requests limited in scope and frequency; do not present modified data as official government material. |
| FAA / tfr.faa.gov | Runtime Temporary Flight Restriction list, geometry, and detail requests. | Verify TFR/NOTAM information through official FAA sources before relying on it. |
| FAA NASR | Optional build-time airport, frequency, and runway CSV source. | Use the current official subscription and comply with any FAA/DOT notices for the downloaded data. |
| OurAirports | Optional build-time fallback airport, frequency, and runway CSV source. | Respect OurAirports public-domain/no-warranty terms and data freshness limits. |
| planespotters.net | Runtime aircraft photo thumbnails with photographer attribution and photo-page links. | Preserve attribution and comply with planespotters.net API/photo terms. |
| CARTO basemaps and OpenStreetMap data | Runtime Cesium imagery tiles for radar map themes. | Preserve OSM/CARTO attribution and comply with CARTO basemap terms, especially for hosted or commercial deployments. |
| Google Fonts | Runtime webfont CSS/font delivery for the app UI. | Understand that visitors' browsers contact Google Fonts unless fonts are self-hosted. |

This list is intended to describe known project integrations, not to replace
the providers' current terms.

Provider reference links:

- LiveATC.net Terms of Use: <https://www.liveatc.net/legal/>
- airplanes.live API guide: <https://airplanes.live/api-guide/>
- airplanes.live commercial-use page: <https://airplanes.live/commercial-use/>
- adsb.lol API docs: <https://www.adsb.lol/docs/open-data/api/>
- adsb.lol privacy and license: <https://www.adsb.lol/privacy-license/>
- Aviation Weather Center Data API: <https://aviationweather.gov/data/api/>
- National Weather Service disclaimer: <https://www.weather.gov/disclaimer>
- FAA NASR subscription: <https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/>
- OurAirports data terms: <https://ourairports.com/data/>
- CARTO basemaps: <https://carto.com/basemaps/>
- Google Fonts privacy FAQ: <https://developers.google.com/fonts/faq/privacy>

## Third-Party Code, Models, and Assets

Third-party code, packages, generated assets, and model files remain under
their own licenses. FreqScope's PolyForm Noncommercial license does not
relicense those materials or remove their requirements.

Known third-party materials used with FreqScope include:

| Material | Location | License / source notes |
| --- | --- | --- |
| CesiumJS and copied Cesium static assets | `node_modules/cesium`, `public/Workers`, `public/Assets`, `public/ThirdParty`, `public/Widgets` | Cesium packages are Apache-2.0. Keep Cesium license notices intact. |
| Aircraft GLB models (optional, not shipped in repo) | `public/models/aircraft` | **Not** licensed under PolyForm. Download separately via `npm run setup:models`. Mostly from Flightradar24 `fr24-3d-models` (GPLv2); `c172.glb` is from FGMEMBERS/BelugaProject sources (GPLv2). See `public/models/aircraft/README.md`. |
| Airspace source package | `@squawk/airspace-data` via `scripts/build-airspace.mjs` | MIT-licensed package used to generate local airspace JSON. |
| React and Vite starter SVGs | `src/assets/react.svg`, `src/assets/vite.svg` | Retained project assets from upstream tools; remove if no longer needed. |

Do not assume that a non-commercial FreqScope use automatically satisfies all
third-party licenses. In particular, copyleft model assets and share-alike data
licenses may impose separate distribution obligations.

Asset and package reference links:

- CesiumJS: <https://github.com/CesiumGS/cesium>
- Flightradar24 3D models: <https://github.com/Flightradar24/fr24-3d-models>
- FGMEMBERS C172P model source: <https://github.com/FGMEMBERS/c172p-detailed>
- squawk airspace data package: <https://github.com/neilcochran/squawk>

## LiveATC

FreqScope is designed to hand users off to LiveATC.net in a normal browser tab.
FreqScope does not embed, proxy, fetch, record, store, link directly to, or
redistribute LiveATC audio streams.

LiveATC.net use is governed by LiveATC.net's own Terms of Use:

<https://www.liveatc.net/legal/>

Users are responsible for ensuring their own LiveATC.net use is allowed. Do not
modify or deploy FreqScope in a way that directly exposes, republishes, records,
automates retrieval of, or commercially uses LiveATC.net audio streams unless
you have the necessary permission from LiveATC.net.

## Live Aircraft and Weather Data

FreqScope's live aircraft and weather views are not primary sources and are not
complete, guaranteed, or authoritative. ADS-B/MLAT feeds may omit aircraft,
delay reports, include inaccurate metadata, or apply provider-side filtering.
METAR, SIGMET, G-AIRMET, and TFR data may be delayed, cached, incomplete,
unavailable, or superseded by official briefings and notices.

Users are responsible for choosing request intervals, headers, deployments, and
data-retention behavior that comply with each provider's current rules.

## No Operational Use

FreqScope is for informational, educational, hobby, and public-interest use. It
is not intended for aviation, operational, dispatch, law enforcement, judicial,
safety-critical, emergency, or other reliance-based use. Live aircraft,
weather, airspace, airport, frequency, model, and other data may be delayed,
inaccurate, incomplete, unavailable, or unsuitable for any particular purpose.

## User Responsibility

By using, modifying, running, hosting, or distributing FreqScope, you are
responsible for your own use of the project and any third-party services or
data sources you access. The copyright holder does not authorize unlawful use,
third-party terms violations, infringement, scraping, stream redistribution, or
commercial exploitation of third-party content.
