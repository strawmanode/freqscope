import fs from 'fs'
import zlib from 'zlib'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeDataMeta } from './dataMeta.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function polygonRadiusNm(coordinates, centerLat, centerLon) {
  let maxNm = 0
  for (const [lat, lon] of coordinates) {
    const dLat = (lat - centerLat) * Math.PI / 180
    const dLon = (lon - centerLon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(centerLat * Math.PI / 180) *
      Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
    const nm = 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (nm > maxNm) maxNm = nm
  }
  return Math.round(maxNm)
}

function outerTierByMaxRadius(features, centerLat, centerLon) {
  return features.reduce((best, f) => {
    const coords = f.geometry.coordinates[0].map((c) => [c[1], c[0]])
    const radius = polygonRadiusNm(coords, centerLat, centerLon)
    return radius > (best?.radius ?? 0) ? { feature: f, radius } : best
  }, null)?.feature ?? null
}

/** FAA shelf ceilings are MSL; FreqScope stores AGL for non–Class B rendering. */
function mslCeilingToAgl(ceilingMsl, elevationFt) {
  return Math.round(Math.max(0, ceilingMsl - elevationFt))
}

function roundBoundary(ring) {
  return ring.map(([lat, lon]) => [
    Math.round(lat * 100000) / 100000,
    Math.round(lon * 100000) / 100000,
  ])
}

const gzPath = path.resolve(__dirname, '../node_modules/@squawk/airspace-data/data/airspace.geojson.gz')
const gz = fs.readFileSync(gzPath)
const geojson = JSON.parse(zlib.gunzipSync(gz).toString())

const AIRPORTS = ['ATL', 'ORD', 'LAX', 'JFK', 'SFO', 'DFW', 'DEN', 'LAS', 'MIA', 'SEA', 'MEM']

const FAA_TO_ICAO = {
  ATL: 'KATL',
  ORD: 'KORD',
  LAX: 'KLAX',
  JFK: 'KJFK',
  SFO: 'KSFO',
  DFW: 'KDFW',
  DEN: 'KDEN',
  LAS: 'KLAS',
  MIA: 'KMIA',
  SEA: 'KSEA',
  MEM: 'KMEM',
}

const AIRPORT_ARTCC = {
  KATL: 'ZTL',
  KORD: 'ZAU',
  KLAX: 'ZLA',
  KJFK: 'ZNY',
  KSFO: 'ZOA',
  KDFW: 'ZFW',
  KDEN: 'ZDV',
  KLAS: 'ZLA',
  KMIA: 'ZMA',
  KSEA: 'ZSE',
  KMEM: 'ZME',
}

const ARTCC_IDS = [
  ...new Set(
    geojson.features
      .filter((f) => f.properties?.type === 'ARTCC')
      .map((f) => f.properties.identifier),
  ),
]

const airspacePath = path.resolve(__dirname, '../src/data/airspace.json')
const airspace = JSON.parse(fs.readFileSync(airspacePath, 'utf8'))

const airportsPath = path.resolve(__dirname, '../src/data/airports.json')
const airports = JSON.parse(fs.readFileSync(airportsPath, 'utf8'))


for (const faaId of AIRPORTS) {
  const icao = FAA_TO_ICAO[faaId]
  if (!icao || !airspace[icao]) {
    console.warn(`Skipping ${faaId} — not found in airspace.json`)
    continue
  }

  const features = geojson.features.filter(
    (f) =>
      f.properties?.type === 'CLASS_B' &&
      f.properties?.identifier === faaId,
  )

  if (features.length === 0) {
    console.warn(`No Class B data found for ${faaId}`)
    continue
  }

  const tiers = features.map((f) => ({
    floor_ft: f.properties.floor.valueFt,
    ceiling_ft: f.properties.ceiling.valueFt,
    floor_ref: f.properties.floor.reference,
    boundary: f.geometry.coordinates[0].map((c) => [
      Math.round(c[1] * 100000) / 100000,
      Math.round(c[0] * 100000) / 100000,
    ]),
  }))

  tiers.sort((a, b) => a.floor_ft - b.floor_ft)
  airspace[icao].class_b = tiers
  console.log(`✓ ${icao} — ${tiers.length} tiers extracted`)

  const sfcTier = features.find((f) => f.properties.floor.reference === 'SFC')
  if (sfcTier) {
    airspace[icao].tower_boundary = sfcTier.geometry.coordinates[0].map((c) => [
      Math.round(c[1] * 100000) / 100000,
      Math.round(c[0] * 100000) / 100000,
    ])
    console.log(`  tower_boundary: ${airspace[icao].tower_boundary.length} points`)
  }

  const airportRecord = airports.find((a) => a.icao === icao)
  const centerLat = airportRecord?.lat ?? 0
  const centerLon = airportRecord?.lon ?? 0

  const outerTier = outerTierByMaxRadius(features, centerLat, centerLon)

  if (outerTier) {
    const coords = outerTier.geometry.coordinates[0].map((c) => [c[1], c[0]])
    airspace[icao].tracon_radius_nm = polygonRadiusNm(coords, centerLat, centerLon)
    console.log(`  tracon_radius_nm: ${airspace[icao].tracon_radius_nm} nm`)
  }

  airspace[icao].artcc = AIRPORT_ARTCC[icao] ?? null
}

