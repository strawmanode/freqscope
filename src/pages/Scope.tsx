import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DisplayFilters } from '../components/console/DisplayFilters'
import { LiveAtcModule } from '../components/console/LiveAtcModule'
import { PositionHeader } from '../components/console/PositionHeader'
import { RadarBezel } from '../components/console/RadarBezel'
import { LayersBar } from '../components/console/LayersPanel'
import { RangePanel } from '../components/console/RangePanel'
import { StatusPanel, type Advisory, type MetarData, type SigmetData } from '../components/console/StatusPanel'
import { TopBar } from '../components/console/TopBar'
import type {
  AircraftFilter,
  AltFilter,
  CallsignFilter,
  SelectedAircraft,
} from '../components/radar/types'
import airportsData from '../data/airports.json'
import frequenciesData from '../data/frequencies.json'
import runwaysData from '../data/runways.json'
import { getAirspace } from '../lib/airspace'
import { getEffectiveActiveRunwayEnds } from '../lib/activeRunways'
import { type AnimationPreset } from '../lib/airspaceAnimationPresets'
import { getAirspacePalette, getTfrColor } from '../lib/airspacePalette'
import {
  RADAR_THEME_STORAGE_KEY,
  getRadarTheme,
  isRadarThemeId,
  type RadarThemeId,
} from '../lib/radarThemes'
import {
  DEFAULT_TYPE_FILTERS,
  TARGET_CLASS_OPTIONS,
  type TypeFilterState,
} from '../lib/targetClass'
import {
  COLOR_TWR,
  COLOR_TRACON,
  COLOR_CTR,
  COLOR_GND,
  COLOR_EMERG,
} from '../lib/airspaceColor'
import type { Airport, FrequenciesByIcao, RunwaysByIcao } from '../types'

const airports = airportsData as Airport[]
const frequenciesByIcao = frequenciesData as FrequenciesByIcao
const runwaysByIcao = runwaysData as unknown as RunwaysByIcao

const CONSOLE_H = 1015

const NOISE_URI = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.04" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`

const METAR_POLL_MS = 5 * 60 * 1000

function getInitialRadarTheme(): RadarThemeId {
  if (typeof window === 'undefined') return 'stars'
  const stored = window.localStorage.getItem(RADAR_THEME_STORAGE_KEY)
  return isRadarThemeId(stored) ? stored : 'stars'
}

type LegendSwatchShape = 'dot' | 'square' | 'polygon' | 'ring' | 'triangle'

function ScopeLegendSwatch({
  color,
  shape = 'dot',
}: {
  color: string
  shape?: LegendSwatchShape
}) {
  if (shape === 'triangle') {
    return (
      <span
        aria-hidden
        style={{
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: `14px solid ${color}`,
          filter: `drop-shadow(0 0 4px ${color}66)`,
          flexShrink: 0,
        }}
      />
    )
  }

  if (shape === 'ring') {
    return (
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          boxShadow: `0 0 6px ${color}55`,
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{
        width: shape === 'dot' ? 12 : 18,
        height: shape === 'dot' ? 12 : 14,
        borderRadius: shape === 'dot' ? '50%' : shape === 'square' ? 2 : 4,
        background: color,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.45), 0 0 8px ${color}66`,
        flexShrink: 0,
      }}
    />
  )
}

function ScopeLegendItem({
  color,
  label,
  sub,
  shape = 'dot',
}: {
  color: string
  label: string
  sub: string
  shape?: LegendSwatchShape
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '26px 1fr',
        gap: 10,
        alignItems: 'center',
        minHeight: 38,
      }}
    >
      <ScopeLegendSwatch color={color} shape={shape} />
      <div>
        <div style={{ color: 'var(--green2)', fontSize: 11, letterSpacing: 2 }}>
          {label}
        </div>
        <div style={{ color: 'var(--dim)', fontSize: 9, letterSpacing: 0.8, lineHeight: 1.35 }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

function ScopeLegendSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--dim)', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}

function formatAdvisoryUtcTime(value?: string | number): string {
  if (value == null || value === '') return '—'
  const ms =
    typeof value === 'number'
      ? value * 1000
      : /^\d+$/.test(value)
        ? Number(value) * 1000
        : Date.parse(value)
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}${d.getUTCMinutes().toString().padStart(2, '0')}Z`
}

function AdvisoryCard({
  item,
  color,
  borderColor,
  expanded,
  onToggle,
}: {
  item: Advisory
  color: string
  borderColor: string
  expanded: boolean
  onToggle: () => void
}) {
  const hazard = (item.hazard as string) ?? (item.airSigmetType as string) ?? 'SIGMET'
  const from = formatAdvisoryUtcTime(item.validTimeFrom as string | number | undefined)
  const to = formatAdvisoryUtcTime(item.validTimeTo as string | number | undefined)

  return (
    <div
      onClick={onToggle}
      style={{
        marginBottom: 6,
        padding: '8px 12px',
        background: expanded
          ? 'linear-gradient(#0f1a14, #080e0b)'
          : 'linear-gradient(#0d1412, #080e0b)',
        border: `1px solid ${expanded ? color : borderColor}`,
        borderRadius: 5,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color, letterSpacing: 2 }}>{hazard}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}>
            {from} – {to}
          </span>
          <span style={{ fontSize: 9, color: 'var(--dim)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && item.rawAirSigmet && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${borderColor}`,
            fontSize: 9,
            color: 'var(--lcd)',
            letterSpacing: 1,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {(item.rawAirSigmet as string).trim()}
        </div>
      )}
    </div>
  )
}

function formatAckZulu(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}${d.getUTCMinutes().toString().padStart(2, '0')}Z`
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600).toString().padStart(2, '0')
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatZulu(date: Date): string {
  const h = date.getUTCHours().toString().padStart(2, '0')
  const m = date.getUTCMinutes().toString().padStart(2, '0')
  const s = date.getUTCSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s} Z`
}

