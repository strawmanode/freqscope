import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFeedSetup } from '../components/setup/useFeedSetup'
import airportsData from '../data/airports.json'
import { getAirspace } from '../lib/airspace'
import { formatTempFahrenheit, parseMetarBatch, type MetarBrief } from '../lib/metarBrief'
import type { Airport } from '../types'

const airports = airportsData as Airport[]

// Verified airports - curated list with confirmed radar and frequency data
// Search is hidden until more airports are verified
const VERIFIED_ICAOS = [
  'KATL',
  'KORD',
  'KLAX',
  'KJFK',
  'KSFO',
  'KDFW',
  'KDEN',
  'KLAS',
  'KMIA',
  'KSEA',
  'KMEM',
]

const verifiedAirports = VERIFIED_ICAOS
  .map((icao) => airports.find((a) => a.icao === icao))
  .filter((a): a is Airport => Boolean(a))

const METAR_REFRESH_MS = 5 * 60_000

// Fixed blip positions on the hero scope (percent of scope size)
const HERO_BLIPS = [
  { left: '62%', top: '28%', delay: '0s' },
  { left: '34%', top: '46%', delay: '0.9s' },
  { left: '71%', top: '58%', delay: '1.7s' },
  { left: '47%', top: '69%', delay: '2.6s' },
  { left: '26%', top: '24%', delay: '3.4s' },
]

function tickerText(airport: Airport, brief: MetarBrief | undefined): string {
  const parts = [
    `${airport.icao} ${airport.city.toUpperCase()}`,
    brief?.wind ? `WIND ${brief.wind}` : null,
    brief?.vis ? `VIS ${brief.vis}` : null,
    brief?.sky ?? null,
    brief?.tempC != null ? formatTempFahrenheit(brief.tempC) : null,
  ].filter(Boolean)
  return parts.join('  ·  ')
}

