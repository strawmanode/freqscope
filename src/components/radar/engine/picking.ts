import {
  Cartesian2,
  Cartesian3,
  SceneTransforms,
  defined,
  type Scene,
} from 'cesium'
import type { RichAircraftState } from '../../../types/aircraft'
import type { DrPosition } from '../../../lib/deadReckoning'
import {
  BILLBOARD_PICK_HIT_PAD_PX,
  DIRECT_ICON_CLICK_PX,
  ICON_CLUSTER_TIE_PX,
  ICON_PICK_PRIORITY_BIAS_PX,
  ICON_RADIUS_PX,
  LABEL_ICON_PROXIMITY_BIAS_PX,
  MAX_ICON_PICK_DISTANCE_PX,
  MAX_LABEL_PICK_DISTANCE_PX,
  MODEL_ICON_HIT_PAD_PX,
  MODEL_ICON_RADIUS_PX,
} from '../constants'
import {
  buildNearbyLabelSet,
  clickInsideLabelBox,
  computeLabelPixelOffset,
  getLabelHitBounds,
} from '../domain/labels'
import { aircraftUses3DModel } from '../domain/tracks'
import { scopeHeightM } from '../domain/trails'

export function isNonAircraftEntityId(id: string): boolean {
  return (
    id.startsWith('twr-') ||
    id.startsWith('class-b-') ||
    id.startsWith('tracon-') ||
    id.startsWith('artcc-') ||
    id.startsWith('sua-') ||
    id.startsWith('airport-') ||
    id.startsWith('landmark-') ||
    id.startsWith('trail-dot-') ||
    id.startsWith('leader-') ||
    id.startsWith('jring-') ||
    id.startsWith('range-ring') ||
    id === 'selection-ring'
  )
}

function pickDistanceToAircraft(
  click: Cartesian2,
  screenPos: Cartesian2,
  labelOffset: Cartesian2,
  state: RichAircraftState,
  iconRadiusPx: number,
  iconHitPadPx: number,
  includeLabel: boolean,
): number {
  const iconDist = Math.hypot(click.x - screenPos.x, click.y - screenPos.y)

  if (includeLabel) {
    const { left, top, right, bottom } = getLabelHitBounds(
      screenPos,
      labelOffset,
      state,
      iconRadiusPx,
    )
    if (click.x >= left && click.x <= right && click.y >= top && click.y <= bottom) {
      const labelCenterX = left + (right - left) / 2
      const labelCenterY = top + (bottom - top) / 2
      return Math.hypot(click.x - labelCenterX, click.y - labelCenterY)
    }
  }

  if (iconDist <= iconRadiusPx + iconHitPadPx) return ICON_PICK_PRIORITY_BIAS_PX + iconDist
  return Infinity
}

/** On-screen position of a target, honoring its dead-reckoned display position. */
export function displayWorldPos(
  state: RichAircraftState,
  elevationFt: number,
  drPositions?: Map<string, DrPosition>,
): Cartesian3 {
  const dr = drPositions?.get(state.icao24)
  return Cartesian3.fromDegrees(
    dr?.lon ?? state.lon,
    dr?.lat ?? state.lat,
    scopeHeightM(dr?.altitudeFt ?? state.altitudeFt, elevationFt),
  )
}

export function screenIconDistanceToAircraft(
  scene: Scene,
  click: Cartesian2,
  state: RichAircraftState,
  elevationFt: number,
  drPositions?: Map<string, DrPosition>,
): number | null {
  const worldPos = displayWorldPos(state, elevationFt, drPositions)
  const windowPos = SceneTransforms.worldToWindowCoordinates(scene, worldPos)
  if (!defined(windowPos)) return null
  const canvasRect = scene.canvas.getBoundingClientRect()
  const screenX = windowPos.x - canvasRect.left
  const screenY = windowPos.y - canvasRect.top
  return Math.hypot(click.x - screenX, click.y - screenY)
}

function maxPickDistanceForDist(dist: number): number {
  return dist >= ICON_PICK_PRIORITY_BIAS_PX
    ? MAX_ICON_PICK_DISTANCE_PX
    : MAX_LABEL_PICK_DISTANCE_PX
}

