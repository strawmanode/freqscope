import landmarksData from '../data/landmarks.json'
import { bboxAround } from './geo'
import type { Landmark } from '../types'

const all = landmarksData as Landmark[]
const cache = new Map<string, Landmark[]>()

export function getLandmarksNear(lat: number, lon: number, radiusNm = 150): Landmark[] {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusNm}`
  const cached = cache.get(key)
  if (cached) return cached

  const bbox = bboxAround(lat, lon, radiusNm)
  const result = all.filter(
    (lm) =>
      lm.lat >= bbox.lamin &&
      lm.lat <= bbox.lamax &&
      lm.lon >= bbox.lomin &&
      lm.lon <= bbox.lomax,
  )
  cache.set(key, result)
  return result
}