// FAA identifier is the ICAO without the leading K for US airports
const faaFromIcao = (icao) => (icao.startsWith('K') ? icao.slice(1) : icao)

let enrichedCount = 0

for (const airport of airports) {
  const icao = airport.icao
  const faaId = faaFromIcao(icao)

  // Skip if already manually configured in airspace.json with full data
  if (airspace[icao]?.class_b) continue

  // Ensure entry exists
  if (!airspace[icao]) {
    airspace[icao] = {
      class: 'C',
      twr_ceil_ft: 3000,
      twr_radius_nm: 5,
      tracon_ceil_ft: 10000,
      tracon_radius_nm: 40,
    }
  }

  // Try Class B first
  const classBFeatures = geojson.features.filter(
    (f) => f.properties?.type === 'CLASS_B' && f.properties?.identifier === faaId,
  )
  if (classBFeatures.length > 0) {
    const sfcTier = classBFeatures.find((f) => f.properties.floor.reference === 'SFC')
    const outerTier = outerTierByMaxRadius(classBFeatures, airport.lat, airport.lon)
    if (sfcTier) airspace[icao].twr_ceil_ft = sfcTier.properties.ceiling.valueFt
    if (outerTier) {
      airspace[icao].tracon_ceil_ft = outerTier.properties.ceiling.valueFt
      const coords = outerTier.geometry.coordinates[0].map((c) => [c[1], c[0]])
      airspace[icao].tracon_radius_nm = polygonRadiusNm(coords, airport.lat, airport.lon)
    }
    airspace[icao].class = 'B'
    enrichedCount++
    continue
  }

  // Try Class C
  const classCFeatures = geojson.features.filter(
    (f) => f.properties?.type === 'CLASS_C' && f.properties?.identifier === faaId,
  )
  if (classCFeatures.length > 0) {
    const byRadius = [...classCFeatures].sort((a, b) => {
      const ra = polygonRadiusNm(
        a.geometry.coordinates[0].map((c) => [c[1], c[0]]),
        airport.lat,
        airport.lon,
      )
      const rb = polygonRadiusNm(
        b.geometry.coordinates[0].map((c) => [c[1], c[0]]),
        airport.lat,
        airport.lon,
      )
      return ra - rb
    })
    const inner = byRadius[0]
    const outer = byRadius[byRadius.length - 1]
    const innerCeilMsl = inner.properties.ceiling.valueFt
    const outerCeilMsl = outer.properties.ceiling.valueFt
    airspace[icao].twr_ceil_ft = mslCeilingToAgl(innerCeilMsl, airport.elevation_ft)
    airspace[icao].tracon_ceil_ft = mslCeilingToAgl(outerCeilMsl, airport.elevation_ft)
    const innerCoords = roundBoundary(
      inner.geometry.coordinates[0].map((c) => [c[1], c[0]]),
    )
    const outerCoords = roundBoundary(
      outer.geometry.coordinates[0].map((c) => [c[1], c[0]]),
    )
    airspace[icao].twr_radius_nm = polygonRadiusNm(innerCoords, airport.lat, airport.lon)
    airspace[icao].tracon_radius_nm = polygonRadiusNm(outerCoords, airport.lat, airport.lon)
    airspace[icao].class = 'C'

    // Full chart fidelity: capture every charted ring (SFC core + each shelf)
    // with its true MSL floor/ceiling, so the renderer can stack the rings
    // exactly as published instead of approximating the outer shelf as a single
    // ground-to-ceiling volume. Sorted SFC core first, then ascending floor.
    airspace[icao].class_c = classCFeatures
      .map((f) => ({
        floor_ft: f.properties.floor.valueFt,
        floor_ref: f.properties.floor.reference,
        ceiling_ft: f.properties.ceiling.valueFt,
        boundary: roundBoundary(
          f.geometry.coordinates[0].map((c) => [c[1], c[0]]),
        ),
      }))
      .sort((a, b) => a.floor_ft - b.floor_ft)

    // SFC core doubles as the tower lateral boundary; the outer ring is the
    // TRACON filter footprint. Kept for the TWR/TRACON altitude bands.
    const sfcTier =
      classCFeatures.find((f) => f.properties.floor.reference === 'SFC') ?? inner
    airspace[icao].tower_boundary = roundBoundary(
      sfcTier.geometry.coordinates[0].map((c) => [c[1], c[0]]),
    )
    airspace[icao].tracon_boundary = outerCoords
    enrichedCount++
    continue
  }

  // Try Class D
  const classDFeatures = geojson.features.filter(
    (f) => f.properties?.type === 'CLASS_D' && f.properties?.identifier === faaId,
  )
  if (classDFeatures.length > 0) {
    const d = classDFeatures[0]
    airspace[icao].twr_ceil_ft = mslCeilingToAgl(
      d.properties.ceiling.valueFt,
      airport.elevation_ft,
    )
    airspace[icao].class = 'D'
    enrichedCount++
  }
}

