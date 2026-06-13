import { CallbackProperty, Cartesian3, Color, ColorMaterialProperty, CustomDataSource } from 'cesium'
import type { Airport } from '../types'
import type { AirspaceConfig, ArtccStratum, ClassBTier } from './airspace'
import type { SpecialUseAirspace, SpecialUseAirspaceType } from './sua'
import type { TemporaryFlightRestriction } from './tfr'
import type { AnimationPreset } from './airspaceAnimationPresets'
import type { RadarThemeId } from './radarThemes'
import { getAirspacePalette, getTfrColor } from './airspacePalette'

function pulsingColor(hex: string, minAlpha: number, maxAlpha: number, periodMs: number, phaseOffset = 0): CallbackProperty {
  const base = Color.fromCssColorString(hex)
  const scratch = new Color()
  return new CallbackProperty(() => {
    const t = (Math.sin(((Date.now() / periodMs) + phaseOffset) * Math.PI * 2) + 1) / 2
    const alpha = minAlpha + t * (maxAlpha - minAlpha)
    return base.withAlpha(alpha, scratch)
  }, false)
}

function shimmerColor(hex: string, minAlpha: number, maxAlpha: number, periodMs: number, phaseOffset = 0): CallbackProperty {
  const base = Color.fromCssColorString(hex)
  const scratch = new Color()
  return new CallbackProperty(() => {
    const t = (Math.sin(((Date.now() / (periodMs * 0.2)) + phaseOffset) * Math.PI * 2) + 1) / 2
    const alpha = minAlpha + t * (maxAlpha - minAlpha) * 0.4
    return base.withAlpha(alpha, scratch)
  }, false)
}

function strobeColor(hex: string, minAlpha: number, maxAlpha: number, periodMs: number, phaseOffset = 0): CallbackProperty {
  const base = Color.fromCssColorString(hex)
  const scratch = new Color()
  return new CallbackProperty(() => {
    const on = Math.round((Math.sin(((Date.now() / periodMs) + phaseOffset) * Math.PI * 2) + 1) / 2)
    const alpha = on ? maxAlpha : minAlpha
    return base.withAlpha(alpha, scratch)
  }, false)
}

function scanColor(hex: string, minAlpha: number, maxAlpha: number, periodMs: number, phaseOffset = 0): CallbackProperty {
  const base = Color.fromCssColorString(hex)
  const scratch = new Color()
  return new CallbackProperty(() => {
    const t = (Math.sin(((Date.now() / periodMs) + phaseOffset) * Math.PI * 2) + 1) / 2
    const alpha = minAlpha + t * (maxAlpha - minAlpha)
    return base.withAlpha(alpha, scratch)
  }, false)
}

function shiftColor(minAlpha: number, maxAlpha: number, periodMs: number, phaseOffset = 0): CallbackProperty {
  const stops = [
    Color.fromCssColorString('#ffe600'),
    Color.fromCssColorString('#00aaff'),
    Color.fromCssColorString('#aa00ff'),
  ]
  const scratch = new Color()

  return new CallbackProperty(() => {
    const t = ((Date.now() / periodMs) + phaseOffset) % 1
    const scaled = t * stops.length
    const i = Math.floor(scaled)
    const frac = scaled - i
    const a = stops[i % stops.length]
    const b = stops[(i + 1) % stops.length]
    const alpha = minAlpha + ((Math.sin(t * Math.PI * 2) + 1) / 2) * (maxAlpha - minAlpha)
    return Color.lerp(a, b, frac, scratch).withAlpha(alpha, scratch)
  }, false)
}

function getOutlineColor(
  hex: string,
  minAlpha: number,
  maxAlpha: number,
  periodMs: number,
  phaseOffset: number,
  preset: AnimationPreset,
): Color | CallbackProperty {
  switch (preset) {
    case 'static':
      return Color.fromCssColorString(hex).withAlpha((minAlpha + maxAlpha) / 2)
    case 'pulse':
      return pulsingColor(hex, minAlpha, maxAlpha, periodMs, phaseOffset)
    case 'shimmer':
      return shimmerColor(hex, minAlpha, maxAlpha, periodMs, phaseOffset)
    case 'strobe':
      return strobeColor(hex, minAlpha, maxAlpha, 400, phaseOffset)
    case 'scan':
      return scanColor(hex, minAlpha, maxAlpha, 2000, phaseOffset)
    case 'shift':
      return shiftColor(minAlpha, maxAlpha, 1800, phaseOffset)
    default:
      return Color.fromCssColorString(hex).withAlpha(maxAlpha)
  }
}

