import type { RadarThemeId } from './radarThemes'
import type { SpecialUseAirspaceType } from './sua'

/**
 * Theme-aware POLYGON palette — deliberately separate from the aircraft
 * palette in radarThemes.ts so background fills never compete with track
 * symbology. Hues stay in the same semantic family as their aircraft
 * counterparts (TRACON cyan-blue) but are shifted darker /
 * deeper so a fill is never mistaken for a target.
 *
 * Design rules:
 * - Fills stay low-alpha; OUTLINES carry category identity (stronger
 *   alpha + width than before), so stacked overlaps don't collapse into
 *   one muddy tint.
 * - Every category gets a distinct hue (≥ ~25° separation in the same
 *   theme): tower lavender, TRACON deep cyan, ARTCC violet, MOA magenta,
 *   RESTRICTED indigo, WARNING orange, ALERT coral, TFR reds/yellow/teal.
 * - TFR HAZARD no longer duplicates SUA WARNING (#ffaa33): HAZARD is now
 *   caution-yellow, WARNING stays orange.
 * - The `modern` (light basemap) variant uses darker, saturated inks and
 *   slightly higher fill alpha so polygons stay readable on white.
 */

export interface PolygonStyle {
  color: string
  fillAlpha: number
  outlineAlphaMin: number
  outlineAlphaMax: number
  outlineWidth: number
}

export interface LineStyle {
  color: string
  width: number
  alphaMin: number
  alphaMax: number
}

export interface TfrPalette {
  fillAlpha: number
  outlineAlphaMin: number
  outlineAlphaMax: number
  outlineWidth: number
  colors: {
    vip: string
    security: string
    space: string
    hazard: string
    airshow: string
    fallback: string
  }
}

export interface RunwayPalette {
  lineColor: string
  lineAlpha: number
  activeLineAlpha: number
  labelColor: string
  labelOutlineColor: string
  arrowColor: string
}

export interface AirspacePalette {
  tower: PolygonStyle
  tracon: PolygonStyle
  artccLow: LineStyle
  artccHigh: LineStyle
  sua: Record<SpecialUseAirspaceType, PolygonStyle>
  tfr: TfrPalette
  runway: RunwayPalette
}

/** Shared by the two dark basemap themes (stars, eram). */
const DARK_PALETTE: AirspacePalette = {
  // Lavender-blue keeps the tower volume away from WARN/Hazard yellows.
  tower: { color: '#b58cff', fillAlpha: 0.07, outlineAlphaMin: 0.45, outlineAlphaMax: 0.85, outlineWidth: 2 },
  // Deep cyan-blue — TRACON aircraft stay light cyan (#4de8ff/#70c7e8);
  // the volume is darker and bluer so targets pop against it.
  tracon: { color: '#0090c2', fillAlpha: 0.05, outlineAlphaMin: 0.40, outlineAlphaMax: 0.75, outlineWidth: 2 },
  artccLow: { color: '#cc66ff', width: 2, alphaMin: 0.35, alphaMax: 0.65 },
  artccHigh: { color: '#9933cc', width: 1.5, alphaMin: 0.20, alphaMax: 0.45 },
  sua: {
    MOA: { color: '#ff47c8', fillAlpha: 0.05, outlineAlphaMin: 0.35, outlineAlphaMax: 0.70, outlineWidth: 1.5 },
    RESTRICTED: { color: '#3d6bff', fillAlpha: 0.07, outlineAlphaMin: 0.40, outlineAlphaMax: 0.75, outlineWidth: 1.5 },
    WARNING: { color: '#ff9d2e', fillAlpha: 0.05, outlineAlphaMin: 0.35, outlineAlphaMax: 0.70, outlineWidth: 1.5 },
    ALERT: { color: '#ff5c47', fillAlpha: 0.05, outlineAlphaMin: 0.35, outlineAlphaMax: 0.70, outlineWidth: 1.5 },
  },
  tfr: {
    fillAlpha: 0.10,
    outlineAlphaMin: 0.50,
    outlineAlphaMax: 0.90,
    outlineWidth: 2.5,
    colors: {
      vip: '#ff2d3a',
      security: '#ff3d77', // red-pink: no longer collides with SUA ALERT coral
      space: '#9d5cff',
      hazard: '#ffe14d', // caution yellow: fixes #ffaa33 duplicate with SUA WARNING
      airshow: '#2ee6b8', // teal: frees cyan exclusively for TRACON
      fallback: '#ff8844',
    },
  },
  runway: {
    lineColor: '#ffffff',
    lineAlpha: 0.35,
    activeLineAlpha: 0.9,
    labelColor: '#ffffff',
    labelOutlineColor: '#000000',
    arrowColor: '#00ff41',
  },
}

/** Light basemap (modern): darker saturated inks, slightly stronger fills. */
const LIGHT_PALETTE: AirspacePalette = {
  tower: { color: '#5b3aa6', fillAlpha: 0.12, outlineAlphaMin: 0.55, outlineAlphaMax: 0.90, outlineWidth: 2 },
  tracon: { color: '#006d99', fillAlpha: 0.08, outlineAlphaMin: 0.50, outlineAlphaMax: 0.85, outlineWidth: 2 },
  artccLow: { color: '#7a1fa2', width: 2, alphaMin: 0.45, alphaMax: 0.75 },
  artccHigh: { color: '#9b59c4', width: 1.5, alphaMin: 0.30, alphaMax: 0.55 },
  sua: {
    MOA: { color: '#c2187a', fillAlpha: 0.08, outlineAlphaMin: 0.45, outlineAlphaMax: 0.80, outlineWidth: 1.5 },
    RESTRICTED: { color: '#1d4ed8', fillAlpha: 0.09, outlineAlphaMin: 0.50, outlineAlphaMax: 0.85, outlineWidth: 1.5 },
    WARNING: { color: '#b35900', fillAlpha: 0.08, outlineAlphaMin: 0.45, outlineAlphaMax: 0.80, outlineWidth: 1.5 },
    ALERT: { color: '#cc3322', fillAlpha: 0.08, outlineAlphaMin: 0.45, outlineAlphaMax: 0.80, outlineWidth: 1.5 },
  },
  tfr: {
    fillAlpha: 0.12,
    outlineAlphaMin: 0.60,
    outlineAlphaMax: 0.95,
    outlineWidth: 2.5,
    colors: {
      vip: '#c41e2d',
      security: '#d61f69',
      space: '#6d28d9',
      hazard: '#a88a00',
      airshow: '#0f9d8a',
      fallback: '#cc5500',
    },
  },
  runway: {
    lineColor: '#26343a',
    lineAlpha: 0.45,
    activeLineAlpha: 0.95,
    labelColor: '#1f2f37',
    labelOutlineColor: '#eef6f8',
    arrowColor: '#1a7f4b',
  },
}

const PALETTES: Record<RadarThemeId, AirspacePalette> = {
  stars: DARK_PALETTE,
  eram: DARK_PALETTE,
  modern: LIGHT_PALETTE,
}

export function getAirspacePalette(themeId: RadarThemeId): AirspacePalette {
  return PALETTES[themeId]
}

export function getTfrColor(type: string, colors: TfrPalette['colors']): string {
  const normalized = type.toUpperCase()
  if (normalized.includes('VIP')) return colors.vip
  if (normalized.includes('SECURITY')) return colors.security
  if (normalized.includes('SPACE')) return colors.space
  if (normalized.includes('HAZARD')) return colors.hazard
  if (normalized.includes('AIR SHOW') || normalized.includes('SPORT')) return colors.airshow
  return colors.fallback
}
