import { Cartesian3 } from 'cesium'
import { isSafari } from '../../../lib/browser'
import { NM_TO_METERS } from '../constants'

export function cesiumResolutionScale(): number {
  if (isSafari()) return Math.min(window.devicePixelRatio, 1.5)
  // Full DPR on 3x+ displays costs ~2x the GPU of 2x for little visible gain
  return Math.min(window.devicePixelRatio, 2)
}

/**
 * Compute camera altitude in meters for a given range in NM.
 * The 2.2 multiplier is calibrated for Cesium's default 60° FOV on a
 * roughly square radar scope viewport, with ~10% padding so the outermost
 * ring never clips the viewport edge.
 */
export function rangeNmToAltitudeM(nm: number): number {
  return nm * NM_TO_METERS * 2.2
}

export function getTiltedCameraDestination(lon: number, lat: number, altitudeM: number): Cartesian3 {
  const camAlt = altitudeM * 0.264
  const offsetDeg = (camAlt * 1.075) / 111320
  return Cartesian3.fromDegrees(lon, lat - offsetDeg, camAlt)
}