function removeEntitiesWithPrefix(layer: CustomDataSource, prefix: string): void {
  const toRemove = layer.entities.values.filter(
    (e) => e.id && typeof e.id === 'string' && e.id.startsWith(prefix),
  )
  for (const entity of toRemove) {
    layer.entities.remove(entity)
  }
}

function tierFloorM(tier: ClassBTier, airport: Airport): number {
  if (tier.floor_ref === 'SFC') {
    return airport.elevation_ft / 3.28084
  }
  return tier.floor_ft / 3.28084
}

/** MSL (ft) where tower ends and TRACON begins — capped below Class B ceiling. */
function towerTopMslFt(airport: Airport, config: AirspaceConfig): number {
  const aglTopMsl = airport.elevation_ft + config.twr_ceil_ft
  if (config.class === 'B') {
    const traconCeilMsl = config.tracon_ceil_ft
    // High-field Class B (e.g. KDEN): AGL tower top can exceed the MSL Class B cap;
    // twr_ceil_ft then aligns with the inner shelf floor in MSL.
    if (aglTopMsl > traconCeilMsl) {
      return Math.min(config.twr_ceil_ft, traconCeilMsl)
    }
    return Math.min(aglTopMsl, traconCeilMsl)
  }
  return aglTopMsl
}

function towerTopM(airport: Airport, config: AirspaceConfig): number {
  return towerTopMslFt(airport, config) / 3.28084
}

/** Class B tracon_ceil_ft is MSL; other classes treat it as AGL above field elevation. */
function traconCeilingM(airport: Airport, config: AirspaceConfig): number {
  if (config.class === 'B') {
    return config.tracon_ceil_ft / 3.28084
  }
  return airport.elevation_ft / 3.28084 + config.tracon_ceil_ft / 3.28084
}

export function renderTowerAirspace(
  layer: CustomDataSource | null,
  airport: Airport,
  config: AirspaceConfig,
  preset: AnimationPreset = 'pulse',
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  const toRemove = layer.entities.values.filter(
    (e) => typeof e.id === 'string' && e.id.startsWith('twr-'),
  )
  for (const e of toRemove) layer.entities.remove(e)

  const elevM = airport.elevation_ft / 3.28084
  const topM = towerTopM(airport, config)
  const heightM = topM - elevM
  if (heightM <= 0) return

  const style = getAirspacePalette(themeId).tower
  const outlineColor = getOutlineColor(
    style.color,
    style.outlineAlphaMin,
    style.outlineAlphaMax,
    3000,
    0,
    preset,
  )
  const fillMaterial = Color.fromCssColorString(style.color).withAlpha(style.fillAlpha)

  if (config.tower_boundary && config.tower_boundary.length > 0) {
    const positions = config.tower_boundary.map(([lat, lon]) =>
      Cartesian3.fromDegrees(lon, lat, elevM),
    )
    layer.entities.add({
      id: `twr-polygon-${airport.icao}`,
      polygon: {
        hierarchy: positions,
        height: elevM,
        extrudedHeight: topM,
        material: fillMaterial,
        outline: true,
        outlineColor,
        outlineWidth: style.outlineWidth,
        perPositionHeight: false,
        closeTop: false,
        closeBottom: false,
      },
    })
  } else {
    const radiusM = config.twr_radius_nm * 1852
    layer.entities.add({
      id: `twr-cylinder-${airport.icao}`,
      position: Cartesian3.fromDegrees(airport.lon, airport.lat, elevM + heightM / 2),
      cylinder: {
        length: heightM,
        topRadius: radiusM,
        bottomRadius: radiusM,
        material: fillMaterial,
        outline: true,
        outlineColor,
        outlineWidth: style.outlineWidth,
        numberOfVerticalLines: 0,
      },
    })
  }
}

