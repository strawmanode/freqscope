import type { RichAircraftState } from '../../../types/aircraft'
import { TIMESHARE_SLOT_MS } from '../constants'

export function formatGroundspeedKnots(speedKts: number | null): string {
  if (speedKts == null) return '--'
  return String(Math.round(speedKts))
}

export function formatAltitudeDisplay(altitudeFt: number | null): string {
  if (altitudeFt == null) return '---'
  const altHundreds = Math.round(altitudeFt / 100)
  return altitudeFt >= 18000
    ? `F${altHundreds}`
    : String(altHundreds).padStart(3, '0')
}

export function verticalTrend(verticalRateFpm: number | null): string {
  if (verticalRateFpm == null) return ''
  if (verticalRateFpm > 100) return '↑'
  if (verticalRateFpm < -100) return '↓'
  return ''
}

export function formatDataLine2(state: RichAircraftState): string {
  const speed = formatGroundspeedKnots(state.speedKts)
  if (state.onGround) return `${speed}  GND`
  const alt = formatAltitudeDisplay(state.altitudeFt)
  return `${speed}  ${alt}${verticalTrend(state.verticalRateFpm)}`
}

export function formatDataLine3(state: RichAircraftState): string {
  const type = state.aircraftType ?? ''
  const sq = state.squawk && state.squawk !== '0000' ? state.squawk : ''
  if (!type && !sq) return ''
  if (type && sq) return `${type}  ${sq}`
  return type || sq
}

export function emergencyAlertCode(state: RichAircraftState): string | null {
  const sq = String(state.squawk ?? '')
  if (sq === '7500') return 'HJ'
  if (sq === '7600') return 'RF'
  if (sq === '7700') return 'EM'
  if (state.emergency && state.emergency !== 'none') return 'EM'
  return null
}

export type TimesharePhase = 'main' | 'alt'

export function timesharePhase(nowMs: number): TimesharePhase {
  return Math.floor(nowMs / TIMESHARE_SLOT_MS) % 3 === 2 ? 'alt' : 'main'
}

/** Two-line STARS-style datablock (plus a red alert line for emergencies). */
export function buildDatablockText(
  state: RichAircraftState,
  phase: TimesharePhase,
): string {
  const callsign = (state.callsign ?? '').trim() || '—'
  const altLine = formatDataLine3(state)
  const dataLine = phase === 'alt' && altLine ? altLine : formatDataLine2(state)
  const alert = emergencyAlertCode(state)
  return alert ? `${alert}\n${callsign}\n${dataLine}` : `${callsign}\n${dataLine}`
}
