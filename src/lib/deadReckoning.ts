import type { RichAircraftState } from '../types/aircraft'
import { destinationPoint } from './geo'

/** How often the animator advances targets between polls. */
export const DR_TICK_MS = 100
/** Stop extrapolating past this age — matches radar "coast" behavior. */
export const DR_MAX_EXTRAP_MS = 30_000
/**
 * Cap on how far forward a target is *moved* between fixes. The feed polls
 * ~every 5 s, so a fix older than this means the target has likely stopped
 * reporting (e.g. just landed and dropped off ground coverage). Past this we
 * hold position instead of flying the extrapolation onward — otherwise a stale
 * fix sends the symbol and its datablock sailing a mile down the track, away
 * from where the aircraft actually is.
 */
export const DR_MAX_MOTION_MS = 8_000
/** Below this groundspeed dead reckoning adds jitter, not realism. */
export const DR_MIN_SPEED_KTS = 30

/** Typical landing rollout deceleration. */
const ROLLOUT_DECEL_KTS_PER_S = 2.5
/** Speed the rollout model decays to (high-speed-exit taxi), not a full stop. */
const ROLLOUT_MIN_SPEED_KTS = 25
/**
 * Only model touchdown when the fix shows a real descent. A go-around reports
 * a level-off or climb, so it never enters the touchdown branch and plain
 * extrapolation carries it up and away instead of pinning it to the runway.
 */
export const LANDING_MIN_SINK_FPM = -100

export interface DrPosition {
  lat: number
  lon: number
  altitudeFt: number
  /**
   * Whether the target is on the surface per the model — true once the
   * touchdown/rollout model has put it on the runway, even before the feed's
   * air/ground bit flips. Drives ground coloring so a landed target doesn't
   * stay tower-colored while the feed catches up.
   */
  onGround: boolean
}

export interface DeadReckonContext {
  /** Field elevation (ft MSL) used as the altitude floor near the airport. */
  groundElevFt?: number
  /**
   * Target is established to land (or already rolling out on a runway):
   * model touchdown at the fix's sink rate, then rollout deceleration,
   * instead of gliding level across the field at approach speed.
   */
  landing?: boolean
  /**
   * QNH-corrected height above the field at the fix (ft). ADS-B reports
   * uncorrected pressure altitude, which can be hundreds of feet off on a
   * non-standard-pressure day — far too coarse for touchdown timing.
   */
  aglFt?: number
  /**
   * Geometric backstop: is this lat/lon over runway pavement? When the
   * extrapolated point is over a runway at very low (corrected) height,
   * the target is pinned to the surface regardless of residual altitude
   * error. Go-arounds are protected by the sink-rate gate before this.
   */
  isOverRunway?: (lat: number, lon: number) => boolean
}

/** Below this corrected AGL, a descending target over pavement is "landed". */
const RUNWAY_PIN_MAX_AGL_FT = 150

/**
 * Ground distance covered (NM) while decelerating from `v0Kts` at the rollout
 * rate over `rollMs`, holding at the floor speed once reached.
 */
function rolloutDistanceNm(v0Kts: number, rollMs: number): number {
  if (rollMs <= 0) return 0
  const vFloor = Math.min(v0Kts, ROLLOUT_MIN_SPEED_KTS)
  const decelMs = ((v0Kts - vFloor) / ROLLOUT_DECEL_KTS_PER_S) * 1000
  const tDecelMs = Math.min(rollMs, decelMs)
  const vEnd = v0Kts - (ROLLOUT_DECEL_KTS_PER_S * tDecelMs) / 1000
  const decelDistNm = (((v0Kts + vEnd) / 2) * tDecelMs) / 3_600_000
  const holdDistNm = (vFloor * Math.max(0, rollMs - tDecelMs)) / 3_600_000
  return decelDistNm + holdDistNm
}

/**
 * Extrapolate a target's position along its track at its last reported
 * groundspeed. `baseMs` is the timestamp for the reported fix, not the
 * client poll arrival, so polling/cache cadence does not reset motion.
 * Returns null when the target shouldn't move (slow, no track, or stale
 * beyond the coast limit cap).
 */
export function deadReckon(
  state: RichAircraftState,
  baseMs: number,
  nowMs: number,
  /** Direction of travel for extrapolation; defaults to ADS-B track. */
  trackDeg: number | null | undefined = state.trackDeg,
  ctx?: DeadReckonContext,
): DrPosition | null {
  if (state.speedKts == null || state.speedKts < DR_MIN_SPEED_KTS) return null
  if (trackDeg == null) return null

  const dtMs = Math.min(Math.max(0, nowMs - baseMs), DR_MAX_MOTION_MS)
  if (dtMs <= 0) return null

  const groundElevFt = ctx?.groundElevFt ?? 0

  // Rollout: already reported on a runway at speed — decelerate, don't cruise
  if (ctx?.landing && state.onGround) {
    const distNm = rolloutDistanceNm(state.speedKts, dtMs)
    const { lat, lon } = destinationPoint(state.lat, state.lon, trackDeg, distNm)
    return { lat, lon, altitudeFt: state.altitudeFt, onGround: true }
  }

  // Touchdown: descending fix on short final — fly the sink rate down to the
  // surface, then roll out. Uses QNH-corrected AGL when provided. Go-arounds
  // never descend into this branch (sink-rate gate) and are corrected by the
  // next live fix anyway.
  if (
    ctx?.landing &&
    !state.onGround &&
    state.verticalRateFpm != null &&
    state.verticalRateFpm <= LANDING_MIN_SINK_FPM
  ) {
    const aglFt = Math.max(0, ctx.aglFt ?? state.altitudeFt - groundElevFt)
    const tTouchdownMs = (aglFt / -state.verticalRateFpm) * 60_000

    if (tTouchdownMs <= dtMs) {
      const airDistNm = (state.speedKts * tTouchdownMs) / 3_600_000
      const rollDistNm = rolloutDistanceNm(state.speedKts, dtMs - tTouchdownMs)
      const { lat, lon } = destinationPoint(
        state.lat,
        state.lon,
        trackDeg,
        airDistNm + rollDistNm,
      )
      return { lat, lon, altitudeFt: groundElevFt, onGround: true }
    }

    // Still airborne: render the corrected descent (anchored to the field,
    // not raw pressure altitude) so the target visibly meets the runway
    const distNm = (state.speedKts * dtMs) / 3_600_000
    const { lat, lon } = destinationPoint(state.lat, state.lon, trackDeg, distNm)
    let dispAglFt = Math.max(0, aglFt + (state.verticalRateFpm * dtMs) / 60_000)
    if (dispAglFt <= RUNWAY_PIN_MAX_AGL_FT && ctx.isOverRunway?.(lat, lon)) {
      dispAglFt = 0
    }
    return { lat, lon, altitudeFt: groundElevFt + dispAglFt, onGround: dispAglFt === 0 }
  }

  const distNm = (state.speedKts * dtMs) / 3_600_000
  const { lat, lon } = destinationPoint(state.lat, state.lon, trackDeg, distNm)

  let altitudeFt = state.altitudeFt
  if (!state.onGround && state.verticalRateFpm != null) {
    // Floor at the field, not sea level, when we know we're near the airport
    const floorFt = ctx?.landing ? groundElevFt : 0
    altitudeFt = Math.max(floorFt, altitudeFt + (state.verticalRateFpm * dtMs) / 60_000)
  }

  return { lat, lon, altitudeFt, onGround: state.onGround }
}
