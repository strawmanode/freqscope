export interface BoundingBox {
  lamin: number
  lamax: number
  lomin: number
  lomax: number
}

/** ~60nm radius: 1° latitude ≈ 60nm; longitude scaled by cos(lat) */
export function bboxAround(
  lat: number,
  lon: number,
  radiusNm = 60,
): BoundingBox {
  const latDelta = radiusNm / 60
  const lonDelta = radiusNm / (60 * Math.cos((lat * Math.PI) / 180))
  return {
    lamin: lat - latDelta,
    lamax: lat + latDelta,
    lomin: lon - lonDelta,
    lomax: lon + lonDelta,
  }
}

export function fetchRadiusForFilter(altFilter: 'TWR' | 'TRACON' | 'CTR' | 'ALL'): number {
  switch (altFilter) {
    case 'TWR':
      return 30
    case 'TRACON':
      return 150
    case 'CTR':
      return 250
    case 'ALL':
      return 250
  }
}

export function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1.852
}

/** Initial bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Great-circle destination from a point given an initial bearing and distance. */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distNm: number,
): { lat: number; lon: number } {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const R = 3440.065 // earth radius in nm
  const delta = distNm / R
  const theta = toRad(bearingDeg)
  const phi1 = toRad(lat)
  const lambda1 = toRad(lon)
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    )
  return { lat: toDeg(phi2), lon: ((toDeg(lambda2) + 540) % 360) - 180 }
}

export interface TrailFixHeadingInput {
  lat: number
  lon: number
  interpolated: boolean
}

/** Derive direction of travel from the last two real trail fixes; fall back to ADS-B track. */
export function deriveTrackFromTrailFixes(
  fixes: TrailFixHeadingInput[] | undefined,
  fallbackTrackDeg: number | null | undefined,
): number | null | undefined {
  const realFixes = fixes?.filter((f) => !f.interpolated) ?? []
  if (realFixes.length >= 2) {
    const prev = realFixes[realFixes.length - 2]
    const curr = realFixes[realFixes.length - 1]
    return bearingBetween(prev.lat, prev.lon, curr.lat, curr.lon)
  }
  return fallbackTrackDeg
}