console.log(`✓ Enriched ${enrichedCount} airports with airspace dimensions`)

const artccData = {}

for (const id of ARTCC_IDS) {
  const features = geojson.features.filter(
    (f) =>
      f.properties?.type === 'ARTCC' &&
      f.properties?.identifier === id,
  )
  if (features.length === 0) {
    console.warn(`No ARTCC data for ${id}`)
    continue
  }
  artccData[id] = features.map((f) => ({
    stratum: f.properties.artccStratum,
    floor_ft: f.properties.floor.valueFt,
    floor_ref: f.properties.floor.reference,
    ceiling_ft: f.properties.ceiling.valueFt,
    boundary: f.geometry.coordinates[0].map((c) => [
      Math.round(c[1] * 100000) / 100000,
      Math.round(c[0] * 100000) / 100000,
    ]),
  }))
  console.log(`✓ ${id} — ${artccData[id].length} strata`)
}

function pointInPolygon(lat, lon, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i]
    const [latJ, lonJ] = polygon[j]
    if (
      (latI > lat) !== (latJ > lat) &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside
    }
  }
  return inside
}

// Always derive ARTCC from polygon — don't trust hardcoded values
for (const airport of airports) {
  const icao = airport.icao
  for (const [artccId, strata] of Object.entries(artccData)) {
    const lowStratum = strata.find((s) => s.stratum === 'LOW')
    if (!lowStratum) continue
    if (pointInPolygon(airport.lat, airport.lon, lowStratum.boundary)) {
      if (!airspace[icao]) {
        airspace[icao] = {
          class: 'C',
          twr_ceil_ft: 3000,
          twr_radius_nm: 5,
          tracon_ceil_ft: 10000,
          tracon_radius_nm: 40,
        }
      }
      airspace[icao].artcc = artccId
      break
    }
  }
}

const SUA_TYPES = new Set(['MOA', 'RESTRICTED', 'WARNING', 'ALERT'])

function featureIntersectsBbox(feature, bbox) {
  const ring = feature.geometry?.coordinates?.[0]
  if (!ring?.length) return false
  for (const [lon, lat] of ring) {
    if (
      lat >= bbox.lamin &&
      lat <= bbox.lamax &&
      lon >= bbox.lomin &&
      lon <= bbox.lomax
    ) {
      return true
    }
  }
  const midLat = (bbox.lamin + bbox.lamax) / 2
  const midLon = (bbox.lomin + bbox.lomax) / 2
  return pointInPolygon(
    midLat,
    midLon,
    ring.map((c) => [c[1], c[0]]),
  )
}

const suaFeatures = geojson.features
  .filter((f) => SUA_TYPES.has(f.properties?.type))
  .map((f) => ({
    type: f.properties.type,
    identifier: f.properties.identifier,
    name: f.properties.name,
    state: f.properties.state ?? null,
    floor_ft: f.properties.floor.valueFt,
    floor_ref: f.properties.floor.reference,
    ceiling_ft: Math.min(f.properties.ceiling.valueFt, 60000),
    ceiling_ref: f.properties.ceiling.reference,
    schedule_description: f.properties.scheduleDescription ?? null,
    boundary: f.geometry.coordinates[0].map((c) => [
      Math.round(c[1] * 100000) / 100000,
      Math.round(c[0] * 100000) / 100000,
    ]),
  }))

// Apply SUA corrections (see scripts/sua-overrides.json).
// The upstream @squawk/airspace-data package ships 109 self-intersecting SUA
// rings plus a corrupted ceiling for Dolphin South MOA. Overrides hold repaired
// geometry — the 33 materially-wrong polygons were replaced with official FAA
// SUA geometry (services6.arcgis.com Special_Use_Airspace), the rest were
// sliver-repaired. Remove an entry only if upstream fixes the source data.
const suaOverrides = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'sua-overrides.json'), 'utf8'),
)
let overrideCount = 0
for (const f of suaFeatures) {
  const override = suaOverrides[`${f.type}:${f.identifier}`]
  if (!override) continue
  if (override.boundary) f.boundary = override.boundary
  if (override.ceiling_ft != null) {
    f.ceiling_ft = override.ceiling_ft
    f.ceiling_ref = override.ceiling_ref
  }
  overrideCount++
}
console.log(`sua overrides applied: ${overrideCount}`)

const artccPath = path.resolve(__dirname, '../src/data/artcc.json')
const suaPath = path.resolve(__dirname, '../src/data/sua.json')
fs.writeFileSync(airspacePath, JSON.stringify(airspace, null, 2))
console.log('airspace.json updated.')
fs.writeFileSync(artccPath, JSON.stringify(artccData, null, 2))
console.log('artcc.json written.')
fs.writeFileSync(suaPath, JSON.stringify(suaFeatures, null, 2))
console.log(`sua.json written — ${suaFeatures.length} special-use areas.`)
console.log('ARTCC assignments written.')

writeDataMeta({
  airspace: {
    generatedAt: new Date().toISOString(),
    source: '@squawk/airspace-data',
  },
})
