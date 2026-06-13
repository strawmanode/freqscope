import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  VerticalOrigin,
} from 'cesium'
import type { Landmark, LandmarkCategory } from '../types'
import type { RadarThemeId } from './radarThemes'
import { getRadarTheme } from './radarThemes'

const MARKER_SIZE: Record<LandmarkCategory, number> = {
  presidential: 8,
  government: 7,
  military: 7,
  landmark: 6,
}

const LANDMARK_LABEL_FONT = '700 18px Arial, "Helvetica Neue", sans-serif'
const LANDMARK_LABEL_SCALE = 0.62

const markerUriCache = new Map<string, string>()

function getLandmarkSquareUri(fillCss: string, outlineCss: string, pixelSize: number): string {
  const key = `${fillCss}|${outlineCss}|${pixelSize}`
  const cached = markerUriCache.get(key)
  if (cached) return cached

  const outline = 2
  const canvasSize = pixelSize + outline * 2
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = outlineCss
  ctx.fillRect(0, 0, canvasSize, canvasSize)
  ctx.fillStyle = fillCss
  ctx.fillRect(outline, outline, pixelSize, pixelSize)
  const uri = canvas.toDataURL()
  markerUriCache.set(key, uri)
  return uri
}

function removeEntitiesWithPrefix(layer: CustomDataSource, prefix: string): void {
  const toRemove = layer.entities.values.filter(
    (e) => e.id && typeof e.id === 'string' && e.id.startsWith(prefix),
  )
  for (const entity of toRemove) {
    layer.entities.remove(entity)
  }
}

export function renderLandmarks(
  layer: CustomDataSource | null,
  landmarks: Landmark[],
  radarTheme: RadarThemeId,
): void {
  if (!layer) return

  removeEntitiesWithPrefix(layer, 'landmark-')

  const theme = getRadarTheme(radarTheme)
  const labelBackground = Color.fromCssColorString(theme.landmarkLabelBackground)
  const labelOutline = Color.fromCssColorString(theme.label.outlineColor)

  for (const lm of landmarks) {
    const css = theme.landmarkColors[lm.category]
    const color = Color.fromCssColorString(css)
    const position = Cartesian3.fromDegrees(lm.lon, lm.lat, 0)
    const markerPx = MARKER_SIZE[lm.category]

    layer.entities.add({
      id: `landmark-marker-${lm.id}`,
      position,
      billboard: {
        image: getLandmarkSquareUri(css, theme.landmarkMarkerOutline, markerPx),
        width: markerPx + 4,
        height: markerPx + 4,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    layer.entities.add({
      id: `landmark-label-${lm.id}`,
      position,
      label: {
        text: lm.name,
        font: LANDMARK_LABEL_FONT,
        scale: LANDMARK_LABEL_SCALE,
        fillColor: color,
        outlineColor: labelOutline,
        outlineWidth: radarTheme === 'modern' ? 4 : 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: labelBackground,
        backgroundPadding: new Cartesian2(6, 4),
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        pixelOffset: new Cartesian2(0, -(markerPx / 2 + 8)),
        distanceDisplayCondition: new DistanceDisplayCondition(0, 90_000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }
}
