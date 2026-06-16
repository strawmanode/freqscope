import airspaceData from '../data/airspace.json'
import artccData from '../data/artcc.json'

export interface PhaseThresholds {
  cruise_alt_ft: number
  cruise_level_fpm: number
  departing_radius_nm: number
  departing_climb_fpm: number
  departing_max_agl_ft: number
  departing_min_kts: number
  tower_descent_fpm: number
  tracon_descent_fpm: number
  climbout_climb_fpm: number
  arrival_radius_nm: number
  /** Max distance from threshold along extended inbound centerline (tower path B). */
  final_radius_nm: number
  /** Max cross-track distance from inbound centerline (nm). */
  final_lateral_nm: number
  /** Max heading deviation from landing course; 0 disables check. */
  final_heading_tolerance_deg: number
}

export interface ClassBTier {
  floor_ft: number
  ceiling_ft: number
  floor_ref: string
  boundary: number[][]
}

export interface ArtccStratum {
  stratum: string
  floor_ft: number
  floor_ref: string
  ceiling_ft: number
  boundary: number[][]
}

export interface ArtccConfig {
  [identifier: string]: ArtccStratum[]
}

export interface AirspaceConfig {
  class: string
  twr_ceil_ft: number
  twr_radius_nm: number
  tracon_ceil_ft: number
  tracon_radius_nm: number
  /** Airport surface/movement-area radius used for GND filtering. */
  ground_radius_nm?: number
  phase?: Partial<PhaseThresholds>
  /** [lat, lon] pairs from FAA Class B SFC polygon */
  tower_boundary?: number[][]
  /** [lat, lon] pairs for TRACON lateral boundary (when present, used instead of radius cylinder) */
  tracon_boundary?: number[][]
  class_b?: ClassBTier[]
  /** Charted Class C rings (SFC core + shelves), each with its true MSL floor/ceiling. */
  class_c?: ClassBTier[]
  artcc?: string | null
}

export interface PhaseConfig {
  class: string
  twr_ceil_ft: number
  twr_radius_nm: number
  tracon_ceil_ft: number
  tracon_radius_nm: number
  phase: PhaseThresholds
}

export const PHASE_DEFAULTS: PhaseThresholds = {
  cruise_alt_ft: 18000,
  cruise_level_fpm: 500,
  departing_radius_nm: 3,
  departing_climb_fpm: 200,
  departing_max_agl_ft: 3000,
  departing_min_kts: 80,
  tower_descent_fpm: 200,
  tracon_descent_fpm: 300,
  climbout_climb_fpm: 300,
  arrival_radius_nm: 3,
  final_radius_nm: 7,
  final_lateral_nm: 0.75,
  final_heading_tolerance_deg: 45,
}

const DEFAULTS: AirspaceConfig = {
  class: 'C',
  twr_ceil_ft: 3000,
  twr_radius_nm: 5,
  tracon_ceil_ft: 10000,
  tracon_radius_nm: 40,
}

const data = airspaceData as Record<string, AirspaceConfig>
const DEFAULT_GROUND_RADIUS_NM = 3

export function getAirspace(icao: string): AirspaceConfig {
  return data[icao] ?? DEFAULTS
}

export function getGroundRadiusNm(icao: string): number {
  return getAirspace(icao).ground_radius_nm ?? DEFAULT_GROUND_RADIUS_NM
}

export function getArtcc(identifier: string): ArtccStratum[] {
  return (artccData as ArtccConfig)[identifier] ?? []
}

export function getPhaseConfig(icao: string): PhaseConfig {
  const airspace = getAirspace(icao)
  return {
    class: airspace.class,
    twr_ceil_ft: airspace.twr_ceil_ft,
    twr_radius_nm: airspace.twr_radius_nm,
    tracon_ceil_ft: airspace.tracon_ceil_ft,
    tracon_radius_nm: airspace.tracon_radius_nm,
    phase: { ...PHASE_DEFAULTS, ...airspace.phase },
  }
}

export function getAltFilterRange(
  icao: string,
  filter: 'TWR' | 'TRACON' | 'CTR' | 'ALL',
): { min: number; max: number } {
  const a = getAirspace(icao)
  switch (filter) {
    case 'TWR':
      // Surface to tower ceiling — tower owns this band
      return { min: 0, max: a.twr_ceil_ft }
    case 'TRACON':
      // Show all aircraft from surface to TRACON ceiling when TRACON filter is active.
      // Approach works inbounds all the way down through the tower altitude band
      // until the handoff — the floor is 0, not twr_ceil_ft.
      return { min: 0, max: a.tracon_ceil_ft }
    case 'CTR':
      // Above TRACON ceiling — en route center owns this band
      return { min: a.tracon_ceil_ft, max: 99999 }
    case 'ALL':
      return { min: 0, max: 99999 }
  }
}
