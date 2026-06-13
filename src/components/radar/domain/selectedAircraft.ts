import type { Airport } from '../../../types'
import type { EnrichedAircraft, RichAircraftState } from '../../../types/aircraft'
import { haversineNm } from '../../../lib/geo'
import type { SelectedAircraft } from '../types'
import { verticalTrend } from './datablock'

export function formatLastSeenAge(lastSeenSec: number): string {
  const age = Math.max(0, Math.floor(Date.now() / 1000) - lastSeenSec)
  if (age < 5) return 'LIVE'
  if (age < 60) return `${age}s ago`
  return `${Math.floor(age / 60)}m ago`
}

export function formatHeading(trackDeg: number | null): string {
  if (trackDeg == null) return '---'
  return `${Math.round(trackDeg).toString().padStart(3, '0')}°`
}

export function toSelectedAircraft(
  state: RichAircraftState,
  enriched: EnrichedAircraft | undefined,
  airport: Airport,
): SelectedAircraft {
  const phase =
    enriched?.icao24 === state.icao24 ? enriched.phase : null
  const distNm = haversineNm(airport.lat, airport.lon, state.lat, state.lon)
  const aglFt = Math.max(0, Math.round(state.altitudeFt - airport.elevation_ft))

  return {
    icao24: state.icao24,
    callsign: state.callsign?.trim() || '—',
    altitude: state.onGround ? 'GND' : `${state.altitudeFt.toLocaleString()} ft`,
    altitudeAgl: state.onGround ? 'GND' : `${aglFt.toLocaleString()} ft`,
    groundspeed: state.speedKts != null ? `${Math.round(state.speedKts)} kt` : '--',
    verticalRate:
      state.verticalRateFpm != null
        ? `${state.verticalRateFpm > 0 ? '+' : ''}${Math.round(state.verticalRateFpm)} fpm`
        : '--',
    heading: formatHeading(state.trackDeg),
    distanceNm: `${distNm.toFixed(1)} NM`,
    squawk: state.squawk ?? '----',
    trend: verticalTrend(state.verticalRateFpm) || '—',
    aircraftType: state.aircraftType,
    registration: state.registration,
    phase,
    isMilitary: state.isMilitary,
    category: state.category,
    emergency: state.emergency,
    onGround: state.onGround,
    position: `${state.lat.toFixed(4)}°  ${state.lon.toFixed(4)}°`,
    lastSeen: formatLastSeenAge(state.lastSeen),
    hex: state.icao24.toUpperCase(),
  }
}
