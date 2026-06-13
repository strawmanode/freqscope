import {
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  VerticalOrigin,
} from 'cesium'
import type { Airport, RunwaysByIcao } from '../types'
import type { RadarThemeId } from './radarThemes'
import { getAirspacePalette } from './airspacePalette'
import runwaysData from '../data/runways.json'

const allRunways = runwaysData as unknown as RunwaysByIcao

export function renderRunways(
  layer: CustomDataSource | null,
  airport: Airport,
  activeEnds: Set<string>,
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  const rwyPalette = getAirspacePalette(themeId).runway

  layer.entities.removeAll()

  const runways = allRunways[airport.icao]
  if (!runways || runways.length === 0) return

  const hasActiveInfo = activeEnds.size > 0

  for (const rwy of runways) {
    const [endA, endB] = rwy.ends
    const lineActive =
      hasActiveInfo &&
      (activeEnds.has(endA.name) || activeEnds.has(endB.name))

    layer.entities.add({
      id: `rwy-line-${airport.icao}-${rwy.id}`,
      polyline: {
        positions: [
          Cartesian3.fromDegrees(endA.lon, endA.lat, 0),
          Cartesian3.fromDegrees(endB.lon, endB.lat, 0),
        ],
        width: lineActive ? 3 : 1.5,
        material: lineActive
          ? Color.fromCssColorString(rwyPalette.lineColor).withAlpha(rwyPalette.activeLineAlpha)
          : Color.fromCssColorString(rwyPalette.lineColor).withAlpha(rwyPalette.lineAlpha),
        clampToGround: true,
      },
    })

    for (const end of rwy.ends) {
      const isActive = hasActiveInfo && activeEnds.has(end.name)
      const landingHeadingDeg = (end.heading_deg + 180) % 360
      const landingRad = (landingHeadingDeg * Math.PI) / 180
      const offsetDeg = 0.003
      const labelLat = end.lat + Math.cos(landingRad) * offsetDeg
      const labelLon = end.lon + Math.sin(landingRad) * offsetDeg

      layer.entities.add({
        id: `rwy-label-${airport.icao}-${end.name}`,
        position: Cartesian3.fromDegrees(labelLon, labelLat, 0),
        label: {
          text: end.name,
          font: 'bold 20px "Share Tech Mono", monospace',
          scale: 0.6,
          fillColor: isActive
            ? Color.fromCssColorString(rwyPalette.labelColor)
            : Color.fromCssColorString(rwyPalette.labelColor).withAlpha(0.4),
          outlineColor: Color.fromCssColorString(rwyPalette.labelOutlineColor),
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new DistanceDisplayCondition(0, 300000),
        },
      })

      if (isActive) {
        const arrowLen = 0.002
        const tipLat = end.lat + Math.cos(landingRad) * arrowLen
        const tipLon = end.lon + Math.sin(landingRad) * arrowLen
        layer.entities.add({
          id: `rwy-arrow-${airport.icao}-${end.name}`,
          polyline: {
            positions: [
              Cartesian3.fromDegrees(end.lon, end.lat, 0),
              Cartesian3.fromDegrees(tipLon, tipLat, 0),
            ],
            width: 2.5,
            material: Color.fromCssColorString(rwyPalette.arrowColor).withAlpha(0.9),
            clampToGround: true,
          },
        })
      }
    }
  }
}
