import type { Airport } from '../../types'
import type { AltFilter, SelectedAircraft } from '../radar/types'
import { countDisabledTypeFilters, type TypeFilterState } from '../../lib/targetClass'

interface MetarCloud {
  cover?: string
  base?: number
}

export interface MetarData {
  obsTime?: number
  wdir?: number | string
  wspd?: number
  visib?: number | string
  cover?: string
  clouds?: MetarCloud[]
  temp?: number
  dewp?: number
  altim?: number
}

export interface Advisory {
  hazard?: string
  validTimeFrom?: string
  validTimeTo?: string
  rawAirSigmet?: string
  airSigmetType?: string
  severity?: string
  [key: string]: unknown
}

export interface SigmetData {
  sigmets: Advisory[]
  airmets: Advisory[]
}

export interface SessionStats {
  targetsTracked: number
  emergSeen: number
  emergAcked: number
  positionTimes: Record<AltFilter, number>
}

export interface ActiveRunways {
  ends: string[]
  source: 'traffic' | 'wind' | null
}

interface StatusPanelProps {
  airport: Airport
  metarData: MetarData | null
  airspaceClass: string
  activeRunways: ActiveRunways
  sigmetData: SigmetData | null
  emergencyAircraft: SelectedAircraft[]
  ackedEmerg: Record<string, number>
  typeFilters: TypeFilterState
  onTypeFilterClick: () => void
  onAdvisoryClick: () => void
  onEmergencyClick: () => void
}

