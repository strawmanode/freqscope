import { Cartesian2 } from 'cesium'
import type { RichAircraftState } from '../../../types/aircraft'
import {
  LABEL_CHAR_WIDTH_PX,
  LABEL_HIT_LEFT_PAD_PX,
  LABEL_HIT_PAD_PX,
  LABEL_LINE_HEIGHT_PX,
  LABEL_PADDING_PX,
  MODEL_LABEL_OFFSET_X,
  MODEL_LABEL_OFFSET_Y,
} from '../constants'
import { emergencyAlertCode, formatDataLine2, formatDataLine3 } from './datablock'

const LABEL_NEARBY_DEGREES = 0.05

function labelBucketKey(lat: number, lon: number): string {
  return `${Math.floor(lat / LABEL_NEARBY_DEGREES)}:${Math.floor(lon / LABEL_NEARBY_DEGREES)}`
}

export function buildNearbyLabelSet(states: RichAircraftState[]): Set<string> {
  const buckets = new Map<string, RichAircraftState[]>()
  const nearbyIcaos = new Set<string>()

  for (const state of states) {
    const latBucket = Math.floor(state.lat / LABEL_NEARBY_DEGREES)
    const lonBucket = Math.floor(state.lon / LABEL_NEARBY_DEGREES)

    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset += 1) {
        const bucket = buckets.get(`${latBucket + latOffset}:${lonBucket + lonOffset}`)
        if (!bucket) continue

        for (const otherState of bucket) {
          if (
            Math.abs(otherState.lat - state.lat) < LABEL_NEARBY_DEGREES &&
            Math.abs(otherState.lon - state.lon) < LABEL_NEARBY_DEGREES
          ) {
            nearbyIcaos.add(state.icao24)
            nearbyIcaos.add(otherState.icao24)
          }
        }
      }
    }

    const key = labelBucketKey(state.lat, state.lon)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(state)
    } else {
      buckets.set(key, [state])
    }
  }

  return nearbyIcaos
}

export function computeLabelOffset(
  icao: string,
  hasNearbyAircraft: boolean,
): Cartesian2 {
  const defaultX = 8
  const defaultY = -4

  if (!hasNearbyAircraft) return new Cartesian2(defaultX, defaultY)

  // Shift label to avoid overlap — alternate above/below based on icao hash
  const hash = icao.charCodeAt(0) + icao.charCodeAt(icao.length - 1)
  const shiftUp = hash % 2 === 0
  return new Cartesian2(defaultX, shiftUp ? -28 : 12)
}

export function computeLabelPixelOffset(
  icao: string,
  nearbyLabelSet: Set<string>,
  has3DModel: boolean,
): Cartesian2 {
  const base = computeLabelOffset(icao, nearbyLabelSet.has(icao))
  return has3DModel
    ? new Cartesian2(base.x + MODEL_LABEL_OFFSET_X, base.y + MODEL_LABEL_OFFSET_Y)
    : base
}

export function getLabelAnchor(
  screenPos: Cartesian2,
  labelOffset: Cartesian2,
): { x: number; y: number } {
  return {
    x: screenPos.x + labelOffset.x,
    y: screenPos.y + labelOffset.y,
  }
}

export function getLabelDimensions(state: RichAircraftState): { width: number; height: number } {
  const callsign = (state.callsign ?? '').trim() || '—'
  const line2 = formatDataLine2(state)
  const line3 = formatDataLine3(state)
  // Timeshared block is 2 lines (3 with the emergency alert line); use the
  // widest phase so the hit box stays stable across flips
  const lineCount = emergencyAlertCode(state) ? 3 : 2
  const maxChars = Math.max(callsign.length, line2.length, line3.length)
  const width = Math.min(120, maxChars * LABEL_CHAR_WIDTH_PX + LABEL_PADDING_PX * 2)
  const height = lineCount * LABEL_LINE_HEIGHT_PX + LABEL_PADDING_PX
  return { width, height }
}

export function getLabelHitBounds(
  screenPos: Cartesian2,
  labelOffset: Cartesian2,
  state: RichAircraftState,
  iconRadiusPx: number,
): { left: number; top: number; right: number; bottom: number } {
  const { width, height } = getLabelDimensions(state)
  const { x: labelX, y: labelY } = getLabelAnchor(screenPos, labelOffset)
  const pad = LABEL_HIT_PAD_PX
  const left = labelX - pad - LABEL_HIT_LEFT_PAD_PX
  const top = labelY - height - pad
  const right = labelX + width + pad
  const bottom =
    labelOffset.y < -10
      ? screenPos.y + iconRadiusPx + pad
      : labelY + pad
  return { left, top, right, bottom }
}

export function clickInsideLabelBox(
  click: Cartesian2,
  screenPos: Cartesian2,
  labelOffset: Cartesian2,
  state: RichAircraftState,
  iconRadiusPx: number,
): boolean {
  const { left, top, right, bottom } = getLabelHitBounds(
    screenPos,
    labelOffset,
    state,
    iconRadiusPx,
  )
  return click.x >= left && click.x <= right && click.y >= top && click.y <= bottom
}
