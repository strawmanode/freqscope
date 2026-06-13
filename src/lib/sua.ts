import suaData from '../data/sua.json'
import { bboxAround } from './geo'

export type SpecialUseAirspaceType = 'MOA' | 'RESTRICTED' | 'WARNING' | 'ALERT'

export interface SpecialUseAirspace {
  type: SpecialUseAirspaceType
  identifier: string
  name: string
  state: string | null
  floor_ft: number
  floor_ref: string
  ceiling_ft: number
  ceiling_ref: string
  schedule_description: string | null
  boundary: number[][]
}

const all = suaData as SpecialUseAirspace[]
const cache = new Map<string, SpecialUseAirspace[]>()

function pointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i]
    const [latJ, lonJ] = polygon[j]
    if (
      (latI > lat) !== (latJ > lat) &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside
    }
  }
  return inside
}

function intersectsBbox(sua: SpecialUseAirspace, bbox: ReturnType<typeof bboxAround>): boolean {
  for (const [lat, lon] of sua.boundary) {
    if (
      lat >= bbox.lamin &&
      lat <= bbox.lamax &&
      lon >= bbox.lomin &&
      lon <= bbox.lomax
    ) {
      return true
    }
  }
  const midLat = (bbox.lamin + bbox.lamax) / 2
  const midLon = (bbox.lomin + bbox.lomax) / 2
  return pointInPolygon(midLat, midLon, sua.boundary)
}

export function getSuaNear(lat: number, lon: number, radiusNm = 250): SpecialUseAirspace[] {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusNm}`
  const cached = cache.get(key)
  if (cached) return cached

  const bbox = bboxAround(lat, lon, radiusNm)
  const result = all.filter((sua) => intersectsBbox(sua, bbox))
  cache.set(key, result)
  return result
}
