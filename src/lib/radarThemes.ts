import type { LandmarkCategory } from '../types'

export type RadarThemeId = 'stars' | 'eram' | 'modern'

/** Landmark hues sit outside aviation semantics (TWR gold, TRACON cyan, emergency red, etc.). */
export type LandmarkColorMap = Record<LandmarkCategory, string>

export const LANDMARK_LEGEND: Array<{ label: string; category: LandmarkCategory }> = [
  { label: 'PRES', category: 'presidential' },
  { label: 'GOV', category: 'government' },
  { label: 'MIL', category: 'military' },
  { label: 'SITE', category: 'landmark' },
]

export const RADAR_THEME_STORAGE_KEY = 'freqscope:radar-theme'

export const RADAR_THEME_OPTIONS: Array<{
  id: RadarThemeId
  label: string
}> = [
  { id: 'stars', label: 'STARS' },
  { id: 'eram', label: 'ERAM' },
  { id: 'modern', label: 'MOD' },
]

export interface RadarTheme {
  id: RadarThemeId
  cesiumBackground: string
  globeBase: string
  imageryUrl: string
  imageryBrightness: number
  imageryContrast: number
  imagerySaturation: number
  rangeRingColor: string
  selectedTrackColor: string
  label: {
    font: string
    scale: number
    outlineColor: string
    outlineWidth: number
    backgroundColor: string
    backgroundPadding: [number, number]
  }
  aircraftColors: {
    twr: string
    tracon: string
    ctr: string
    ctrOutside: string
    gnd: string
    vfr: string
  }
  /** Halo stroked behind aircraft symbols so targets pop above polygon fills. */
  aircraftSymbolHalo: string
  landmarkColors: LandmarkColorMap
  landmarkMarkerOutline: string
  landmarkLabelBackground: string
}

const RADAR_THEMES: Record<RadarThemeId, RadarTheme> = {
  stars: {
    id: 'stars',
    cesiumBackground: '#050a08',
    globeBase: '#050a08',
    imageryUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    imageryBrightness: 1.1,
    imageryContrast: 1.12,
    imagerySaturation: 0.72,
    rangeRingColor: '#3cff86',
    selectedTrackColor: '#ffffff',
    label: {
      font: 'bold 25px "Share Tech Mono", monospace',
      scale: 0.52,
      outlineColor: '#000000',
      outlineWidth: 3,
      backgroundColor: 'rgba(0, 8, 4, 0.18)',
      backgroundPadding: [6, 4],
    },
    aircraftColors: {
      twr: '#ffd966',
      tracon: '#4de8ff',
      ctr: '#dfffea',
      // Solid (not alpha) so targets never blend with polygon fills below;
      // identity comes from a dimmer, desaturated shade instead.
      ctrOutside: '#a8bdb2',
      gnd: '#7b8c86',
      vfr: '#3fc97e',
    },
    aircraftSymbolHalo: 'rgba(0, 0, 0, 0.85)',
    landmarkColors: {
      presidential: '#d946ef',
      government: '#a3e635',
      military: '#ea580c',
      landmark: '#5eead4',
    },
    landmarkMarkerOutline: '#000000',
    landmarkLabelBackground: 'rgba(0, 12, 8, 0.62)',
  },
  eram: {
    id: 'eram',
    cesiumBackground: '#070d12',
    globeBase: '#070d12',
    imageryUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    imageryBrightness: 1,
    imageryContrast: 1,
    imagerySaturation: 0.92,
    rangeRingColor: '#70c7e8',
    selectedTrackColor: '#ffffff',
    label: {
      font: 'bold 24px "Share Tech Mono", monospace',
      scale: 0.5,
      outlineColor: '#000000',
      outlineWidth: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.01)',
      backgroundPadding: [6, 4],
    },
    aircraftColors: {
      twr: '#ffc86a',
      tracon: '#70c7e8',
      ctr: '#dbeef5',
      ctrOutside: '#92a6ae',
      gnd: '#718793',
      vfr: '#52a8c9',
    },
    aircraftSymbolHalo: 'rgba(0, 0, 0, 0.85)',
    landmarkColors: {
      presidential: '#e879f9',
      government: '#84cc16',
      military: '#c2410c',
      landmark: '#2dd4bf',
    },
    landmarkMarkerOutline: '#000000',
    landmarkLabelBackground: 'rgba(0, 10, 18, 0.58)',
  },
  modern: {
    id: 'modern',
    cesiumBackground: '#b3bcc0',
    globeBase: '#b3bcc0',
    imageryUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    imageryBrightness: 0.68,
    imageryContrast: 0.9,
    imagerySaturation: 0.25,
    rangeRingColor: '#3f6573',
    selectedTrackColor: '#000000',
    label: {
      font: '800 27px Arial, "Helvetica Neue", sans-serif',
      scale: 0.58,
      outlineColor: '#eef6f8',
      outlineWidth: 4,
      backgroundColor: 'rgba(232, 241, 244, 0.56)',
      backgroundPadding: [7, 5],
    },
    aircraftColors: {
      twr: '#7a4b00',
      tracon: '#005d78',
      ctr: '#1f2f37',
      ctrOutside: '#6b7d85',
      gnd: '#4f5e64',
      vfr: '#2e6f4c',
    },
    aircraftSymbolHalo: 'rgba(245, 250, 252, 0.9)',
    landmarkColors: {
      presidential: '#86198f',
      government: '#4d7c0f',
      military: '#9a3412',
      landmark: '#0f766e',
    },
    landmarkMarkerOutline: '#ffffff',
    landmarkLabelBackground: 'rgba(232, 241, 244, 0.82)',
  },
}

export function isRadarThemeId(value: unknown): value is RadarThemeId {
  return value === 'stars' || value === 'eram' || value === 'modern'
}

export function getRadarTheme(id: RadarThemeId): RadarTheme {
  return RADAR_THEMES[id]
}

export function getLandmarkColor(themeId: RadarThemeId, category: LandmarkCategory): string {
  return getRadarTheme(themeId).landmarkColors[category]
}
