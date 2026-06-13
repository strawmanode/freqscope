import { Color, UrlTemplateImageryProvider, type Viewer } from 'cesium'
import {
  AIRSPACE_LEGEND,
  COLOR_CTR,
  COLOR_CTR_OUTSIDE,
  COLOR_GND,
  COLOR_TRACON,
  COLOR_TWR,
  COLOR_VFR,
} from '../../../lib/airspaceColor'
import { getRadarTheme, type RadarThemeId } from '../../../lib/radarThemes'

function buildImageryProvider(radarTheme: RadarThemeId): UrlTemplateImageryProvider {
  const theme = getRadarTheme(radarTheme)
  return new UrlTemplateImageryProvider({
    url: theme.imageryUrl,
    subdomains: ['a', 'b', 'c', 'd'],
    maximumLevel: 19,
    credit: '© OpenStreetMap © CARTO',
  })
}

export function applyRadarTheme(viewer: Viewer, radarTheme: RadarThemeId): void {
  const theme = getRadarTheme(radarTheme)
  viewer.imageryLayers.removeAll()
  const imageryLayer = viewer.imageryLayers.addImageryProvider(buildImageryProvider(radarTheme))
  imageryLayer.brightness = theme.imageryBrightness
  imageryLayer.contrast = theme.imageryContrast
  imageryLayer.saturation = theme.imagerySaturation
  viewer.scene.globe.baseColor = Color.fromCssColorString(theme.globeBase)
  viewer.scene.backgroundColor = Color.fromCssColorString(theme.cesiumBackground)
}

export function themedAirspaceColor(color: string, radarTheme: RadarThemeId): string {
  const theme = getRadarTheme(radarTheme)
  if (color === COLOR_TWR) return theme.aircraftColors.twr
  if (color === COLOR_TRACON) return theme.aircraftColors.tracon
  if (color === COLOR_CTR) return theme.aircraftColors.ctr
  if (color === COLOR_CTR_OUTSIDE) return theme.aircraftColors.ctrOutside
  if (color === COLOR_GND) return theme.aircraftColors.gnd
  if (color === COLOR_VFR) return theme.aircraftColors.vfr
  return color
}

export function tfrLegendLabel(type: string): string {
  const normalized = type.toUpperCase()
  if (normalized.includes('VIP')) return 'TFR VIP'
  if (normalized.includes('SECURITY')) return 'TFR SEC'
  if (normalized.includes('SPACE')) return 'TFR SPACE'
  if (normalized.includes('HAZARD')) return 'TFR HAZ'
  if (normalized.includes('AIR SHOW')) return 'TFR AIRSHOW'
  if (normalized.includes('SPORT')) return 'TFR SPORT'
  return 'TFR'
}

export function themedAirspaceLegend(
  radarTheme: RadarThemeId,
): Array<{ label: string; color: string }> {
  return AIRSPACE_LEGEND.map((item) => ({
    ...item,
    color: themedAirspaceColor(item.color, radarTheme),
  }))
}
