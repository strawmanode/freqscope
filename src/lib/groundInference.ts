import type { Runway } from '../types'
import type { RichAircraftState } from '../types/aircraft'
import { isOnRunway } from './flightPhase'

/**
 * Some transponders never set the air/ground bit (so `alt_baro` stays numeric
 * while the aircraft taxis or rolls out), which left landing/taxiing traffic
 * labeled AIRBORNE. Infer ground state from height above field, groundspeed,
 * vertical rate, and runway geometry, and make it sticky so a target that has
 * landed stays on the ground through its rollout and taxi instead of flickering
 * back to its airborne (tower/approach) color whenever the feed lags.
 */

/** Max height above field elevation to consider for ground inference.
 *  Generous because reported baro altitude vs. field elevation can disagree
 *  by a few hundred feet when QNH is off standard (~1 hPa ≈ 27 ft). */
const GROUND_MAX_AGL_FT = 300

/** Above this height above field a target is unambiguously airborne — used to
 *  release the sticky ground state on departure/go-around. */
const GROUND_RELEASE_AGL_FT = 400

/** Below this groundspeed nothing fixed-wing is flying level near the field —
 *  taxi and slow rollout traffic falls under it, short final does not. */
const GROUND_MAX_SPEED_KTS = 50

/** ADS-B vertical rate is quantized to 64 fpm; allow a couple of steps of noise. */
const GROUND_MAX_VS_FPM = 200

/** Climbing faster than this means the target has rotated and is departing, so
 *  it should no longer be held on the ground even if still low. */
const GROUND_MAX_CLIMB_FPM = 400

/** ADS-B emitter category for rotorcraft — they can legitimately hover
 *  low and slow, so never infer ground for them. */
const CATEGORY_ROTORCRAFT = 'A7'

/** True when an aircraft not flagged on-ground by its transponder is, by all
 *  other evidence, on the ground (e.g. taxiing or rolling out with a stuck
 *  air/ground bit). `wasGround` carries the previous resolution so the state is
 *  sticky: once down, a target stays down until it is clearly airborne again
 *  (climbing out or well above the field), which keeps a landed aircraft GND
 *  through its full rollout and taxi. */
export function isLikelyOnGround(
  s: RichAircraftState,
  fieldElevationFt: number,
  runways: Runway[] = [],
  wasGround = false,
): boolean {
  if (s.onGround) return true
  if (s.category === CATEGORY_ROTORCRAFT) return false

  const aglFt = s.altitudeFt - fieldElevationFt
  const speedKts = s.speedKts ?? 0
  const vsFpm = s.verticalRateFpm ?? 0

  // Unambiguously airborne — release any sticky ground state (departures,
  // go-arounds, missed approaches).
  if (aglFt > GROUND_RELEASE_AGL_FT) return false
  if (vsFpm > GROUND_MAX_CLIMB_FPM) return false

  // Sticky: a target we already had on the ground stays down while it remains
  // low and isn't climbing away — covers the whole rollout and taxi, including
  // the high-speed portion of the landing roll.
  if (wasGround && aglFt <= GROUND_MAX_AGL_FT) return true

  // Fresh detection: slow + low (taxi / slow rollout) anywhere near the field…
  if (
    aglFt <= GROUND_MAX_AGL_FT &&
    speedKts <= GROUND_MAX_SPEED_KTS &&
    Math.abs(vsFpm) <= GROUND_MAX_VS_FPM
  ) {
    return true
  }

  // …or physically on a runway at low height and not climbing — catches the
  // landing rollout (and takeoff roll before rotation) at any speed.
  if (aglFt <= GROUND_MAX_AGL_FT && runways.length > 0 && isOnRunway(s.lat, s.lon, runways)) {
    return true
  }

  return false
}

export interface NormalizedGroundResult {
  states: RichAircraftState[]
  /** Resolved ground state per icao24 — feed this back in as `prevGround` next
   *  poll so the sticky behavior persists across updates. */
  ground: Map<string, boolean>
}

/** Normalize `onGround` across a batch of feed states. Applied once where
 *  states enter the app so every consumer (detail card, phase classifier,
 *  datablocks, runway logic, dead reckoning, target coloring) sees a consistent
 *  value. `prevGround` carries the previous resolution for stickiness. */
export function normalizeGroundState(
  states: RichAircraftState[],
  fieldElevationFt: number,
  runways: Runway[] = [],
  prevGround: ReadonlyMap<string, boolean> = new Map(),
): NormalizedGroundResult {
  const ground = new Map<string, boolean>()
  const normalized = states.map((s) => {
    const onGround = isLikelyOnGround(
      s,
      fieldElevationFt,
      runways,
      prevGround.get(s.icao24) ?? false,
    )
    ground.set(s.icao24, onGround)
    return onGround && !s.onGround
      ? { ...s, onGround: true, altitudeFt: fieldElevationFt }
      : s
  })
  return { states: normalized, ground }
}
