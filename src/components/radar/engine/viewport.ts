import { Math as CesiumMath, type Rectangle, type Viewer } from 'cesium'
import type { RichAircraftState } from '../../../types/aircraft'

export type ViewportBounds = {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  crossesAntimeridian: boolean
  allLongitudes: boolean
}

const VIEWPORT_RENDER_PADDING_RATIO = 0.18
const VIEWPORT_RENDER_MIN_PADDING_DEG = 0.03
const VIEWPORT_BOUNDS_EQUAL_EPS_DEG = 0.005

function normalizeLonDeg(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

function clampLatDeg(lat: number): number {
  return Math.max(-90, Math.min(90, lat))
}

function paddedViewportBounds(rectangle: Rectangle): ViewportBounds {
  const rawWest = normalizeLonDeg(CesiumMath.toDegrees(rectangle.west))
  const rawEast = normalizeLonDeg(CesiumMath.toDegrees(rectangle.east))
  const rawSouth = clampLatDeg(CesiumMath.toDegrees(rectangle.south))
  const rawNorth = clampLatDeg(CesiumMath.toDegrees(rectangle.north))
  const crossesAntimeridian = rawEast < rawWest
  const lonSpan = crossesAntimeridian ? 360 - rawWest + rawEast : rawEast - rawWest
  const latSpan = Math.max(0, rawNorth - rawSouth)
  const lonPad = Math.max(lonSpan * VIEWPORT_RENDER_PADDING_RATIO, VIEWPORT_RENDER_MIN_PADDING_DEG)
  const latPad = Math.max(latSpan * VIEWPORT_RENDER_PADDING_RATIO, VIEWPORT_RENDER_MIN_PADDING_DEG)
  const allLongitudes = lonSpan + lonPad * 2 >= 360

  return {
    minLat: clampLatDeg(rawSouth - latPad),
    maxLat: clampLatDeg(rawNorth + latPad),
    minLon: allLongitudes ? -180 : normalizeLonDeg(rawWest - lonPad),
    maxLon: allLongitudes ? 180 : normalizeLonDeg(rawEast + lonPad),
    crossesAntimeridian: allLongitudes
      ? false
      : crossesAntimeridian || normalizeLonDeg(rawWest - lonPad) > normalizeLonDeg(rawEast + lonPad),
    allLongitudes,
  }
}

export function readViewportBounds(viewer: Viewer): ViewportBounds | null {
  const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid)
  return rectangle ? paddedViewportBounds(rectangle) : null
}

export function viewportBoundsEqual(a: ViewportBounds | null, b: ViewportBounds | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.minLat - b.minLat) < VIEWPORT_BOUNDS_EQUAL_EPS_DEG &&
    Math.abs(a.maxLat - b.maxLat) < VIEWPORT_BOUNDS_EQUAL_EPS_DEG &&
    Math.abs(a.minLon - b.minLon) < VIEWPORT_BOUNDS_EQUAL_EPS_DEG &&
    Math.abs(a.maxLon - b.maxLon) < VIEWPORT_BOUNDS_EQUAL_EPS_DEG &&
    a.crossesAntimeridian === b.crossesAntimeridian &&
    a.allLongitudes === b.allLongitudes
  )
}

export function isAircraftInsideViewport(
  state: RichAircraftState,
  bounds: ViewportBounds | null,
): boolean {
  if (!bounds) return true
  if (state.lat < bounds.minLat || state.lat > bounds.maxLat) return false
  if (bounds.allLongitudes) return true

  const lon = normalizeLonDeg(state.lon)
  return bounds.crossesAntimeridian
    ? lon >= bounds.minLon || lon <= bounds.maxLon
    : lon >= bounds.minLon && lon <= bounds.maxLon
}
