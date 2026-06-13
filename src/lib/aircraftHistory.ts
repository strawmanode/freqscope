import type { PositionSnapshot, RichAircraftState } from '../types/aircraft'

const MAX_SNAPSHOTS = 5
const STALE_MS = 90_000

// Keyed by icao24
const historyStore: Record<string, PositionSnapshot[]> = {}

export function updateHistory(states: RichAircraftState[]): void {
  const now = Date.now()

  for (const s of states) {
    const icao24 = s.icao24
    const lat = s.lat
    const lon = s.lon

    const altitudeFt = s.altitudeFt
    const speedKts = s.speedKts != null ? Math.round(s.speedKts) : 0
    const headingDeg = s.trackDeg ?? 0
    const verticalRateFpm =
      s.verticalRateFpm != null ? Math.round(s.verticalRateFpm) : 0
    const onGround = s.onGround

    const snapshot: PositionSnapshot = {
      timestamp: now,
      lat,
      lon,
      altitudeFt,
      speedKts,
      headingDeg,
      verticalRateFpm,
      onGround,
    }

    if (!historyStore[icao24]) historyStore[icao24] = []
    historyStore[icao24].push(snapshot)
    if (historyStore[icao24].length > MAX_SNAPSHOTS) {
      historyStore[icao24].shift()
    }
  }

  // Prune stale aircraft
  const cutoff = now - STALE_MS
  for (const icao24 of Object.keys(historyStore)) {
    const last = historyStore[icao24].at(-1)
    if (!last || last.timestamp < cutoff) {
      delete historyStore[icao24]
    }
  }
}

export function getHistory(icao24: string): PositionSnapshot[] {
  return historyStore[icao24] ?? []
}

export function clearHistory(): void {
  for (const key of Object.keys(historyStore)) {
    delete historyStore[key]
  }
}