function parseRawMetar(raw: string): MetarData {
  // Wind: 18015KT, VRB05KT, 18015G25KT
  let wdir: number | string | undefined
  let wspd: number | undefined
  const windMatch = raw.match(/\b(VRB|\d{3})(\d{2,3})(?:G\d{2,3})?KT\b/)
  if (windMatch) {
    wdir = windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1], 10)
    wspd = parseInt(windMatch[2], 10)
  }

  // Visibility: 10SM, 1/2SM, M1/4SM
  let visib: string | undefined
  const visMatch = raw.match(/\b(M?(?:\d+\s+)?\d+\/\d+|\d+)SM\b/)
  if (visMatch) visib = visMatch[1]

  // Altimeter: A2992 (inHg × 100) → hPa
  let altim: number | undefined
  const altMatch = raw.match(/\bA(\d{4})\b/)
  if (altMatch) altim = Math.round((parseInt(altMatch[1], 10) / 100) * 33.8639 * 10) / 10

  // Temp/dew: 20/15, M02/M05, M02/15, 20/M05
  let temp: number | undefined
  let dewp: number | undefined
  const tempMatch = raw.match(/\b(M?)(\d{2})\/(M?)(\d{2})\b/)
  if (tempMatch) {
    temp = tempMatch[1] === 'M' ? -parseInt(tempMatch[2], 10) : parseInt(tempMatch[2], 10)
    dewp = tempMatch[3] === 'M' ? -parseInt(tempMatch[4], 10) : parseInt(tempMatch[4], 10)
  }

  // Sky: CLR, SKC, FEW018, SCT025, BKN010, OVC008, VV003
  const clouds: { cover: string; base?: number }[] = []
  const cloudRegex = /\b(CLR|SKC|NSC|NCD|FEW|SCT|BKN|OVC|VV)(\d{3})?\b/g
  let cm
  while ((cm = cloudRegex.exec(raw)) !== null) {
    clouds.push({
      cover: cm[1],
      base: cm[2] ? parseInt(cm[2], 10) * 100 : undefined,
    })
  }

  // Obs time from dayHHMMZ token e.g. 041552Z
  let obsTime: number | undefined
  const timeMatch = raw.match(/\b\d{2}(\d{2})(\d{2})Z\b/)
  if (timeMatch) {
    const now = new Date()
    obsTime = Math.floor(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        parseInt(timeMatch[1], 10),
        parseInt(timeMatch[2], 10),
      ) / 1000,
    )
  }

  return {
    obsTime,
    wdir,
    wspd,
    visib,
    cover: clouds[0]?.cover,
    clouds,
    temp,
    dewp,
    altim,
  }
}

