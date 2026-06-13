import type { Runway } from '../types'
import type { MetarData } from '../components/console/StatusPanel'

/**
 * Given a list of runways and current METAR wind, return the set of
 * active runway end names (the ends aircraft are landing on / taking off from).
 *
 * Rule: aircraft land into the wind. The active end is the one whose heading
 * most closely opposes the wind direction (headwind). If multiple runways are
 * within 45° of optimal, all are considered active (parallel runways).
 *
 * Returns an empty Set when wind is calm (<3 kt), variable, or METAR unavailable
 * — in that case the UI shows all runways with equal weight.
 */
export function getActiveRunwayEnds(
  runways: Runway[],
  metar: MetarData | null,
): Set<string> {
  const active = new Set<string>()

  if (!metar || metar.wdir === 'VRB' || metar.wdir == null) return active
  if (typeof metar.wspd === 'number' && metar.wspd < 3) return active

  const windFrom =
    typeof metar.wdir === 'number'
      ? metar.wdir
      : parseInt(String(metar.wdir), 10)
  if (Number.isNaN(windFrom)) return active

  let bestDiff = 45

  for (const rwy of runways) {
    for (const end of rwy.ends) {
      const diff = angleDiff(end.heading_deg, windFrom)
      if (diff < bestDiff) bestDiff = diff
    }
  }

  for (const rwy of runways) {
    for (const end of rwy.ends) {
      const diff = angleDiff(end.heading_deg, windFrom)
      if (diff <= bestDiff + 15) active.add(end.name)
    }
  }

  return active
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}
