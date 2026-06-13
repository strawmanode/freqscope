import type { Runway } from '../../../types'
import type { EnrichedAircraft, RichAircraftState } from '../../../types/aircraft'
import { resolveAircraftModel } from '../../../lib/aircraftModels'
import { deriveTrackFromTrailFixes } from '../../../lib/geo'
import { isOnRunway } from '../../../lib/flightPhase'
import {
  LANDING_MIN_SINK_FPM,
  type DeadReckonContext,
} from '../../../lib/deadReckoning'
import {
  FT_PER_HPA,
  LANDING_PROFILE_MAX_AGL_FT,
  MODEL_LOD_CUTOFF_M,
  STANDARD_QNH_HPA,
} from '../constants'
import type { TrailFix } from '../types'

export function aircraftUses3DModel(state: RichAircraftState, camAltM: number): boolean {
  return (
    !state.onGround &&
    camAltM < MODEL_LOD_CUTOFF_M &&
    resolveAircraftModel(state.aircraftType) !== null
  )
}

/** Track used for leader lines, 3D model heading, and dead reckoning — must stay aligned. */
export function getLeaderTrackDeg(
  state: RichAircraftState,
  camAltM: number,
  trailFixes: TrailFix[] | undefined,
): number | null | undefined {
  const use3D = aircraftUses3DModel(state, camAltM)
  const derived = use3D
    ? deriveTrackFromTrailFixes(trailFixes, state.trackDeg)
    : state.trackDeg
  return derived ?? state.trackDeg
}

export function deadReckonBaseMs(state: RichAircraftState, fallbackMs: number): number {
  const fixMs = state.lastSeen * 1000
  return Number.isFinite(fixMs) ? Math.min(fixMs, fallbackMs) : fallbackMs
}

/**
 * ADS-B altitude is uncorrected pressure altitude. Correct it to true height
 * above the field using the current METAR altimeter setting — without this,
 * touchdown timing can be off by hundreds of feet on a non-standard day.
 */
export function qnhCorrectedAglFt(
  state: RichAircraftState,
  elevationFt: number,
  qnhHpa: number | null,
): number {
  const corrFt = qnhHpa != null ? (qnhHpa - STANDARD_QNH_HPA) * FT_PER_HPA : 0
  return state.altitudeFt + corrFt - elevationFt
}

/**
 * Dead-reckoning context: arrivals established inbound (per the phase
 * classifier) and descending get the touchdown + rollout model; targets
 * already rolling on a runway get the deceleration model. Everything else —
 * including go-arounds, which level off or climb — extrapolates normally.
 */
export function deadReckonContext(
  state: RichAircraftState,
  phase: EnrichedAircraft['phase'] | undefined,
  elevationFt: number,
  runways: Runway[],
  qnhHpa: number | null,
): DeadReckonContext {
  if (state.onGround) {
    return {
      groundElevFt: elevationFt,
      landing: isOnRunway(state.lat, state.lon, runways),
    }
  }
  const aglFt = qnhCorrectedAglFt(state, elevationFt, qnhHpa)
  const landing =
    (phase === 'final' || phase === 'arrival' || phase === 'approach') &&
    aglFt <= LANDING_PROFILE_MAX_AGL_FT &&
    (state.verticalRateFpm ?? 0) <= LANDING_MIN_SINK_FPM
  return {
    groundElevFt: elevationFt,
    landing,
    aglFt,
    isOverRunway: landing
      ? (lat: number, lon: number) => isOnRunway(lat, lon, runways)
      : undefined,
  }
}
