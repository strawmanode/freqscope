/**
 * Maps ICAO aircraft type designators (ADS-B `t` field) to glTF/GLB model assets.
 * Only types with a known model are rendered in 3D; everything else keeps billboards.
 *
 * glTF assets primarily from Flightradar24/fr24-3d-models (GPLv2);
 * C172 from BelugaProject-3D-Models / FGMEMBERS c172p-detailed (GPLv2).
 */

export interface AircraftModelDefinition {
  uri: string
  /**
   * Extra yaw applied after track→heading conversion (degrees).
   * Corrects for model nose axis in glTF space; start at 0 and tune per asset.
   */
  headingOffsetDeg: number
  /** Cesium model scale (asset units are meters for FR24/Beluga meshes). */
  scale: number
  /**
   * Minimum on-screen size in pixels. Lower for small GA types so Cesium does not
   * inflate them to the same apparent size as airliners.
   */
  minimumPixelSize: number
}

const DEFAULT_MODEL: Pick<AircraftModelDefinition, 'headingOffsetDeg' | 'scale' | 'minimumPixelSize'> = {
  headingOffsetDeg: 0,
  scale: 1,
  // Floor low enough that models shrink with range instead of dominating the
  // scope at wider views; true scale takes over when the camera is close
  minimumPixelSize: 32,
}

function model(file: string): AircraftModelDefinition {
  return { uri: `/models/aircraft/${file}.glb`, ...DEFAULT_MODEL }
}

const B736 = model('b736')
const B737 = model('b737')
const B738 = model('b738')
const B739 = model('b739')
const B744 = model('b744')
const B748 = model('b748')
const B752 = model('b752')
const B753 = model('b753')
const B762 = model('b762')
const B763 = model('b763')
const B764 = model('b764')
const B772 = model('b772')
const B773 = model('b773')
const B788 = model('b788')
const B789 = model('b789')

const A319 = model('a319')
const A320 = model('a320')
const A332 = model('a332')
const A333 = model('a333')
const A359 = model('a359')
const CRJ9 = model('crj900')
// FGMEMBERS mesh is 180° off Cesium forward (+X); +90° aligns nose with direction of travel.
const C172: AircraftModelDefinition = {
  ...model('c172'),
  minimumPixelSize: 16,
  headingOffsetDeg: 90,
}

/** ICAO type code → model (multiple codes can share one asset). */
const AIRCRAFT_MODEL_BY_TYPE: Record<string, AircraftModelDefinition> = {
  // Airbus A319-100 (CEO)
  A319,
  // Airbus A319neo
  A19N: A319,

  // Airbus A320-200 (CEO)
  A320,
  // Airbus A320neo
  A20N: A320,

  // Airbus A321-100/200 (CEO)
  A321: model('a321'),
  // Airbus A321neo / LR / XLR
  A21N: model('a321'),

  // Airbus A330-200
  A332,
  A338: A332, // A330-800neo (-200 length)

  // Airbus A330-300
  A333,
  A339: A333, // A330-900neo (-300 length)

  // Airbus A350-900
  A359,
  A35K: A359, // A350-1000 (FR24 has -900 model only)

  // Bombardier CRJ-900
  CRJ9,
  CRJX: CRJ9, // CRJ-900 with winglets

  // Cessna 172 Skyhawk (FGMEMBERS C172P mesh)
  C172,
  C72R: C172, // 172RG Cutlass

  // Boeing 737
  B736,
  B737,
  B738,
  B739,
  B37M: B737, // 737 MAX 7
  B38M: B738, // 737 MAX 8
  B39M: B739, // 737 MAX 9
  B3XM: B739, // 737 MAX 10

  // Boeing 747
  B744,
  B748,
  B74S: B744, // 747-400F
  B74R: B744, // 747SR

  // Boeing 757
  B752,
  B753,

  // Boeing 767
  B762,
  B763,
  B764,
  B76F: B763, // 767 freighter

  // Boeing 777
  B772,
  B773,
  B77W: B773, // 777-300ER
  B77L: B772, // 777-200LR
  B77F: B772, // 777 freighter

  // Boeing 787
  B788,
  B789,
  B78X: B789, // 787-10
}

export function aircraftModelHeadingRadians(
  trackDeg: number | null | undefined,
  headingOffsetDeg = 0,
): number {
  const track = trackDeg ?? 0
  // ADS-B track and trail bearing are direction of travel (where the aircraft is going).
  // Cesium heading: 0 = north, clockwise — same convention as ADS-B trackDeg.
  return ((track + headingOffsetDeg) * Math.PI) / 180
}

/** Heading for 3D models: trail-derived direction of travel when available, else ADS-B track. */
export function aircraftModelHeadingFromTrack(
  trackDeg: number | null | undefined,
  derivedTrackDeg: number | null | undefined,
  headingOffsetDeg = 0,
): number {
  return aircraftModelHeadingRadians(derivedTrackDeg ?? trackDeg, headingOffsetDeg)
}

export function normalizeAircraftType(type: string | null | undefined): string | null {
  if (!type) return null
  const normalized = type.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function resolveAircraftModel(
  aircraftType: string | null | undefined,
): AircraftModelDefinition | null {
  const code = normalizeAircraftType(aircraftType)
  if (!code) return null
  return AIRCRAFT_MODEL_BY_TYPE[code] ?? null
}
