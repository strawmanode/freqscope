import type { AirspaceConfig, ArtccStratum } from './airspace'
import type { Airport } from '../types'
import type { RichAircraftState } from '../types/aircraft'

// Canonical (un-themed) aircraft colors. These act as sentinel values that
// themedAirspaceColor() in RadarMap maps to per-theme shades. All values are
// SOLID — semi-transparent targets blended with whatever polygon fill sat
// underneath them, destroying category identity.
export const COLOR_TWR = '#ffd700'
export const COLOR_TRACON = '#00cfff'
export const COLOR_CTR = '#ffffff'
export const COLOR_CTR_OUTSIDE = '#a8bdb2'
export const COLOR_GND = '#666666'
export const COLOR_VFR = '#3fc97e'
export const COLOR_EMERG = '#ff3333'

// SUA polygon colors — kept in sync with the dark palette in
// airspacePalette.ts (the source of truth for theme-aware polygon styling).
export const COLOR_MOA = '#ff47c8'
export const COLOR_RESTRICTED = '#3d6bff'
export const COLOR_WARNING = '#ff9d2e'
export const COLOR_ALERT = '#ff5c47'

export const AIRSPACE_LEGEND = [
  { label: 'TWR', color: COLOR_TWR },
  { label: 'TRACON', color: COLOR_TRACON },
  { label: 'CTR', color: COLOR_CTR },
  { label: 'GND', color: COLOR_GND },
  { label: 'VFR', color: COLOR_VFR },
] as const

export const SUA_LEGEND = [
  { label: 'MOA', color: COLOR_MOA, key: 'moa' },
  { label: 'RESTR', color: COLOR_RESTRICTED, key: 'restricted' },
  { label: 'WARN', color: COLOR_WARNING, key: 'warning' },
  { label: 'ALERT', color: COLOR_ALERT, key: 'alert' },
] as const

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isEmergencySquawk(squawk: string | null): boolean {
  return squawk === '7500' || squawk === '7600' || squawk === '7700'
}

function isVfrSquawk(squawk: string | null, altitudeFt: number | null): boolean {
  if (squawk == null) {
    if ((altitudeFt ?? 0) >= 18000) return false
    return true
  }
  if (squawk === '') return true
  if (squawk === '0000') return true
  const code = parseInt(squawk, 10)
  if (!isNaN(code) && code >= 1200 && code <= 1299) return true
  return false
}

function pointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i]
    const [latJ, lonJ] = polygon[j]
    if ((latI > lat) !== (latJ > lat) && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      inside = !inside
    }
  }
  return inside
}

function colorCtr(
  lat: number | null,
  lon: number | null,
  artccStrata?: ArtccStratum[],
): string {
  if (artccStrata) {
    const lowStratum = artccStrata.find((s) => s.stratum === 'LOW')
    if (lowStratum && lat != null && lon != null) {
      if (!pointInPolygon(lat, lon, lowStratum.boundary)) {
        return COLOR_CTR_OUTSIDE
      }
    }
  }
  return COLOR_CTR
}

export function airspaceColor(
  state: RichAircraftState,
  airport: Airport,
  config: AirspaceConfig,
  artccStrata?: ArtccStratum[],
  /**
   * Treat the target as on the ground regardless of the feed's air/ground bit.
   * Used so a target the dead-reckoning landing model has put on the runway is
   * colored GND immediately, instead of staying tower/approach-colored until
   * the feed catches up.
   */
  onGroundOverride?: boolean,
): string {
  const squawk = state.squawk
  if (isEmergencySquawk(squawk)) return COLOR_EMERG
  if ((onGroundOverride ?? state.onGround) === true) return COLOR_GND

  const lat = state.lat
  const lon = state.lon
  if (lat != null && lon != null) {
    const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
    const aglFt = Math.max(0, state.altitudeFt - airport.elevation_ft)
    const inTowerLateral = config.tower_boundary
      ? pointInPolygon(lat, lon, config.tower_boundary)
      : distNm <= config.twr_radius_nm

    if (inTowerLateral && aglFt <= config.twr_ceil_ft) return COLOR_TWR
    if (isVfrSquawk(squawk, state.altitudeFt)) return COLOR_VFR
    if (distNm <= config.tracon_radius_nm && aglFt <= config.tracon_ceil_ft) return COLOR_TRACON
    return colorCtr(lat, lon, artccStrata)
  }

  if (isVfrSquawk(squawk, state.altitudeFt)) return COLOR_VFR
  return colorCtr(null, null, artccStrata)
}

export function isVfrTarget(state: RichAircraftState, airport: Airport, config: AirspaceConfig): boolean {
  if (state.onGround) return false
  if (isEmergencySquawk(state.squawk)) return false
  const lat = state.lat
  const lon = state.lon
  if (lat != null && lon != null) {
    const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
    const aglFt = Math.max(0, state.altitudeFt - airport.elevation_ft)
    const inTowerLateral = config.tower_boundary
      ? pointInPolygon(lat, lon, config.tower_boundary)
      : distNm <= config.twr_radius_nm

    if (inTowerLateral && aglFt <= config.twr_ceil_ft) return false
  }
  return isVfrSquawk(state.squawk, state.altitudeFt)
}