export function Home() {
  const navigate = useNavigate()
  const { status, loading, openSetup } = useFeedSetup()
  const [briefs, setBriefs] = useState<Map<string, MetarBrief>>(new Map())

  useEffect(() => {
    let cancelled = false
    const fetchBriefs = async () => {
      try {
        const ids = VERIFIED_ICAOS.join(',')
        const res = await fetch(`/api/metar?ids=${ids}&format=raw`)
        if (!res.ok || cancelled) return
        const text = await res.text()
        if (!cancelled) setBriefs(parseMetarBatch(text))
      } catch {
        // Tiles degrade to static info when weather is unavailable
      }
    }
    fetchBriefs()
    const id = window.setInterval(fetchBriefs, METAR_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const tickerItems = useMemo(
    () => verifiedAirports.map((a) => tickerText(a, briefs.get(a.icao))),
    [briefs],
  )
  const hasWeather = briefs.size > 0

  const selectAirport = (airport: Airport) => {
    navigate(`/scope/${airport.icao}`)
  }

  return (
    <div className="landing-root bg-terminal" style={{ fontFamily: 'var(--mono)' }}>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="landing-hero">
        <div className="landing-hero__copy">
          <div className="landing-hero__live">
            <span className="landing-hero__live-dot" />
            LIVE NETWORK
          </div>
          <h1 className="landing-hero__title">FREQSCOPE</h1>
          <p className="landing-hero__tagline">
            LIVE RADAR · REAL FREQUENCIES · ATC HANDOFF
          </p>
          <p className="landing-hero__sub">
            Take the scope at America's busiest fields. Watch real traffic
            paint in real time, select the tower, and work the picture like a
            controller.
          </p>
          <section className="landing-contact" aria-labelledby="landing-contact-title">
            <div>
              <h2 id="landing-contact-title" className="landing-contact__title">
                Contact
              </h2>
              <p className="landing-contact__copy">
                Follow FreqScope updates and send feedback at <span>@freqscope</span>.
              </p>
            </div>
            <div className="landing-contact__links" aria-label="Social links">
              <a href="https://www.youtube.com/@freqscope" target="_blank" rel="noreferrer">
                YouTube
              </a>
              <a href="https://x.com/freqscope" target="_blank" rel="noreferrer">
                X
              </a>
              <a href="https://www.reddit.com/user/freqscope" target="_blank" rel="noreferrer">
                Reddit
              </a>
            </div>
            <p className="landing-contact__note">
              Reddit has flagged the @freqscope account as a bot and shadowbanned it;
              review is pending.
            </p>
          </section>
        </div>

        <div className="landing-scope" aria-hidden="true">
          <div className="landing-scope__rings" />
          <div className="landing-scope__grid" />
          <div className="landing-scope__sweep" />
          {HERO_BLIPS.map((blip, i) => (
            <span
              key={i}
              className="landing-scope__blip"
              style={{ left: blip.left, top: blip.top, animationDelay: blip.delay }}
            />
          ))}
        </div>
      </div>

      {!loading && status && !status.configured && (
        <div className="feed-setup-home-banner">
          <div>
            <strong>Live radar needs setup.</strong> Add your name and email before
            aircraft feeds will work.
          </div>
          <button type="button" className="feed-setup-inline-btn" onClick={openSetup}>
            Open setup
          </button>
        </div>
      )}

      {/* ── ATIS ticker ────────────────────────────────────────── */}
      <div className="landing-ticker" aria-hidden={!hasWeather}>
        <span className="landing-ticker__label">
          {hasWeather ? 'LIVE WX' : 'NETWORK'}
        </span>
        <div className="landing-ticker__viewport">
          <div className="landing-ticker__track">
            {[0, 1].map((copy) => (
              <span key={copy} className="landing-ticker__copy">
                {(hasWeather
                  ? tickerItems
                  : ['CONTACTING AVIATION WEATHER CENTER…']
                ).map((item, i) => (
                  <span key={i} className="landing-ticker__item">
                    {item}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 pb-12 pt-10">
        {/* Section label */}
        <div className="mb-4 flex items-center gap-4">
          <span className="text-xs tracking-widest text-muted uppercase">
            Select Facility
          </span>
          <div className="flex-1 border-t border-white/10" />
          <span className="text-xs text-muted">
            {verifiedAirports.length} verified
          </span>
        </div>

        {/* Airport grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {verifiedAirports.map((airport) => {
            const airspace = getAirspace(airport.icao)
            const brief = briefs.get(airport.icao)
            return (
              <button
                key={airport.icao}
                type="button"
                onClick={() => selectAirport(airport)}
                className="landing-tile group"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="text-2xl font-bold tracking-widest text-aircraft"
                    style={{ textShadow: '0 0 10px rgba(0,255,65,0.3)' }}
                  >
                    {airport.icao}
                  </div>
                  <span className="landing-tile__class">CLASS {airspace.class}</span>
                </div>

                <div className="text-xs leading-tight text-white/80">
                  {airport.name}
                </div>
                <div className="text-xs text-muted">
                  {airport.city}, {airport.state}
                </div>

                <div className="landing-tile__wx">
                  {brief ? (
                    <>
                      <span className="landing-tile__wx-dot" />
                      <span>
                        {[brief.wind && `${brief.wind}`, brief.vis, brief.sky]
                          .filter(Boolean)
                          .join(' · ') || 'WX REPORTING'}
                      </span>
                    </>
                  ) : (
                    <span className="landing-tile__wx-pending">WX STANDBY</span>
                  )}
                </div>

                <div className="border-t border-white/10" />

                <div className="flex justify-between text-[10px] tracking-wider text-muted">
                  <span>
                    TWR <span className="text-white/70">{Math.round(airspace.twr_ceil_ft / 100)}↑</span>
                  </span>
                  <span>
                    APP <span className="text-white/70">{Math.round(airspace.tracon_ceil_ft / 1000)}K</span>
                  </span>
                  <span>
                    RNG <span className="text-white/70">{airspace.tracon_radius_nm}NM</span>
                  </span>
                </div>

                <div className="landing-tile__cta">TAKE POSITION ▶</div>
              </button>
            )
          })}
        </div>

        <div className="mt-8 text-center text-xs text-muted">
          Additional airports coming soon
        </div>
      </div>
    </div>
  )
}
