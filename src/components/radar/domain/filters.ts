import type { Airport, Runway } from '../../../types'
import type { RichAircraftState } from '../../../types/aircraft'
import { getAirspace, getGroundRadiusNm } from '../../../lib/airspace'
import { isOnOrNearActiveRunway } from '../../../lib/flightPhase'
import { haversineNm } from '../../../lib/geo'
import { classifyTarget, type TypeFilterState } from '../../../lib/targetClass'
import type { AircraftFilter, AltFilter, CallsignFilter } from '../types'
import { emergencyAlertCode } from './datablock'

export function matchesFilter(onGround: boolean, filter: AircraftFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'AIR') return !onGround
  return onGround
}

/** Traffic filter with tower runway ownership:
 *  - TWR + AIR includes airborne targets plus runway-occupancy ground targets.
 *  - TWR + GND shows the full airport surface picture.
 *  - ALL combines both.
 */
export function matchesTrafficFilter(
  s: RichAircraftState,
  filter: AircraftFilter,
  altFilter: AltFilter,
  runways: Runway[],
  activeRunwayEnds = new Set<string>(),
): boolean {
  if (filter === 'ALL') return true
  if (!s.onGround) return filter === 'AIR'

  if (altFilter === 'TWR') {
    const onOrNearActiveRunway = isOnOrNearActiveRunway(
      s.lat,
      s.lon,
      runways,
      activeRunwayEnds,
    )
    if (filter === 'AIR') return onOrNearActiveRunway
    return filter === 'GND'
  }

  return filter === 'GND'
}

export function hasCallsign(state: RichAircraftState): boolean {
  return Boolean((state.callsign ?? '').trim())
}

export function matchesCallsignFilter(
  state: RichAircraftState,
  filter: CallsignFilter,
): boolean {
  if (state.onGround) return true
  if (filter === 'ALL') return true
  return hasCallsign(state)
}

/** Target-type filter. Emergency targets always display; never hide a 7700. */
export function matchesTypeFilter(
  state: RichAircraftState,
  typeFilters: TypeFilterState,
): boolean {
  if (emergencyAlertCode(state)) return true
  if (state.onGround) return true
  return typeFilters[classifyTarget(state)]
}

export function matchesAltFilter(
  state: RichAircraftState,
  icao: string,
  altFilter: AltFilter,
  elevationFt: number,
  airport: Airport,
): boolean {
  if (state.onGround) {
    // Ground traffic: only show when TWR or ALL is selected.
    // Approach and Center don't work ground traffic.
    if (altFilter !== 'TWR' && altFilter !== 'ALL') return false
    const distNm = haversineNm(airport.lat, airport.lon, state.lat, state.lon)
    return distNm <= getGroundRadiusNm(icao)
  }
  if (altFilter === 'ALL') return true
  if (altFilter === 'TWR') {
    // TWR filter = inside tower cylinder (lateral + altitude).
    const airspace = getAirspace(icao)
    const lat = state.lat
    const lon = state.lon
    const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
    const altAglFt = Math.max(0, state.altitudeFt - elevationFt)
    return distNm <= airspace.twr_radius_nm && altAglFt <= airspace.twr_ceil_ft
  }
  if (altFilter === 'TRACON') {
    const airspace = getAirspace(icao)
    const lat = state.lat
    const lon = state.lon
    const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
    const altAglFt = Math.max(0, state.altitudeFt - elevationFt)
    return distNm <= airspace.tracon_radius_nm && altAglFt <= airspace.tracon_ceil_ft
  }
  if (altFilter === 'CTR') {
    const airspace = getAirspace(icao)
    const altAglFt = Math.max(0, state.altitudeFt - elevationFt)
    return altAglFt > airspace.tracon_ceil_ft
  }
  return true
}

export function isWithinTowerRadius(
  state: RichAircraftState,
  airport: Airport,
): boolean {
  const lat = state.lat
  const lon = state.lon
  const airspace = getAirspace(airport.icao)
  const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
  return distNm <= airspace.twr_radius_nm
}

export function dedupeStatesByIcao(states: RichAircraftState[]): RichAircraftState[] {
  const byIcao = new Map<string, RichAircraftState>()
  for (const s of states) {
    byIcao.set(s.icao24, s)
  }
  return [...byIcao.values()]
}
