import type { PositionSnapshot } from '../types/aircraft'
import type { FlightPhase } from '../types/aircraft'
import type { RunwayEnd, Runway } from '../types'
import type { PhaseThresholds } from './airspace'

const DEG_TO_RAD = Math.PI / 180

export function haversineNm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3440.065
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLon = (lon2 - lon1) * DEG_TO_RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
    Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function angleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

export function initialBearingDeg(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const φ1 = lat1 * DEG_TO_RAD
  const φ2 = lat2 * DEG_TO_RAD
  const Δλ = (lon2 - lon1) * DEG_TO_RAD
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360
}

const NM_PER_FT = 1 / 6076.115

/** Lateral tolerance from runway centerline (≈110 m): runway safety-area width
 *  plus ADS-B position slop. This keeps taxiway traffic out, but catches
 *  line-up-and-wait / takeoff-roll targets whose reported position is offset
 *  toward the runway edge. */
const RUNWAY_CROSS_TOLERANCE_NM = 0.06

/** Along-track buffer past each threshold (≈150 m) for targets at the numbers. */
const RUNWAY_END_BUFFER_NM = 0.08

/** Wider corridor for tower runway-occupancy display, covering hold-short /
 *  line-up positions near an active runway without lighting up the whole ramp. */
const ACTIVE_RUNWAY_NEAR_CROSS_TOLERANCE_NM = 0.1
const ACTIVE_RUNWAY_NEAR_END_BUFFER_NM = 0.15

function runwayIsActive(rwy: Runway, activeRunwayEnds: Set<string>): boolean {
  if (activeRunwayEnds.size === 0) return true
  return rwy.ends.some((end) => activeRunwayEnds.has(end.name))
}

function matchesRunwayCorridor(
  lat: number,
  lon: number,
  runways: Runway[],
  crossToleranceNm: number,
  endBufferNm: number,
  activeRunwayEnds = new Set<string>(),
): boolean {
  for (const rwy of runways) {
    if (!runwayIsActive(rwy, activeRunwayEnds)) continue
    const [a, b] = rwy.ends
    const lengthNm = rwy.length_ft * NM_PER_FT
    const distA = haversineNm(a.lat, a.lon, lat, lon)
    if (distA > lengthNm + endBufferNm) continue

    const bearingAB = initialBearingDeg(a.lat, a.lon, b.lat, b.lon)
    const bearingAP = initialBearingDeg(a.lat, a.lon, lat, lon)
    const diff = angleDiffDeg(bearingAB, bearingAP)
    const alongNm = distA * Math.cos(diff * DEG_TO_RAD)
    const crossNm = Math.abs(distA * Math.sin(diff * DEG_TO_RAD))

    if (
      alongNm >= -endBufferNm &&
      alongNm <= lengthNm + endBufferNm &&
      crossNm <= crossToleranceNm
    ) {
      return true
    }
  }
  return false
}

/** True when the position lies on a runway (within the centerline corridor between
 *  thresholds). Used to keep LUAW / rolling / crossing traffic on the tower scope. */
export function isOnRunway(
  lat: number,
  lon: number,
  runways: Runway[],
): boolean {
  return matchesRunwayCorridor(
    lat,
    lon,
    runways,
    RUNWAY_CROSS_TOLERANCE_NM,
    RUNWAY_END_BUFFER_NM,
  )
}

export function isOnOrNearActiveRunway(
  lat: number,
  lon: number,
  runways: Runway[],
  activeRunwayEnds: Set<string>,
): boolean {
  return matchesRunwayCorridor(
    lat,
    lon,
    runways,
    ACTIVE_RUNWAY_NEAR_CROSS_TOLERANCE_NM,
    ACTIVE_RUNWAY_NEAR_END_BUFFER_NM,
    activeRunwayEnds,
  )
}

function avgVerticalRate(history: PositionSnapshot[]): number {
  if (history.length === 0) return 0
  return history.reduce((s, h) => s + h.verticalRateFpm, 0) / history.length
}

function nearestRunwayEnd(
  lat: number,
  lon: number,
  runways: Runway[],
): { end: RunwayEnd; distNm: number } | null {
  let best: { end: RunwayEnd; distNm: number } | null = null
  for (const rwy of runways) {
    for (const end of rwy.ends) {
      const d = haversineNm(lat, lon, end.lat, end.lon)
      if (!best || d < best.distNm) best = { end, distNm: d }
    }
  }
  return best
}

