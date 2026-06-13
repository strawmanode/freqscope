import {
  ArcType,
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  HeightReference,
  LabelStyle,
  type Entity,
} from 'cesium'
import type { Airport } from '../types'

const NM_TO_METERS = 1852

/** Fixed ring radii like a real scope's J-rings; subtle enough to stay on at any range. */
export const RANGE_RING_RADII_NM = [5, 10, 20, 40, 80]
export const SELECTION_RING_ID = 'selection-ring'

const leaderLinePositions = new WeakMap<Entity, Cartesian3[]>()

export function renderRangeRings(
  layer: CustomDataSource | null,
  airport: Airport,
  color = '#00ff88',
): void {
  if (!layer) return

  const stale = layer.entities.values.filter(
    (e) => typeof e.id === 'string' && e.id.startsWith('range-ring'),
  )
  for (const e of stale) layer.entities.remove(e)

  const ringColor = Color.fromCssColorString(color)
  for (const nm of RANGE_RING_RADII_NM) {
    layer.entities.add({
      id: `range-ring-${nm}`,
      position: Cartesian3.fromDegrees(airport.lon, airport.lat),
      ellipse: {
        semiMajorAxis: nm * NM_TO_METERS,
        semiMinorAxis: nm * NM_TO_METERS,
        height: 0,
        fill: false,
        outline: true,
        outlineColor: ringColor.withAlpha(0.25),
        outlineWidth: 1,
      },
    })
    layer.entities.add({
      id: `range-ring-label-${nm}`,
      // Label sits on the ring's north edge: 1° latitude ≈ 60 nm
      position: Cartesian3.fromDegrees(airport.lon, airport.lat + nm / 60, 0),
      label: {
        text: `${nm} NM`,
        font: '24px "Share Tech Mono", monospace',
        scale: 0.4,
        fillColor: ringColor.withAlpha(0.5),
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        // Hide each label once its ring is small on screen — the inner
        // "5 NM"/"10 NM" tags read as noise at wide ranges
        distanceDisplayCondition: new DistanceDisplayCondition(
          0,
          Math.max(100_000, nm * NM_TO_METERS * 10),
        ),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }
}

let selectionBracketsUri: string | null = null

/** STARS-style corner brackets boxing the selected target. */
function getSelectionBracketsUri(): string {
  if (selectionBracketsUri) return selectionBracketsUri
  const size = 48
  const inset = 6
  const arm = 12
  const max = size - inset
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'square'
  ctx.beginPath()
  // top-left
  ctx.moveTo(inset, inset + arm)
  ctx.lineTo(inset, inset)
  ctx.lineTo(inset + arm, inset)
  // top-right
  ctx.moveTo(max - arm, inset)
  ctx.lineTo(max, inset)
  ctx.lineTo(max, inset + arm)
  // bottom-right
  ctx.moveTo(max, max - arm)
  ctx.lineTo(max, max)
  ctx.lineTo(max - arm, max)
  // bottom-left
  ctx.moveTo(inset + arm, max)
  ctx.lineTo(inset, max)
  ctx.lineTo(inset, max - arm)
  ctx.stroke()
  selectionBracketsUri = canvas.toDataURL()
  return selectionBracketsUri
}

/** Show the selection brackets at `position`, or remove them when `position` is null. */
export function updateSelectionRing(
  layer: CustomDataSource | null,
  position: Cartesian3 | null,
): void {
  if (!layer) return
  const existing = layer.entities.getById(SELECTION_RING_ID)

  if (!position) {
    if (existing) layer.entities.remove(existing)
    return
  }

  if (existing) {
    if (existing.position instanceof ConstantPositionProperty) {
      existing.position.setValue(position)
    } else {
      existing.position = new ConstantPositionProperty(position)
    }
    return
  }

  layer.entities.add({
    id: SELECTION_RING_ID,
    position,
    billboard: {
      image: getSelectionBracketsUri(),
      // Larger than both the 24px triangles and the 32px-floor 3D models so
      // the brackets always frame the target instead of hiding behind it
      width: 44,
      height: 44,
      heightReference: HeightReference.NONE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

/** STARS-style J-ring: a fixed-radius separation halo drawn around a target. */
export function upsertJRing(
  layer: CustomDataSource,
  id: string,
  centerLon: number,
  centerLat: number,
  altitudeM: number,
  radiusNm: number,
  color: Color,
): void {
  const position = Cartesian3.fromDegrees(centerLon, centerLat, altitudeM)
  const radiusM = radiusNm * NM_TO_METERS
  const existing = layer.entities.getById(id)

  if (existing?.ellipse) {
    if (existing.position instanceof ConstantPositionProperty) {
      existing.position.setValue(position)
    } else {
      existing.position = new ConstantPositionProperty(position)
    }
    existing.ellipse.height = new ConstantProperty(altitudeM)
    existing.ellipse.semiMajorAxis = new ConstantProperty(radiusM)
    existing.ellipse.semiMinorAxis = new ConstantProperty(radiusM)
    existing.ellipse.outlineColor = new ConstantProperty(color)
    return
  }

  layer.entities.add({
    id,
    position,
    ellipse: {
      semiMajorAxis: radiusM,
      semiMinorAxis: radiusM,
      height: altitudeM,
      fill: false,
      outline: true,
      outlineColor: color,
      outlineWidth: 1.5,
    },
  })
}

/** Predicted-track vector from the target's nose; updated in place each poll. */
export function upsertLeaderLine(
  layer: CustomDataSource,
  id: string,
  start: Cartesian3,
  end: Cartesian3,
  color: Color,
  width: number,
): void {
  const positions = [start, end]
  const existing = layer.entities.getById(id)
  if (existing?.polyline) {
    updateLeaderLinePositions(layer, id, start, end)
    existing.polyline.material = new ColorMaterialProperty(color)
    existing.polyline.width = new ConstantProperty(width)
    return
  }

  const entity: Entity = layer.entities.add({
    id,
    polyline: {
      positions: new CallbackProperty(
        () => leaderLinePositions.get(entity) ?? positions,
        false,
      ),
      width,
      arcType: ArcType.NONE,
      material: new ColorMaterialProperty(color),
    },
  })
  leaderLinePositions.set(entity, positions)
}

/** Move an existing leader segment without retinting. */
export function updateLeaderLinePositions(
  layer: CustomDataSource,
  id: string,
  start: Cartesian3,
  end: Cartesian3,
): void {
  const existing = layer.entities.getById(id)
  if (!existing?.polyline) return
  const positions = [start, end]
  leaderLinePositions.set(existing, positions)
  if (!(existing.polyline.positions instanceof CallbackProperty)) {
    existing.polyline.positions = new CallbackProperty(
      () => leaderLinePositions.get(existing) ?? positions,
      false,
    )
  }
}
