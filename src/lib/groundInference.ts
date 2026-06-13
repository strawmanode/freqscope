import type { RichAircraftState } from '../types/aircraft'

/**
 * Some transponders never set the air/ground bit (so `alt_baro` stays numeric
 * while the aircraft taxis), which left taxiing traffic labeled AIRBORNE.
 * Infer ground state from height above field + groundspeed + vertical rate.
 */

/** Max height above field elevation to consider for ground inference.
 *  Generous because reported baro altitude vs. field elevation can disagree
 *  by a few hundred feet when QNH is off standard (~1 hPa ≈ 27 ft). */
const GROUND_MAX_AGL_FT = 300

/** Below this groundspeed nothing fixed-wing is flying level near the field —
 *  taxi and slow rollout traffic falls under it, short final does not. */
const GROUND_MAX_SPEED_KTS = 50

/** ADS-B vertical rate is quantized to 64 fpm; allow a couple of steps of noise. */
const GROUND_MAX_VS_FPM = 200

/** ADS-B emitter category for rotorcraft — they can legitimately hover
 *  low and slow, so never infer ground for them. */
const CATEGORY_ROTORCRAFT = 'A7'

/** True when an aircraft not flagged on-ground by its transponder is, by all
 *  other evidence, on the ground (e.g. taxiing with a stuck air/ground bit). */
export function isLikelyOnGround(
  s: RichAircraftState,
  fieldElevationFt: number,
): boolean {
  if (s.onGround) return true
  if (s.category === CATEGORY_ROTORCRAFT) return false

  const aglFt = s.altitudeFt - fieldElevationFt
  const speedKts = s.speedKts ?? 0
  const vsFpm = Math.abs(s.verticalRateFpm ?? 0)

  return (
    aglFt <= GROUND_MAX_AGL_FT &&
    speedKts <= GROUND_MAX_SPEED_KTS &&
    vsFpm <= GROUND_MAX_VS_FPM
  )
}

/** Normalize `onGround` across a batch of feed states. Applied once where
 *  states enter the app so every consumer (detail card, phase classifier,
 *  datablocks, runway logic, dead reckoning) sees a consistent value. */
export function normalizeGroundState(
  states: RichAircraftState[],
  fieldElevationFt: number,
): RichAircraftState[] {
  return states.map((s) =>
    !s.onGround && isLikelyOnGround(s, fieldElevationFt)
      ? { ...s, onGround: true, altitudeFt: fieldElevationFt }
      : s,
  )
}