/** Path B: inbound extended centerline within final_radius_nm of threshold. */
function matchFinalCenterline(
  lat: number,
  lon: number,
  headingDeg: number,
  runways: Runway[],
  activeRunwayEnds: Set<string>,
  phase: PhaseThresholds,
): { matched: boolean; distToThresholdNm: number } {
  let bestAlong = Infinity
  let bestDist = Infinity

  for (const rwy of runways) {
    for (const end of rwy.ends) {
      if (activeRunwayEnds.size > 0 && !activeRunwayEnds.has(end.name)) continue

      // Inbound approaches lie beyond the threshold along reciprocal of runway heading.
      const approachBearing = (end.heading_deg + 180) % 360
      const distNm = haversineNm(end.lat, end.lon, lat, lon)
      if (distNm < 0.05) continue

      const bearingToAc = initialBearingDeg(end.lat, end.lon, lat, lon)
      const bearingDiff = angleDiffDeg(bearingToAc, approachBearing)
      const alongTrackNm = distNm * Math.cos(bearingDiff * DEG_TO_RAD)
      const crossTrackNm = distNm * Math.sin(bearingDiff * DEG_TO_RAD)

      if (alongTrackNm <= 0) continue
      if (alongTrackNm > phase.final_radius_nm) continue
      if (crossTrackNm > phase.final_lateral_nm) continue

      if (phase.final_heading_tolerance_deg > 0) {
        const hdgDiff = angleDiffDeg(headingDeg, end.heading_deg)
        if (hdgDiff > phase.final_heading_tolerance_deg) continue
      }

      if (alongTrackNm < bestAlong) {
        bestAlong = alongTrackNm
        bestDist = distNm
      }
    }
  }

  if (!Number.isFinite(bestAlong)) {
    return { matched: false, distToThresholdNm: 999 }
  }
  return { matched: true, distToThresholdNm: bestDist }
}

export interface PhaseInput {
  lat: number
  lon: number
  altitudeFt: number
  speedKts: number
  headingDeg: number
  onGround: boolean
  history: PositionSnapshot[]
  airportLat: number
  airportLon: number
  airportElevationFt: number
  twrRadiusNm: number
  twrCeilFt: number
  traconRadiusNm: number
  traconCeilFt: number
  phase: PhaseThresholds
  runways: Runway[]
  activeRunwayEnds: Set<string>
}

export function classifyPhase(input: PhaseInput): FlightPhase {
  const {
    lat, lon, altitudeFt, speedKts, headingDeg, onGround,
    history, airportLat, airportLon, airportElevationFt,
    twrRadiusNm, twrCeilFt, traconRadiusNm, traconCeilFt,
    phase, runways, activeRunwayEnds,
  } = input

  if (onGround) return 'ground'

  const aglFt = altitudeFt - airportElevationFt
  const avgVr = avgVerticalRate(history)
  const nearest = nearestRunwayEnd(lat, lon, runways)
  const distThresholdNm = nearest?.distNm ?? 999
  const distAirportNm = haversineNm(lat, lon, airportLat, airportLon)
  const inTowerLateral = distAirportNm <= twrRadiusNm
  const inTowerAlt = aglFt <= twrCeilFt
  const inTowerCylinder = inTowerLateral && inTowerAlt
  const centerline = matchFinalCenterline(
    lat,
    lon,
    headingDeg,
    runways,
    activeRunwayEnds,
    phase,
  )
  const onFinalCenterline = centerline.matched && inTowerAlt
  const inTowerZone = inTowerCylinder || onFinalCenterline
  const inTraconLateral = distAirportNm <= traconRadiusNm
  const inTraconAlt = aglFt <= traconCeilFt
  const inTraconCylinder = inTraconLateral && inTraconAlt
  const towerDistNm = onFinalCenterline
    ? centerline.distToThresholdNm
    : distThresholdNm

  // Cruise — high and level
  if (altitudeFt >= phase.cruise_alt_ft && Math.abs(avgVr) < phase.cruise_level_fpm) {
    return 'cruise'
  }

  // Departing — near runway threshold, climbing
  if (
    distThresholdNm <= phase.departing_radius_nm &&
    avgVr > phase.departing_climb_fpm &&
    aglFt < phase.departing_max_agl_ft &&
    speedKts > phase.departing_min_kts
  ) {
    return 'departing'
  }

  // Tower — path A (cylinder) or path B (final centerline), descending inbound
  if (inTowerZone && avgVr < -phase.tower_descent_fpm) {
    if (towerDistNm <= phase.arrival_radius_nm) return 'arrival'
    return 'final'
  }

  // TRACON — outside tower zone
  if (inTraconCylinder && !inTowerZone && avgVr < -phase.tracon_descent_fpm) {
    return 'approach'
  }

  // Climbout — low, climbing, not caught above
  if (aglFt <= traconCeilFt && avgVr > phase.climbout_climb_fpm) {
    return 'climbout'
  }

  return 'unknown'
}
