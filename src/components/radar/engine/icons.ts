import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  HeightReference,
  Math as CesiumMath,
  type Viewer,
} from 'cesium'
import type { Airport } from '../../../types'
import { getRadarTheme, type RadarThemeId } from '../../../lib/radarThemes'
import type { AltFilter } from '../types'
import {
  BILLBOARD_SCALE_BY_DISTANCE,
  GROUND_LABEL_DISPLAY_MAX_M,
  GROUND_LABEL_TWR_DISPLAY_MAX_M,
  LABEL_DISPLAY_MAX_M,
} from '../constants'

// Aircraft colors come from a small fixed palette; cache the Color objects
// instead of re-parsing CSS strings for every target on every poll
const colorCache = new Map<string, Color>()

export function cachedColor(css: string): Color {
  let color = colorCache.get(css)
  if (!color) {
    color = Color.fromCssColorString(css)
    colorCache.set(css, color)
  }
  return color
}

export function cachedAlphaColor(base: Color, alpha: number): Color {
  const key = `${base.red},${base.green},${base.blue}@${alpha.toFixed(2)}`
  let color = colorCache.get(key)
  if (!color) {
    color = base.withAlpha(alpha)
    colorCache.set(key, color)
  }
  return color
}

function createAircraftCanvas(
  color: string,
  onGround: boolean,
  haloColor: string,
): HTMLCanvasElement {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.lineJoin = 'round'

  // Wide theme-contrast halo stroked first, then fill over it — leaves a
  // ~1.5px ring so symbols pop above polygon fills of any hue.
  const drawWithHalo = (trace: () => void) => {
    trace()
    ctx.strokeStyle = haloColor
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fill()
  }

  if (onGround) {
    // Small square for ground traffic
    const s = 7
    const x = size / 2 - s / 2
    const y = size / 2 - s / 2
    drawWithHalo(() => {
      ctx.beginPath()
      ctx.rect(x, y, s, s)
    })
  } else {
    // Triangle pointing up (north) — Cesium rotation will handle heading
    const cx = size / 2
    const cy = size / 2
    const r = 7
    drawWithHalo(() => {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)           // tip
      ctx.lineTo(cx - r * 0.65, cy + r * 0.7)  // bottom left
      ctx.lineTo(cx + r * 0.65, cy + r * 0.7)  // bottom right
      ctx.closePath()
    })
  }

  return canvas
}

export function getAircraftBillboardUri(
  color: string,
  onGround: boolean,
  haloColor: string,
  cache: Map<string, string>,
): string {
  const key = `${color}-${onGround}-${haloColor}`
  if (cache.has(key)) return cache.get(key)!
  const canvas = createAircraftCanvas(color, onGround, haloColor)
  const uri = canvas.toDataURL()
  cache.set(key, uri)
  return uri
}

export function aircraftLabelDistanceDisplayCondition(
  onGround: boolean,
  options?: { altFilter?: AltFilter; isSelected?: boolean },
): DistanceDisplayCondition {
  if (onGround) {
    const twrDeclutter =
      options?.altFilter === 'TWR' && !options?.isSelected
    const maxM = twrDeclutter
      ? GROUND_LABEL_TWR_DISPLAY_MAX_M
      : GROUND_LABEL_DISPLAY_MAX_M
    return new DistanceDisplayCondition(0, maxM)
  }
  return new DistanceDisplayCondition(0, LABEL_DISPLAY_MAX_M)
}

export function buildAircraftBillboard(
  color: Color,
  onGround: boolean,
  trackDeg: number | null,
  haloColor: string,
  cache: Map<string, string>,
) {
  return {
    image: getAircraftBillboardUri(color.toCssColorString(), onGround, haloColor, cache),
    rotation: onGround ? 0 : CesiumMath.toRadians(-(trackDeg ?? 0)),
    alignedAxis: Cartesian3.UNIT_Z,
    width: 24,
    height: 24,
    heightReference: HeightReference.NONE,
    scaleByDistance: BILLBOARD_SCALE_BY_DISTANCE,
    distanceDisplayCondition: new DistanceDisplayCondition(0, 10000000),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}

export function upsertTrailDot(
  trailsLayer: CustomDataSource,
  id: string,
  position: Cartesian3,
  pixelSize: number,
  color: Color,
): void {
  const existing = trailsLayer.entities.getById(id)
  if (existing) {
    if (existing.position instanceof ConstantPositionProperty) {
      existing.position.setValue(position)
    } else {
      existing.position = new ConstantPositionProperty(position)
    }
    if (existing.point) {
      if (existing.point.pixelSize instanceof ConstantProperty) {
        existing.point.pixelSize.setValue(pixelSize)
      } else {
        existing.point.pixelSize = new ConstantProperty(pixelSize)
      }
      if (existing.point.color instanceof ConstantProperty) {
        existing.point.color.setValue(color)
      } else {
        existing.point.color = new ConstantProperty(color)
      }
    }
    return
  }

  trailsLayer.entities.add({
    id,
    position,
    point: {
      pixelSize,
      color,
      outlineWidth: 0,
      heightReference: HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

export function addAirportEntity(viewer: Viewer, airport: Airport): void {
  viewer.entities.add({
    id: `airport-${airport.icao}`,
    position: Cartesian3.fromDegrees(airport.lon, airport.lat, 0),
    point: {
      pixelSize: 8,
      color: Color.fromCssColorString('#ffffff'),
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  })
}

export function themedLabelBackground(radarTheme: RadarThemeId): Color {
  return cachedColor(getRadarTheme(radarTheme).label.backgroundColor)
}

export function themedLabelPadding(radarTheme: RadarThemeId): Cartesian2 {
  const [x, y] = getRadarTheme(radarTheme).label.backgroundPadding
  return new Cartesian2(x, y)
}