export function renderClassBAirspace(
  layer: CustomDataSource | null,
  airport: Airport,
  config: AirspaceConfig,
  preset: AnimationPreset = 'pulse',
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  removeEntitiesWithPrefix(layer, `class-b-${airport.icao}-`)

  removeEntitiesWithPrefix(layer, `tracon-${airport.icao}-`)

  const style = getAirspacePalette(themeId).tracon
  const traconFillMaterial = Color.fromCssColorString(style.color).withAlpha(style.fillAlpha)
  const traconOutlineColor = getOutlineColor(
    style.color,
    style.outlineAlphaMin,
    style.outlineAlphaMax,
    2500,
    0,
    preset,
  )

  if (config.tracon_boundary && config.tracon_boundary.length > 0) {
    const traconFloorM = towerTopM(airport, config)
    const traconCeilM = traconCeilingM(airport, config)
    if (traconCeilM > traconFloorM) {
      const positions = config.tracon_boundary.map(([lat, lon]) =>
        Cartesian3.fromDegrees(lon, lat),
      )
      layer.entities.add({
        id: `tracon-${airport.icao}-polygon`,
        polygon: {
          hierarchy: positions,
          height: traconFloorM,
          extrudedHeight: traconCeilM,
          material: traconFillMaterial,
          outline: true,
          outlineColor: traconOutlineColor,
          outlineWidth: style.outlineWidth,
          closeTop: false,
          closeBottom: true,
        },
      })
    }
    return
  }

  if (!config.class_b?.length) {
    const radiusM = config.tracon_radius_nm * 1852
    const floorM = towerTopM(airport, config)
    const ceilM = traconCeilingM(airport, config)
    if (ceilM <= floorM) {
      console.warn(
        `[airspace] TRACON cylinder skipped for ${airport.icao}: ceilM=${ceilM} <= floorM=${floorM}`,
      )
      return
    }

    const lengthM = ceilM - floorM

    layer.entities.add({
      id: `tracon-${airport.icao}-cylinder`,
      position: Cartesian3.fromDegrees(airport.lon, airport.lat, floorM + lengthM / 2),
      cylinder: {
        length: lengthM,
        topRadius: radiusM,
        bottomRadius: radiusM,
        material: traconFillMaterial,
        outline: true,
        outlineColor: traconOutlineColor,
        outlineWidth: style.outlineWidth,
        numberOfVerticalLines: 0,
      },
    })
    return
  }

  const tiers = config.class_b
  const towerTop = towerTopM(airport, config)
  const traconCeilM = traconCeilingM(airport, config)

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const tierFloor = tierFloorM(tier, airport)
    const floorM = Math.max(tierFloor, towerTop)
    const ceilM = Math.min(tier.ceiling_ft / 3.28084, traconCeilM)
    if (ceilM <= floorM) continue

    const positions = tier.boundary.map(([lat, lon]) =>
      Cartesian3.fromDegrees(lon, lat),
    )

    layer.entities.add({
      id: `class-b-${airport.icao}-${i}`,
      polygon: {
        hierarchy: positions,
        height: floorM,
        extrudedHeight: ceilM,
        material: traconFillMaterial,
        outline: true,
        outlineColor: getOutlineColor(
          style.color,
          style.outlineAlphaMin,
          style.outlineAlphaMax,
          2500,
          i / tiers.length,
          preset,
        ),
        outlineWidth: style.outlineWidth,
        closeTop: false,
        closeBottom: true,
      },
    })
  }
}

export function renderArtccAirspace(
  layer: CustomDataSource | null,
  artccStrata: ArtccStratum[],
  identifier: string,
  preset: AnimationPreset = 'pulse',
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  const toRemove = layer.entities.values.filter(
    (e) => typeof e.id === 'string' && e.id.startsWith('artcc-'),
  )
  for (const e of toRemove) layer.entities.remove(e)

  const palette = getAirspacePalette(themeId)

  layer.entities.suspendEvents()
  for (let i = 0; i < artccStrata.length; i++) {
    const stratum = artccStrata[i]
    const floorM = stratum.floor_ft / 3.28084
    const isHigh = stratum.stratum === 'HIGH'
    const style = isHigh ? palette.artccHigh : palette.artccLow

    const positions = stratum.boundary.map(([lat, lon]) =>
      Cartesian3.fromDegrees(lon, lat, floorM),
    )
    const closedPositions =
      positions.length > 0 ? [...positions, positions[0]] : positions

    layer.entities.add({
      id: `artcc-${identifier}-${stratum.stratum}-${i}`,
      polyline: {
        positions: closedPositions,
        width: style.width,
        material: new ColorMaterialProperty(
          getOutlineColor(
            style.color,
            style.alphaMin,
            style.alphaMax,
            isHigh ? 5000 : 4000,
            0,
            preset,
          ),
        ),
      },
    })
  }
  layer.entities.resumeEvents()
}

