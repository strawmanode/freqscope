import { useMemo } from 'react'
import { getDataFreshness, type DataFreshnessStatus } from '../lib/dataFreshness'

const STATUS_STYLES: Record<DataFreshnessStatus, { dot: string; text: string }> = {
  current: { dot: 'bg-emerald-400', text: 'text-muted' },
  aging: { dot: 'bg-amber-400', text: 'text-amber-300' },
  stale: { dot: 'bg-red-500', text: 'text-red-300' },
  unknown: { dot: 'bg-white/30', text: 'text-muted' },
}

const STATUS_NOTE: Record<DataFreshnessStatus, string> = {
  current: '',
  aging: ' · AGING',
  stale: ' · UPDATE LIKELY AVAILABLE',
  unknown: '',
}

function formatDate(d: Date): string {
  return d
    .toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

/**
 * Unobtrusive indicator of how current the bundled reference data is. Live data
 * (aircraft, TFRs, weather) is always real-time and is not reflected here.
 */
export function DataFreshnessBadge({ className = '' }: { className?: string }) {
  const fresh = useMemo(() => getDataFreshness(), [])
  const style = STATUS_STYLES[fresh.status]

  const label = fresh.generatedAt
    ? `REFERENCE DATA · ${formatDate(fresh.generatedAt)}`
    : 'REFERENCE DATA · DATE UNKNOWN'

  const title = [
    'Airports, frequencies, runways, and airspace ship with the app and follow the FAA 28-day cycle.',
    fresh.ageDays != null ? `This build's reference data is ${fresh.ageDays} day(s) old.` : '',
    'Live data — aircraft, TFRs, and weather — is always fetched in real time.',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <span
      className={`inline-flex items-center gap-2 text-[10px] tracking-widest uppercase ${style.text} ${className}`}
      title={title}
      style={{ fontFamily: 'var(--mono)' }}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
      {STATUS_NOTE[fresh.status]}
    </span>
  )
}
