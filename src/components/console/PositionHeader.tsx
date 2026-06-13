import { useEffect, useRef, useState } from 'react'
import { getFacilityName } from '../../lib/facilityNames'
import type { AltFilter } from '../radar/types'
import type { SessionStats } from './StatusPanel'

const POSITION_BRIEFINGS: Record<AltFilter, string> = {
  TWR: 'LOCAL CONTROL — WATCH SHORT FINAL, RUNWAY OCCUPANCY, DEPARTURE ROLLS',
  TRACON: 'APPROACH CONTROL — WATCH ARRIVAL MERGES, DOWNWIND SEQUENCES, DEPARTURE CLIMBS',
  CTR: 'EN ROUTE CONTROL — WATCH CROSSING FLOWS, OVERFLIGHTS, HANDOFF ALTITUDES',
  ALL: 'FULL SPECTRUM — ALL ALTITUDE BANDS DISPLAYED, NO POSITION FILTER',
}

const POSITION_LABELS: Record<AltFilter, string> = {
  TWR: 'TWR',
  TRACON: 'APP',
  CTR: 'CTR',
  ALL: 'ALL',
}

const POSITION_TIME_ROWS: { key: AltFilter; label: string }[] = [
  { key: 'TWR', label: 'TWR' },
  { key: 'TRACON', label: 'APP' },
  { key: 'CTR', label: 'CTR' },
]

function formatPosTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface PositionHeaderProps {
  icao: string
  altFilter: AltFilter
  elapsed: string
  sessionStats: SessionStats
  /** Toolbar items (dropdown buttons) rendered before the SESSION button */
  children?: React.ReactNode
}

export function PositionHeader({
  icao,
  altFilter,
  elapsed,
  sessionStats,
  children,
}: PositionHeaderProps) {
  const facility = getFacilityName(icao, altFilter)
  const [sessionOpen, setSessionOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close the drawer on any click outside it or on Escape
  useEffect(() => {
    if (!sessionOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSessionOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSessionOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sessionOpen])

  return (
    <div ref={containerRef} style={{ flex: '0 0 30px', position: 'relative', zIndex: 3000 }}>
      <div
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 16px',
          background: 'var(--position-bar-bg)',
          border: '1px solid var(--position-bar-border)',
          borderRadius: 5,
          fontFamily: 'var(--mono)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--position-dot-color)',
            boxShadow: 'var(--position-dot-shadow)',
            animation: 'pulse-dot 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            letterSpacing: 4,
            color: 'var(--position-label-color)',
            flexShrink: 0,
          }}
        >
          ON POSITION
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: 2,
            color: 'var(--position-badge-text)',
            background: 'var(--position-badge-bg)',
            borderRadius: 3,
            padding: '1px 7px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {POSITION_LABELS[altFilter]}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 3,
            color: 'var(--position-facility-color)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 0,
          }}
        >
          {facility}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 9,
            letterSpacing: 2,
            color: 'var(--position-muted-color)',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {POSITION_BRIEFINGS[altFilter]}
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: 2,
            color: 'var(--position-muted-color)',
            flexShrink: 0,
          }}
        >
          TIME ON POS
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: 'var(--position-time-color)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {elapsed}
        </span>
        {children}
        <button
          type="button"
          onClick={() => setSessionOpen((v) => !v)}
          aria-expanded={sessionOpen}
          title="Session statistics"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: 2,
            color: sessionOpen
              ? 'var(--position-toolbar-active-text)'
              : 'var(--position-muted-color)',
            background: sessionOpen ? 'var(--position-toolbar-active-bg)' : 'transparent',
            border: '1px solid var(--position-bar-border)',
            borderRadius: 3,
            padding: '2px 8px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          SESSION {sessionOpen ? '▴' : '▾'}
        </button>
      </div>

      {sessionOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: 224,
            padding: '8px 10px 10px',
            background: 'var(--position-bar-bg)',
            border: '1px solid var(--position-bar-border)',
            borderRadius: 5,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)',
            fontFamily: 'var(--mono)',
          }}
        >
          <div className="section-title">SESSION</div>
          <div className="status-row">
            <span className="k">TRACKED</span>
            <span className="v">{sessionStats.targetsTracked}</span>
          </div>
          <div className="status-row">
            <span className="k">EMERG ACK</span>
            <span
              className="v"
              style={sessionStats.emergSeen > 0 ? { color: '#ff4444' } : undefined}
            >
              {sessionStats.emergAcked}/{sessionStats.emergSeen}
            </span>
          </div>
          {POSITION_TIME_ROWS.filter(
            ({ key }) => sessionStats.positionTimes[key] >= 1000,
          ).map(({ key, label }) => (
            <div className="status-row" key={key}>
              <span className="k">{label}</span>
              <span className="v">{formatPosTime(sessionStats.positionTimes[key])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