function ScopeConsole({ airport }: { airport: Airport }) {
  const navigate = useNavigate()
  const initialAltFilter = airport.defaults?.altFilter ?? 'TWR'
  const initialTrafficFilter = airport.defaults?.trafficFilter ?? 'AIR'

  const consoleRef = useRef<HTMLDivElement>(null)
  const resetViewRef = useRef<(() => void) | null>(null)
  const flyToIcaoRef = useRef<((icao: string) => void) | null>(null)
  const positionSessionRef = useRef({
    altFilter: initialAltFilter,
    filterStartedAt: 0,
    accumulated: { TWR: 0, TRACON: 0, CTR: 0, ALL: 0 } as Record<AltFilter, number>,
  })
  const trackedTargetsRef = useRef(new Set<string>())
  const emergSeenRef = useRef(new Set<string>())

  const [rangeNm, setRangeNm] = useState(20)
  const [trafficFilter, setTrafficFilter] = useState<AircraftFilter>(initialTrafficFilter)
  const [altFilter, setAltFilter] = useState<AltFilter>(initialAltFilter)
  const [positionElapsed, setPositionElapsed] = useState('00:00:00')
  const [positionTimes, setPositionTimes] = useState<Record<AltFilter, number>>({
    TWR: 0,
    TRACON: 0,
    CTR: 0,
    ALL: 0,
  })
  const [callsignFilter, setCallsignFilter] = useState<CallsignFilter>('ID')
  const [aircraftCount, setAircraftCount] = useState(0)
  const [, setSelectedAircraft] = useState<SelectedAircraft | null>(null)
  const [targetsTracked, setTargetsTracked] = useState(0)
  const [emergSeen, setEmergSeen] = useState(0)
  const [zuluNow, setZuluNow] = useState(() => new Date())
  const [metarData, setMetarData] = useState<MetarData | null>(null)
  const [sigmetData, setSigmetData] = useState<SigmetData | null>(null)
  const [advisoryOpen, setAdvisoryOpen] = useState(false)
  const [expandedSigmet, setExpandedSigmet] = useState<number | null>(null)
  const [emergencyAircraft, setEmergencyAircraft] = useState<SelectedAircraft[]>([])
  const [ackedEmerg, setAckedEmerg] = useState<Record<string, number>>({})
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [typeFilters, setTypeFilters] = useState<TypeFilterState>(DEFAULT_TYPE_FILTERS)
  const [typeFilterOpen, setTypeFilterOpen] = useState(false)
  const [radarTheme, setRadarTheme] = useState<RadarThemeId>(getInitialRadarTheme)
  const [airspaceVisible, setAirspaceVisible] = useState(true)
  const [landmarksVisible, setLandmarksVisible] = useState(true)
  const [suaMoaVisible, setSuaMoaVisible] = useState(true)
  const [suaRestrictedVisible, setSuaRestrictedVisible] = useState(true)
  const [suaWarningVisible, setSuaWarningVisible] = useState(true)
  const [suaAlertVisible, setSuaAlertVisible] = useState(true)
  const [tfrVisible, setTfrVisible] = useState(true)
  const [animationPreset, setAnimationPreset] = useState<AnimationPreset>('pulse')
  const [trailConfig, setTrailConfig] = useState({
    twr: { length: 3, fade: 0.5 },
    app: { length: 3, fade: 0.5 },
    ctr: { length: 3, fade: 0.5 },
    gnd: { length: 2, fade: 0.3 },
  })

  const airportFrequencies = airport ? frequenciesByIcao[airport.icao] ?? [] : []

  const registerResetView = useCallback((fn: () => void) => {
    resetViewRef.current = fn
  }, [])

  const registerFlyTo = useCallback((fn: (icao: string) => void) => {
    flyToIcaoRef.current = fn
  }, [])

  const handleFlyToAircraft = useCallback((icao: string) => {
    flyToIcaoRef.current?.(icao)
    setEmergencyOpen(false)
  }, [])

  const handleResetView = useCallback(() => {
    resetViewRef.current?.()
  }, [])

  useEffect(() => {
    const session = positionSessionRef.current
    if (session.filterStartedAt === 0) {
      session.filterStartedAt = Date.now()
    }

    const tick = () => {
      const session = positionSessionRef.current
      const now = Date.now()
      setPositionElapsed(formatElapsed(now - session.filterStartedAt))
      setPositionTimes({
        ...session.accumulated,
        [session.altFilter]:
          session.accumulated[session.altFilter] + (now - session.filterStartedAt),
      })
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const session = positionSessionRef.current
    if (session.altFilter === altFilter) return
    const now = Date.now()
    session.accumulated[session.altFilter] += now - session.filterStartedAt
    session.altFilter = altFilter
    session.filterStartedAt = now
  }, [altFilter])

  useEffect(() => {
    const fit = () => {
      // visualViewport tracks the real visible area on mobile (rotation,
      // URL-bar collapse); window.inner* can report stale values mid-rotation
      const vw = window.visualViewport?.width ?? window.innerWidth
      const vh = window.visualViewport?.height ?? window.innerHeight
      const s = Math.min(1, vh / CONSOLE_H)
      if (consoleRef.current) {
        const visualWidth = vw / s
        consoleRef.current.style.width = `${visualWidth}px`
        consoleRef.current.style.transform = `translate(-50%, -50%) scale(${s})`
      }
    }

    // Mobile rotation settles over several frames (orientation flip, then
    // browser chrome animation) — refit now, next frame, and after settle
    let settleTimer = 0
    const refit = () => {
      fit()
      requestAnimationFrame(fit)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(fit, 350)
    }

    refit()
    window.addEventListener('resize', refit)
    window.addEventListener('orientationchange', refit)
    window.visualViewport?.addEventListener('resize', refit)
    return () => {
      window.clearTimeout(settleTimer)
      window.removeEventListener('resize', refit)
      window.removeEventListener('orientationchange', refit)
      window.visualViewport?.removeEventListener('resize', refit)
    }
  }, [])

  useEffect(() => {
    const el = consoleRef.current
    if (el) el.style.setProperty('--noise', NOISE_URI)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(RADAR_THEME_STORAGE_KEY, radarTheme)
  }, [radarTheme])

  useEffect(() => {
    const id = window.setInterval(() => setZuluNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchMetar = async () => {
      try {
        const res = await fetch(
          `/api/metar?ids=${airport.icao}&format=raw`,
        )
        if (!res.ok || cancelled) return
        const text = (await res.text()).trim()
        if (!text || cancelled) {
          setMetarData(null)
          return
        }
        setMetarData(parseRawMetar(text))
      } catch {
        if (!cancelled) setMetarData(null)
      }
    }

    void fetchMetar()
    const id = window.setInterval(fetchMetar, METAR_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [airport.icao])

  useEffect(() => {
    let cancelled = false
    const fetchSigmet = async () => {
      try {
        const res = await fetch(`/api/sigmet?lat=${airport.lat}&lon=${airport.lon}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setSigmetData(data)
      } catch {
        if (!cancelled) setSigmetData(null)
      }
    }
    void fetchSigmet()
    const id = window.setInterval(fetchSigmet, METAR_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [airport.icao, airport.lat, airport.lon])

  const handleAircraftSelect = useCallback((ac: SelectedAircraft | null) => {
    setSelectedAircraft(ac)
    if (ac && !trackedTargetsRef.current.has(ac.icao24)) {
      trackedTargetsRef.current.add(ac.icao24)
      setTargetsTracked(trackedTargetsRef.current.size)
    }
  }, [])

  const handleEmergencyChange = useCallback((list: SelectedAircraft[]) => {
    setEmergencyAircraft(list)
    let changed = false
    for (const ac of list) {
      if (!emergSeenRef.current.has(ac.icao24)) {
        emergSeenRef.current.add(ac.icao24)
        changed = true
      }
    }
    if (changed) setEmergSeen(emergSeenRef.current.size)
  }, [])

  const handleAcknowledgeEmergency = useCallback((icao24: string) => {
    setAckedEmerg((prev) => (prev[icao24] ? prev : { ...prev, [icao24]: Date.now() }))
  }, [])

  const airspace = getAirspace(airport.icao)
  const twrCeil = airspace.twr_ceil_ft.toLocaleString()
  const traconCeil = airspace.tracon_ceil_ft.toLocaleString()
  const zuluStr = formatZulu(zuluNow)
  const effectiveRwy = getEffectiveActiveRunwayEnds(
    airport.icao,
    runwaysByIcao[airport.icao] ?? [],
    metarData,
  )
  const activeRunways = {
    ends: [...effectiveRwy.ends].sort(),
    source: effectiveRwy.source,
  }
  const legendPalette = getAirspacePalette(radarTheme)
  const legendTheme = getRadarTheme(radarTheme)

  return (
    <>
      <div className="console-stage">
      <div ref={consoleRef} className="console noise" data-scope-theme={radarTheme}>
        <span className="screw screw-tl" />
        <span className="screw screw-tr" />
        <span className="screw screw-bl" />
        <span className="screw screw-br" />

        <TopBar
          icao={airport.icao}
          airportName={airport.name.toUpperCase()}
          aircraftCount={aircraftCount}
          zuluStr={zuluStr}
          onBack={() => navigate('/')}
        />

        <PositionHeader
          icao={airport.icao}
          altFilter={altFilter}
          elapsed={positionElapsed}
          sessionStats={{
            targetsTracked,
            emergSeen,
            emergAcked: Object.keys(ackedEmerg).length,
            positionTimes,
          }}
        />

        <div className="main-area">
          <StatusPanel
            airport={airport}
            metarData={metarData}
            sigmetData={sigmetData}
            airspaceClass={airspace.class}
            activeRunways={activeRunways}
            emergencyAircraft={emergencyAircraft}
            ackedEmerg={ackedEmerg}
            typeFilters={typeFilters}
            onTypeFilterClick={() => setTypeFilterOpen(true)}
            onAdvisoryClick={() => setAdvisoryOpen(true)}
            onEmergencyClick={() => setEmergencyOpen(true)}
          />

          <RadarBezel
            airport={airport}
            rangeNm={rangeNm}
            filter={trafficFilter}
            altFilter={altFilter}
            callsignFilter={callsignFilter}
            typeFilters={typeFilters}
            onAircraftCountChange={setAircraftCount}
            metarData={metarData}
            trailConfig={trailConfig}
            airspaceVisible={airspaceVisible}
            landmarksVisible={landmarksVisible}
            suaMoaVisible={suaMoaVisible}
            suaRestrictedVisible={suaRestrictedVisible}
            suaWarningVisible={suaWarningVisible}
            suaAlertVisible={suaAlertVisible}
            tfrVisible={tfrVisible}
            animationPreset={animationPreset}
            onResetView={registerResetView}
            onAircraftSelect={handleAircraftSelect}
            onEmergencyAircraftChange={handleEmergencyChange}
            onFlyToRef={registerFlyTo}
            radarTheme={radarTheme}
          />

          <RangePanel
            rangeNm={rangeNm}
            onRangeChange={setRangeNm}
            onConfigOpen={() => setConfigOpen(true)}
            onLegendOpen={() => setLegendOpen(true)}
            onResetView={handleResetView}
          />
        </div>

        <div className="bottom-strip">
          <DisplayFilters
            trafficFilter={trafficFilter}
            altFilter={altFilter}
            callsignFilter={callsignFilter}
            onTrafficChange={setTrafficFilter}
            onAltFilterChange={setAltFilter}
            onCallsignFilterChange={setCallsignFilter}
          />

          <LayersBar
            airspaceVisible={airspaceVisible}
            onAirspaceToggle={() => setAirspaceVisible((v) => !v)}
            landmarksVisible={landmarksVisible}
            onLandmarksToggle={() => setLandmarksVisible((v) => !v)}
            suaMoaVisible={suaMoaVisible}
            suaRestrictedVisible={suaRestrictedVisible}
            suaWarningVisible={suaWarningVisible}
            suaAlertVisible={suaAlertVisible}
            tfrVisible={tfrVisible}
            onSuaMoaToggle={() => setSuaMoaVisible((v) => !v)}
            onSuaRestrictedToggle={() => setSuaRestrictedVisible((v) => !v)}
            onSuaWarningToggle={() => setSuaWarningVisible((v) => !v)}
            onSuaAlertToggle={() => setSuaAlertVisible((v) => !v)}
            onTfrToggle={() => setTfrVisible((v) => !v)}
            animationPreset={animationPreset}
            onPresetChange={setAnimationPreset}
            radarTheme={radarTheme}
            onThemeChange={setRadarTheme}
          />

          <LiveAtcModule
            icao={airport.icao}
            airportName={airport.name}
            frequencies={airportFrequencies}
          />
        </div>
      </div>
    </div>

      {advisoryOpen &&
        sigmetData &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => {
              setAdvisoryOpen(false)
              setExpandedSigmet(null)
            }}
          >
            <div
              style={{
                width: 580,
                maxHeight: '75vh',
                background: 'linear-gradient(158deg, #1e2a29 0%, #141e1d 55%, #111918 100%)',
                border: '1px solid rgba(0,255,136,0.2)',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--mono)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #1a2824',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, letterSpacing: 5, color: 'var(--amber)' }}>
                  ADVISORIES
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAdvisoryOpen(false)
                    setExpandedSigmet(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dim)',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
                {sigmetData.sigmets.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: 4,
                        color: '#ff4444',
                        marginBottom: 8,
                        marginTop: 4,
                      }}
                    >
                      SIGMETS — {sigmetData.sigmets.length} ACTIVE
                    </div>
                    {sigmetData.sigmets.map((s, i) => (
                      <AdvisoryCard
                        key={i}
                        item={s}
                        color="#ff4444"
                        borderColor="rgba(255,60,60,0.35)"
                        expanded={expandedSigmet === i}
                        onToggle={() => setExpandedSigmet(expandedSigmet === i ? null : i)}
                      />
                    ))}
                  </>
                )}

                {sigmetData.airmets.length > 0 &&
                  (() => {
                    const hazardCounts = sigmetData.airmets.reduce<Record<string, number>>(
                      (acc, a) => {
                        const h = (a.hazard as string) ?? 'UNKNOWN'
                        acc[h] = (acc[h] ?? 0) + 1
                        return acc
                      },
                      {},
                    )

                    return (
                      <>
                        <div
                          style={{
                            fontSize: 9,
                            letterSpacing: 4,
                            color: 'var(--amber)',
                            marginBottom: 8,
                            marginTop: sigmetData.sigmets.length > 0 ? 16 : 4,
                          }}
                        >
                          G-AIRMETS ACTIVE
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.entries(hazardCounts).map(([hazard, count]) => (
                            <div
                              key={hazard}
                              style={{
                                padding: '5px 10px',
                                background: 'linear-gradient(#1a1200, #0f0c00)',
                                border: '1px solid rgba(255,170,0,0.3)',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--amber)',
                                  letterSpacing: 2,
                                }}
                              >
                                {hazard}
                              </span>
                              <span
                                style={{
                                  fontSize: 9,
                                  color: '#03150c',
                                  background: 'var(--amber)',
                                  borderRadius: 3,
                                  padding: '1px 5px',
                                  fontWeight: 700,
                                }}
                              >
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: 'var(--dim)',
                            letterSpacing: 1,
                            marginTop: 8,
                            lineHeight: 1.6,
                          }}
                        >
                          G-AIRMETs are graphical advisories covering moderate turbulence, icing,
                          IFR conditions, and mountain obscuration. Check aviationweather.gov for
                          full coverage areas.
                        </div>
                      </>
                    )
                  })()}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {emergencyOpen &&
        emergencyAircraft.length > 0 &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setEmergencyOpen(false)}
          >
            <div
              style={{
                width: 480,
                background: 'linear-gradient(158deg, #1e2a29 0%, #141e1d 55%, #111918 100%)',
                border: '1px solid rgba(255,60,60,0.4)',
                borderRadius: 8,
                overflow: 'hidden',
                fontFamily: 'var(--mono)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #2a1010',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, letterSpacing: 5, color: '#ff4444' }}>
                  EMERGENCY TRAFFIC
                </span>
                <button
                  type="button"
                  onClick={() => setEmergencyOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dim)',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '12px 16px' }}>
                {emergencyAircraft.map((ac) => {
                  const squawkLabel =
                    ac.squawk === '7500'
                      ? 'HIJACK'
                      : ac.squawk === '7600'
                        ? 'COMMS FAILURE'
                        : ac.squawk === '7700'
                          ? 'GENERAL EMERGENCY'
                          : ac.squawk
                  const ackTime = ackedEmerg[ac.icao24]
                  return (
                    <div
                      key={ac.icao24}
                      style={{
                        marginBottom: 10,
                        padding: '10px 14px',
                        background: ackTime
                          ? 'linear-gradient(#140808, #0c0404)'
                          : 'linear-gradient(#1a0808, #0f0404)',
                        border: `1px solid ${ackTime ? 'rgba(255,60,60,0.18)' : 'rgba(255,60,60,0.35)'}`,
                        borderRadius: 5,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 16, color: '#ff4444', letterSpacing: 3 }}>
                          {ac.callsign}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            background: '#ff4444',
                            color: '#000',
                            padding: '2px 8px',
                            borderRadius: 3,
                            letterSpacing: 2,
                            fontWeight: 700,
                          }}
                        >
                          {ac.squawk} · {squawkLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 2 }}>
                            ALTITUDE
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--green2)', letterSpacing: 1 }}>
                            {ac.altitude}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 2 }}>
                            SPEED
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--green2)', letterSpacing: 1 }}>
                            {ac.groundspeed}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleFlyToAircraft(ac.icao24)}
                          style={{
                            flex: 1,
                            padding: '5px',
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            letterSpacing: 3,
                            color: '#ff4444',
                            background: 'linear-gradient(#1a0808, #0f0404)',
                            border: '1px solid rgba(255,60,60,0.4)',
                            borderRadius: 3,
                            cursor: 'pointer',
                          }}
                        >
                          LOCATE ON SCOPE
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(ackTime)}
                          onClick={() => handleAcknowledgeEmergency(ac.icao24)}
                          className={ackTime ? undefined : 'pulse'}
                          style={{
                            flex: 1,
                            padding: '5px',
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            letterSpacing: 3,
                            color: ackTime ? 'var(--green2)' : '#000',
                            background: ackTime
                              ? 'linear-gradient(#0d1614, #0a100f)'
                              : '#ff4444',
                            border: ackTime
                              ? '1px solid rgba(0,255,136,0.25)'
                              : '1px solid rgba(255,60,60,0.8)',
                            borderRadius: 3,
                            cursor: ackTime ? 'default' : 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          {ackTime ? `ACK ${formatAckZulu(ackTime)}` : 'ACKNOWLEDGE'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {typeFilterOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setTypeFilterOpen(false)}
        >
          <div
            className="metal noise rounded-lg p-6 w-[420px]"
            style={{ fontFamily: 'var(--mono)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 15, letterSpacing: 5, color: 'var(--amber)' }}>
                TARGET TYPE FILTERS
              </span>
              <button
                type="button"
                onClick={() => setTypeFilterOpen(false)}
                style={{ color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--dim)', marginBottom: 14 }}>
              SELECT WHICH TARGET CLASSES DISPLAY ON THE SCOPE
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TARGET_CLASS_OPTIONS.map(({ id, label, hint }) => {
                const active = typeFilters[id]
                return (
                  <button
                    key={id}
                    type="button"
                    title={hint}
                    onClick={() =>
                      setTypeFilters((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                    className={`btn ${active ? 'active' : ''}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 34,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      margin: 0,
                      padding: '0 6px',
                      fontSize: 9,
                      letterSpacing: 2,
                      whiteSpace: 'nowrap',
                      opacity: active ? 1 : 0.45,
                    }}
                  >
                    {active ? '◉ ' : '○ '}{label}
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'var(--dim)', marginBottom: 10 }}>
                EMERGENCY TARGETS ALWAYS DISPLAY
              </div>
              <div className="flex justify-end" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ margin: 0, height: 26, padding: '0 10px', fontSize: 9, letterSpacing: 2, boxSizing: 'border-box' }}
                  onClick={() =>
                    setTypeFilters({
                      mil: false,
                      heavy: false,
                      airliner: false,
                      ga: false,
                      helo: false,
                      other: false,
                    })
                  }
                >
                  ALL OFF
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ margin: 0, height: 26, padding: '0 10px', fontSize: 9, letterSpacing: 2, boxSizing: 'border-box' }}
                  onClick={() => setTypeFilters(DEFAULT_TYPE_FILTERS)}
                >
                  ALL ON
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {configOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="metal noise rounded-lg p-6 w-[480px]"
            style={{ fontFamily: 'var(--mono)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontSize: 15, letterSpacing: 5, color: 'var(--amber)' }}>
                TRAIL CONFIG
              </span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                style={{ color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            {([
              { key: 'twr' as const, label: 'TOWER BAND', sub: `0 – ${twrCeil} ft`, color: COLOR_TWR },
              { key: 'app' as const, label: 'APPROACH BAND', sub: `${twrCeil} – ${traconCeil} ft`, color: COLOR_TRACON },
              { key: 'ctr' as const, label: 'CENTER BAND', sub: `${traconCeil} ft+`, color: COLOR_CTR },
              { key: 'gnd' as const, label: 'GROUND', sub: 'Surface traffic', color: COLOR_GND },
            ]).map(({ key, label, sub, color }) => (
              <div key={key} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, letterSpacing: 3, color: 'var(--green2)' }}>{label}</span>
                  <span style={{ fontSize: 9, color: 'var(--dim)', marginLeft: 4 }}>{sub}</span>
                </div>
                <div className="flex gap-6">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', marginBottom: 4 }}>
                      TRAIL LENGTH — {trailConfig[key].length} fixes ({trailConfig[key].length * 4} dots)
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={1}
                      value={trailConfig[key].length}
                      onChange={(e) =>
                        setTrailConfig((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], length: Number(e.target.value) },
                        }))
                      }
                      style={{ width: '100%', accentColor: color }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--dim)' }}>
                      <span>SHORT</span><span>LONG</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', marginBottom: 4 }}>
                      FADE — {Math.round(trailConfig[key].fade * 100)}%
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={0.9}
                      step={0.05}
                      value={trailConfig[key].fade}
                      onChange={(e) =>
                        setTrailConfig((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], fade: Number(e.target.value) },
                        }))
                      }
                      style={{ width: '100%', accentColor: color }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--dim)' }}>
                      <span>SUBTLE</span><span>BOLD</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setTrailConfig({
                twr: { length: 3, fade: 0.5 },
                app: { length: 3, fade: 0.5 },
                ctr: { length: 3, fade: 0.5 },
                gnd: { length: 2, fade: 0.3 },
              })}
              style={{
                width: '100%',
                padding: '6px',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: 3,
                color: 'var(--dim)',
                background: 'linear-gradient(#141a18, #0a0e0d)',
                border: '1px solid #1a2824',
                borderRadius: 4,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              RESET DEFAULTS
            </button>
          </div>
        </div>,
        document.body,
      )}

      {legendOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setLegendOpen(false)}
        >
          <div
            className="metal noise rounded-lg"
            style={{
              fontFamily: 'var(--mono)',
              width: 760,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: '82vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '18px 22px 14px',
                borderBottom: '1px solid #0f2a1a',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 15, letterSpacing: 5, color: 'var(--amber)' }}>
                LEGEND
              </span>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                style={{ color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                overflowY: 'auto',
                padding: '18px 22px 22px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                }}
              >
                <ScopeLegendSection title="AIRCRAFT TARGETS">
                  {[
                    {
                      color: legendTheme.aircraftColors.twr,
                      label: 'TOWER',
                      sub: 'Controlled traffic inside tower airspace and below tower ceiling',
                      shape: 'triangle' as const,
                    },
                    {
                      color: legendTheme.aircraftColors.tracon,
                      label: 'TRACON',
                      sub: 'Approach/departure traffic inside the terminal altitude band',
                      shape: 'triangle' as const,
                    },
                    {
                      color: legendTheme.aircraftColors.ctr,
                      label: 'CENTER',
                      sub: 'En route traffic above the TRACON ceiling',
                      shape: 'triangle' as const,
                    },
                    {
                      color: legendTheme.aircraftColors.ctrOutside,
                      label: 'TRANSIT',
                      sub: 'Center-altitude traffic outside local ARTCC ownership',
                      shape: 'triangle' as const,
                    },
                    {
                      color: legendTheme.aircraftColors.gnd,
                      label: 'GROUND',
                      sub: 'Surface movement or likely taxi/rollout traffic',
                      shape: 'square' as const,
                    },
                    {
                      color: legendTheme.aircraftColors.vfr,
                      label: 'VFR',
                      sub: 'Squawk 1200 traffic not counted as controlled IFR',
                      shape: 'dot' as const,
                    },
                    {
                      color: COLOR_EMERG,
                      label: 'EMERGENCY',
                      sub: 'Squawk 7500, 7600, or 7700',
                      shape: 'dot' as const,
                    },
                  ].map((item) => (
                    <ScopeLegendItem key={item.label} {...item} />
                  ))}
                </ScopeLegendSection>

                <ScopeLegendSection title="MAP LAYERS">
                  {[
                    {
                      color: legendPalette.tower.color,
                      label: 'TOWER AIRSPACE',
                      sub: 'Lavender polygon: tower lateral/vertical control volume',
                    },
                    {
                      color: legendPalette.tracon.color,
                      label: 'TRACON / CLASS B',
                      sub: 'Cyan polygon: terminal-area shelf or approach volume',
                    },
                    {
                      color: legendPalette.artccLow.color,
                      label: 'ARTCC LOW',
                      sub: 'Violet boundary: lower en route sectoring',
                    },
                    {
                      color: legendPalette.artccHigh.color,
                      label: 'ARTCC HIGH',
                      sub: 'Dim violet boundary: high-altitude sectoring',
                    },
                    {
                      color: 'var(--green)',
                      label: 'RANGE RINGS',
                      sub: 'Fixed 5, 10, 20, 40, and 80 NM reference rings',
                      shape: 'ring' as const,
                    },
                  ].map((item) => (
                    <ScopeLegendItem key={item.label} shape="polygon" {...item} />
                  ))}
                </ScopeLegendSection>

                <ScopeLegendSection title="SPECIAL USE AIRSPACE">
                  {[
                    {
                      color: legendPalette.sua.MOA.color,
                      label: 'MOA',
                      sub: 'Military operations area',
                    },
                    {
                      color: legendPalette.sua.RESTRICTED.color,
                      label: 'RESTRICTED',
                      sub: 'Flight restricted without authorization',
                    },
                    {
                      color: legendPalette.sua.WARNING.color,
                      label: 'WARNING',
                      sub: 'Offshore caution airspace, usually high activity',
                    },
                    {
                      color: legendPalette.sua.ALERT.color,
                      label: 'ALERT',
                      sub: 'High volume training or unusual aerial activity',
                    },
                  ].map((item) => (
                    <ScopeLegendItem key={item.label} shape="polygon" {...item} />
                  ))}
                </ScopeLegendSection>

                <ScopeLegendSection title="TEMPORARY FLIGHT RESTRICTIONS">
                  {[
                    {
                      color: getTfrColor('VIP', legendPalette.tfr.colors),
                      label: 'TFR VIP',
                      sub: 'Presidential or VIP movement restriction',
                    },
                    {
                      color: getTfrColor('SECURITY', legendPalette.tfr.colors),
                      label: 'TFR SECURITY',
                      sub: 'Security restriction around an event or area',
                    },
                    {
                      color: getTfrColor('SPACE', legendPalette.tfr.colors),
                      label: 'TFR SPACE',
                      sub: 'Launch, recovery, or space operation',
                    },
                    {
                      color: getTfrColor('HAZARD', legendPalette.tfr.colors),
                      label: 'TFR HAZARD',
                      sub: 'Hazard, disaster, fire, or rescue activity',
                    },
                    {
                      color: getTfrColor('AIR SHOW', legendPalette.tfr.colors),
                      label: 'TFR AIRSHOW',
                      sub: 'Airshow, sporting, or public event restriction',
                    },
                  ].map((item) => (
                    <ScopeLegendItem key={item.label} shape="polygon" {...item} />
                  ))}
                </ScopeLegendSection>
              </div>

              <div style={{ borderTop: '1px solid #0f2a1a', margin: '20px 0 16px' }} />

              <ScopeLegendSection title="DISPLAY FILTERS">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  {[
                    { label: 'TWR', sub: `Surface to ${twrCeil} ft MSL` },
                    { label: 'TRACON', sub: `Surface to ${traconCeil} ft MSL` },
                    { label: 'CTR', sub: `Above ${traconCeil} ft MSL` },
                    { label: 'ALL', sub: 'All altitude bands' },
                  ].map(({ label, sub }) => (
                    <div
                      key={label}
                      style={{
                        border: '1px solid #153528',
                        borderRadius: 5,
                        padding: '8px 10px',
                        background: 'rgba(0,255,136,0.035)',
                      }}
                    >
                      <div style={{ color: 'var(--amber)', fontSize: 11, letterSpacing: 2 }}>
                        {label}
                      </div>
                      <div style={{ color: 'var(--dim)', fontSize: 9, letterSpacing: 0.8, lineHeight: 1.35, marginTop: 4 }}>
                        {sub}
                      </div>
                    </div>
                  ))}
                </div>
              </ScopeLegendSection>

              <div style={{ borderTop: '1px solid #0f2a1a', margin: '18px 0 0', paddingTop: 12 }}>
                <div style={{ fontSize: 9, color: 'var(--dim)', lineHeight: 1.6, letterSpacing: 1 }}>
                  Aircraft count excludes VFR squawk 1200 traffic regardless of filter. In TWR
                  mode, the count reflects controlled targets inside the tower lateral boundary.
                  TFR and SUA colors describe map overlays; LAYERS controls whether those overlays display.
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export function Scope() {
  const { icao: icaoParam } = useParams<{ icao: string }>()
  const airport = useMemo(
    () =>
      icaoParam
        ? airports.find((entry) => entry.icao === icaoParam.toUpperCase())
        : undefined,
    [icaoParam],
  )

  if (!airport) {
    return <Navigate to="/" replace />
  }

  return <ScopeConsole key={airport.icao} airport={airport} />
}