export function findAircraftAtClick(
  scene: Scene,
  click: Cartesian2,
  visibleStates: RichAircraftState[],
  camAltM: number,
  includeLabels: boolean,
  labelNearbyStates: RichAircraftState[],
  elevationFt: number,
  labelOffsetsByIcao?: Map<string, Cartesian2>,
  drPositions?: Map<string, DrPosition>,
): { match: RichAircraftState | null; closestPx: number } {
  let best: RichAircraftState | null = null
  let bestDist = MAX_ICON_PICK_DISTANCE_PX + 1
  let bestIconDist = Infinity
  let bestClickInLabel = false
  let closestPx = Infinity
  const nearbyLabelSet = includeLabels ? buildNearbyLabelSet(labelNearbyStates) : new Set<string>()
  const canvasRect = scene.canvas.getBoundingClientRect()

  for (const state of visibleStates) {
    const worldPos = displayWorldPos(state, elevationFt, drPositions)
    const windowPos = SceneTransforms.worldToWindowCoordinates(scene, worldPos)
    if (!defined(windowPos)) continue
    const screenPos = new Cartesian2(
      windowPos.x - canvasRect.left,
      windowPos.y - canvasRect.top,
    )

    const iconDist = Math.hypot(click.x - screenPos.x, click.y - screenPos.y)
    if (iconDist < closestPx) closestPx = iconDist

    const has3DModel = aircraftUses3DModel(state, camAltM)
    const iconRadiusPx = has3DModel ? MODEL_ICON_RADIUS_PX : ICON_RADIUS_PX
    const iconHitPadPx = has3DModel ? MODEL_ICON_HIT_PAD_PX : BILLBOARD_PICK_HIT_PAD_PX
    const labelOffset = includeLabels
      ? (labelOffsetsByIcao?.get(state.icao24) ??
        computeLabelPixelOffset(state.icao24, nearbyLabelSet, has3DModel))
      : new Cartesian2(0, 0)
    const dist = pickDistanceToAircraft(
      click,
      screenPos,
      labelOffset,
      state,
      iconRadiusPx,
      iconHitPadPx,
      includeLabels,
    )

    if (dist <= maxPickDistanceForDist(dist)) {
      const clickInLabel =
        includeLabels &&
        clickInsideLabelBox(click, screenPos, labelOffset, state, iconRadiusPx)
      const candidateDirectIcon = iconDist <= DIRECT_ICON_CLICK_PX
      const bestDirectIcon = bestIconDist <= DIRECT_ICON_CLICK_PX
      const bothLabelHits =
        includeLabels &&
        dist < MAX_LABEL_PICK_DISTANCE_PX &&
        bestDist < MAX_LABEL_PICK_DISTANCE_PX
      let replace = false
      if (!best) {
        replace = true
      } else if (candidateDirectIcon && !bestDirectIcon) {
        replace = true
      } else if (candidateDirectIcon && bestDirectIcon) {
        replace = iconDist < bestIconDist
      } else if (bestDirectIcon) {
        replace = false
      } else if (bothLabelHits && iconDist + LABEL_ICON_PROXIMITY_BIAS_PX < bestIconDist) {
        replace = true
      } else if (dist < bestDist) {
        replace = true
      } else if (dist === bestDist && iconDist < bestIconDist) {
        replace = true
      } else if (
        includeLabels &&
        dist >= ICON_PICK_PRIORITY_BIAS_PX &&
        bestDist >= ICON_PICK_PRIORITY_BIAS_PX &&
        Math.abs(iconDist - bestIconDist) <= ICON_CLUSTER_TIE_PX &&
        clickInLabel &&
        !bestClickInLabel
      ) {
        replace = true
      }
      if (replace) {
        bestDist = dist
        bestIconDist = iconDist
        bestClickInLabel = clickInLabel
        best = state
      }
    }
  }

  return {
    match: best,
    closestPx: closestPx === Infinity ? -1 : closestPx,
  }
}