const SUA_CEILING_CAP_FT = 60000

function suaFloorM(sua: SpecialUseAirspace): number {
  if (sua.floor_ref === 'SFC') return 0
  return sua.floor_ft / 3.28084
}

function suaCeilingM(sua: SpecialUseAirspace): number {
  const ceilFt = Math.min(sua.ceiling_ft, SUA_CEILING_CAP_FT)
  return ceilFt / 3.28084
}

function sanitizeSuaId(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_-]/g, '_')
}

const SUA_PREFIXES: Record<SpecialUseAirspaceType, string> = {
  MOA: 'sua-moa',
  RESTRICTED: 'sua-r',
  WARNING: 'sua-w',
  ALERT: 'sua-a',
}

export interface SuaLayerVisibility {
  moa: boolean
  restricted: boolean
  warning: boolean
  alert: boolean
}

export function renderSuaAirspace(
  layer: CustomDataSource | null,
  areas: SpecialUseAirspace[],
  preset: AnimationPreset = 'pulse',
  visibility: SuaLayerVisibility = {
    moa: true,
    restricted: true,
    warning: true,
    alert: true,
  },
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  const suaPalette = getAirspacePalette(themeId).sua

  const showType: Record<SpecialUseAirspaceType, boolean> = {
    MOA: visibility.moa,
    RESTRICTED: visibility.restricted,
    WARNING: visibility.warning,
    ALERT: visibility.alert,
  }

  layer.entities.suspendEvents()
  removeEntitiesWithPrefix(layer, 'sua-')

  for (let i = 0; i < areas.length; i++) {
    const sua = areas[i]
    if (!showType[sua.type]) continue
    if (!sua.boundary?.length) continue

    const floorM = suaFloorM(sua)
    const ceilM = suaCeilingM(sua)
    if (ceilM <= floorM) continue

    const style = suaPalette[sua.type]
    const id = `${SUA_PREFIXES[sua.type]}-${sanitizeSuaId(sua.identifier)}`

    const positions = sua.boundary.map(([lat, lon]) =>
      Cartesian3.fromDegrees(lon, lat),
    )

    layer.entities.add({
      id,
      polygon: {
        hierarchy: positions,
        height: floorM,
        extrudedHeight: ceilM,
        material: Color.fromCssColorString(style.color).withAlpha(style.fillAlpha),
        outline: true,
        outlineColor: getOutlineColor(
          style.color,
          style.outlineAlphaMin,
          style.outlineAlphaMax,
          3500,
          i / areas.length,
          preset,
        ),
        outlineWidth: style.outlineWidth,
        closeTop: false,
        closeBottom: true,
      },
    })
  }
  layer.entities.resumeEvents()
}

export function renderTfrAirspace(
  layer: CustomDataSource | null,
  areas: TemporaryFlightRestriction[],
  preset: AnimationPreset = 'pulse',
  themeId: RadarThemeId = 'stars',
): void {
  if (!layer) return

  layer.entities.suspendEvents()
  removeEntitiesWithPrefix(layer, 'tfr-')

  const tfrPalette = getAirspacePalette(themeId).tfr
  const entityIds = new Set<string>()
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i]
    if (!area.boundary?.length) continue

    const hex = getTfrColor(area.type, tfrPalette.colors)
    const positions = area.boundary.map(([lat, lon]) =>
      Cartesian3.fromDegrees(lon, lat),
    )
    const baseId = `tfr-${sanitizeSuaId(area.id)}`
    const entityId = entityIds.has(baseId) ? `${baseId}-${i}` : baseId
    entityIds.add(entityId)

    layer.entities.add({
      id: entityId,
      name: `${area.notamId} ${area.type}`,
      description: area.title,
      polygon: {
        hierarchy: positions,
        height: 0,
        material: Color.fromCssColorString(hex).withAlpha(tfrPalette.fillAlpha),
        outline: true,
        outlineColor: getOutlineColor(
          hex,
          tfrPalette.outlineAlphaMin,
          tfrPalette.outlineAlphaMax,
          2600,
          i / areas.length,
          preset,
        ),
        outlineWidth: tfrPalette.outlineWidth,
        closeTop: true,
        closeBottom: true,
      },
    })
  }
  layer.entities.resumeEvents()
}
