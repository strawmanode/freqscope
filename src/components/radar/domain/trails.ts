import { Cartesian3 } from 'cesium'
import type { Airport } from '../../../types'
import type { RichAircraftState } from '../../../types/aircraft'
import { getAltFilterRange } from '../../../lib/airspace'
import { MIN_TRAIL_MOVE_METERS, TRAIL_INTERP_COUNT } from '../constants'
import type { TrailConfig, TrailFix } from '../types'
import { isWithinTowerRadius } from './filters'

/**
 * Scope display height for an altitude. The basemap is a flat plane at
 * height 0, so targets must render at height ABOVE THE FIELD, not above sea
 * level — rendering raw MSL floats every target by the field elevation
 * (e.g. ~288 m at KONT) and the tilted camera turns that vertical error into
 * an apparent lateral offset from the runway.
 */
export function scopeHeightM(
  altitudeFt: number | null | undefined,
  elevationFt: number,
): number {
  return Math.max(0, (altitudeFt ?? 0) - elevationFt) * 0.3048
}

export function recordTrailFixes(
  states: RichAircraftState[],
  trailFixes: Map<string, TrailFix[]>,
  elevationFt: number,
): void {
  const fixTime = Date.now()
  const currentIcaos = new Set<string>()

  for (const s of states) {
    const lat = s.lat
    const lon = s.lon

    currentIcaos.add(s.icao24)
    const newPosition = Cartesian3.fromDegrees(
      lon,
      lat,
      scopeHeightM(s.altitudeFt, elevationFt),
    )
    const fixes = trailFixes.get(s.icao24) ?? []
    const lastRealFix = [...fixes].reverse().find((f) => !f.interpolated)

    if (lastRealFix) {
      const movedM = Cartesian3.distance(lastRealFix.position, newPosition)
      if (movedM < MIN_TRAIL_MOVE_METERS) continue

      for (let i = 1; i <= TRAIL_INTERP_COUNT; i++) {
        const t = i / (TRAIL_INTERP_COUNT + 1)
        fixes.push({
          position: new Cartesian3(
            lastRealFix.position.x + (newPosition.x - lastRealFix.position.x) * t,
            lastRealFix.position.y + (newPosition.y - lastRealFix.position.y) * t,
            lastRealFix.position.z + (newPosition.z - lastRealFix.position.z) * t,
          ),
          lat: lastRealFix.lat + (lat - lastRealFix.lat) * t,
          lon: lastRealFix.lon + (lon - lastRealFix.lon) * t,
          time: lastRealFix.time + (fixTime - lastRealFix.time) * t,
          interpolated: true,
        })
      }
    }

    fixes.push({
      position: newPosition,
      lat,
      lon,
      time: fixTime,
      interpolated: false,
    })

    const maxDots = 13 * (TRAIL_INTERP_COUNT + 1)
    if (fixes.length > maxDots) fixes.splice(0, fixes.length - maxDots)
    trailFixes.set(s.icao24, fixes)
  }

  for (const icao of trailFixes.keys()) {
    if (!currentIcaos.has(icao)) trailFixes.delete(icao)
  }
}

export function getTrailBandConfig(
  state: RichAircraftState,
  airport: Airport,
  trailConfig: TrailConfig | undefined,
  elevationFt: number,
) {
  const cfg = trailConfig ?? {
    twr: { length: 8, fade: 0.6 },
    app: { length: 8, fade: 0.6 },
    ctr: { length: 8, fade: 0.6 },
    gnd: { length: 4, fade: 0.4 },
  }
  if (state.onGround) return cfg.gnd

  const altAglFt = Math.max(0, state.altitudeFt - elevationFt)
  const traconRange = getAltFilterRange(airport.icao, 'TRACON')
  const twrRange = getAltFilterRange(airport.icao, 'TWR')

  if (altAglFt > traconRange.max) return cfg.ctr

  if (isWithinTowerRadius(state, airport) && altAglFt <= twrRange.max) return cfg.twr
  return cfg.app
}