function formatStatusTime(metar: MetarData | null): string {
  if (metar?.obsTime == null) return '---'
  const d = new Date(metar.obsTime * 1000)
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m} Z`
}

function formatStatusWind(metar: MetarData | null): string {
  if (metar?.wspd == null || metar.wdir == null) return '---'
  const wspd = String(Math.round(metar.wspd)).padStart(2, '0')
  if (metar.wdir === 'VRB') return `VRB/${wspd}KT`
  const wdir = String(metar.wdir).padStart(3, '0')
  return `${wdir}/${wspd}KT`
}

function formatStatusVis(metar: MetarData | null): string {
  if (metar?.visib == null) return '---'
  return `${metar.visib} SM`
}

function formatStatusSky(metar: MetarData | null): string {
  if (!metar?.cover) return '---'
  if (metar.cover === 'CLR' || metar.cover === 'SKC') return 'CLR'
  const base = metar.clouds?.[0]?.base
  if (base == null) return '---'
  const alt = Math.round(base / 100)
    .toString()
    .padStart(3, '0')
  return `${metar.cover}${alt}`
}

function formatStatusTempDew(metar: MetarData | null): string {
  if (metar?.temp == null || metar?.dewp == null) return '---'
  const temp = Math.round(metar.temp)
  const dewp = Math.round(metar.dewp).toString().padStart(2, '0')
  return `${temp}/${dewp}`
}

function formatStatusAltim(metar: MetarData | null): string {
  if (metar?.altim == null) return '---'
  return `A${(metar.altim / 33.8639).toFixed(2)}`
}

export function StatusPanel({
  airport,
  metarData,
  airspaceClass,
  activeRunways,
  sigmetData,
  emergencyAircraft,
  ackedEmerg,
  typeFilters,
  onTypeFilterClick,
  onAdvisoryClick,
  onEmergencyClick,
}: StatusPanelProps) {
  const disabledTypeCount = countDisabledTypeFilters(typeFilters)
  const hasSigmet = (sigmetData?.sigmets?.length ?? 0) > 0
  const hasAirmet = (sigmetData?.airmets?.length ?? 0) > 0
  const advisoryState = hasSigmet ? 'sigmet' : hasAirmet ? 'airmet' : 'none'
  const hasAdvisories = advisoryState !== 'none'
  const unackedEmerg = emergencyAircraft.filter((ac) => !ackedEmerg[ac.icao24]).length

  return (
    <aside className="side-panel metal noise">
      <div className="inset grow">
        <div className="section-title">METAR</div>
        <div className="status-row">
          <span className="k">TIME</span>
          <span className="v">{formatStatusTime(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">WIND</span>
          <span className="v">{formatStatusWind(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">VIS</span>
          <span className="v">{formatStatusVis(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">SKY</span>
          <span className="v">{formatStatusSky(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">TEMP/DEW</span>
          <span className="v">{formatStatusTempDew(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">ALT SET</span>
          <span className="v">{formatStatusAltim(metarData)}</span>
        </div>
        <div className="status-row">
          <span className="k">ELEV</span>
          <span className="v">{airport.elevation_ft} FT</span>
        </div>
        <div className="status-row">
          <span className="k">CLASS</span>
          <span className="v">{airspaceClass}</span>
        </div>
        <div className="status-row">
          <span className="k">ACT RWY</span>
          <span
            className="v"
            style={{
              fontSize: 9,
              color: activeRunways.source === 'traffic' ? 'var(--green)' : undefined,
            }}
            title={
              activeRunways.source === 'traffic'
                ? 'Detected from observed traffic flow'
                : activeRunways.source === 'wind'
                  ? 'Estimated from METAR wind (no traffic observed yet)'
                  : 'Unknown — calm wind, no traffic observed'
            }
          >
            {activeRunways.ends.length > 0 ? activeRunways.ends.join(' ') : '---'}
          </span>
        </div>
      </div>
      <div className="inset">
        <div className="section-title">TARGETS</div>
        <button
          type="button"
          onClick={onTypeFilterClick}
          title="Show or hide target classes (military, heavy, GA…)"
          style={{
            width: '100%',
            padding: '6px 4px',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: 2,
            borderRadius: 4,
            cursor: 'pointer',
            textAlign: 'center',
            background: 'transparent',
            border: '1px solid var(--position-bar-border)',
            color:
              disabledTypeCount > 0 ? 'var(--amber)' : 'var(--position-muted-color)',
          }}
        >
          {disabledTypeCount > 0 ? `TYPE FILTERS · ${disabledTypeCount} OFF` : 'TYPE FILTERS'}
        </button>
      </div>
      <div className="inset">
        <div className="section-title">ALERTS</div>
        {emergencyAircraft.length > 0 && (
          <button
            type="button"
            className={unackedEmerg > 0 ? 'pulse' : undefined}
            onClick={onEmergencyClick}
            style={{
              width: '100%',
              padding: '6px 4px',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: 'pointer',
              textAlign: 'center',
              marginBottom: 6,
              border:
                unackedEmerg > 0
                  ? '1px solid rgba(255,60,60,0.6)'
                  : '1px solid rgba(255,60,60,0.3)',
              background:
                unackedEmerg > 0
                  ? 'linear-gradient(#2a0808, #1a0404)'
                  : 'linear-gradient(#180808, #100404)',
              color: unackedEmerg > 0 ? '#ff4444' : 'rgba(255,68,68,0.7)',
              boxShadow: unackedEmerg > 0 ? '0 0 14px rgba(255,60,60,0.4)' : 'none',
            }}
          >
            {unackedEmerg > 0
              ? `${unackedEmerg} EMERGENCY`
              : `${emergencyAircraft.length} EMERG · ACK`}
          </button>
        )}
        <button
          type="button"
          className={advisoryState === 'sigmet' ? 'pulse' : ''}
          disabled={!hasAdvisories}
          onClick={() => hasAdvisories && onAdvisoryClick()}
          style={{
            width: '100%',
            padding: '6px 4px',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: 2,
            borderRadius: 4,
            cursor: hasAdvisories ? 'pointer' : 'default',
            textAlign: 'center',
            border:
              advisoryState === 'sigmet'
                ? '1px solid rgba(255,60,60,0.6)'
                : advisoryState === 'airmet'
                  ? '1px solid rgba(255,170,0,0.5)'
                  : '1px solid #1a2824',
            background:
              advisoryState === 'sigmet'
                ? 'linear-gradient(#2a0a0a, #1a0505)'
                : advisoryState === 'airmet'
                  ? 'linear-gradient(#2a1a00, #1a1000)'
                  : 'linear-gradient(#141a18, #0a0e0d)',
            color:
              advisoryState === 'sigmet'
                ? '#ff4444'
                : advisoryState === 'airmet'
                  ? 'var(--amber)'
                  : 'var(--dim)',
            boxShadow:
              advisoryState === 'sigmet'
                ? '0 0 12px rgba(255,60,60,0.35)'
                : advisoryState === 'airmet'
                  ? '0 0 10px rgba(255,170,0,0.25)'
                  : 'none',
          }}
        >
          {advisoryState === 'sigmet'
            ? `${sigmetData!.sigmets.length} SIGMET`
            : advisoryState === 'airmet'
              ? `${sigmetData!.airmets.length} AIRMET`
              : 'NO ADVISORIES'}
        </button>
      </div>
    </aside>
  )
}
