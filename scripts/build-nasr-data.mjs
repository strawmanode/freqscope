/**
 * Build src/data/airports.json and frequencies.json
 *
 * Preferred: FAA NASR CSVs in scripts/nasr/
 *   - APT_BASE.csv (+ optional APT_ATT.csv for city/state)
 *   - FRQ.csv
 *
 * Fallback (when NASR files missing): OurAirports CSVs in scripts/nasr/
 *   - airports.csv, airport-frequencies.csv
 *   Download: https://ourairports.com/data/
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeDataMeta } from './dataMeta.mjs'
import { writeScopeAirports } from './write-scope-airports.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NASR_DIR = path.join(__dirname, 'nasr')
const OUT_AIRPORTS = path.join(__dirname, '../src/data/airports.json')
const OUT_FREQ = path.join(__dirname, '../src/data/frequencies.json')
const OUT_RUNWAYS = path.join(__dirname, '../src/data/runways.json')
const MAX_AIRPORTS = 500

const TYPE_PRIORITY = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
}

const FREQ_TYPE_LABELS = {
  ATIS: 'ATIS',
  GND: 'Ground',
  TWR: 'Tower',
  APP: 'Approach',
  DEP: 'Departure',
  CLD: 'Clearance Delivery',
  CD: 'Clearance Delivery',
  CLR: 'Clearance Delivery',
  CTR: 'Center',
  CENTER: 'Center',
}

const FREQ_TYPES_KEEP = new Set([
  'ATIS',
  'GND',
  'TWR',
  'APP',
  'DEP',
  'CLD',
  'CD',
  'CLR',
  'CTR',
  'CENTER',
])

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const headers = rows[0]
  return rows.slice(1).map((cells) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    return obj
  })
}

function formatMhz(value) {
  const n = parseFloat(String(value))
  if (Number.isNaN(n)) return null
  return n.toFixed(2)
}

function mapFreqType(raw) {
  const t = String(raw || '')
    .toUpperCase()
    .trim()
  if (t.includes('ATIS')) return 'ATIS'
  if (t === 'GND' || t.includes('GROUND')) return 'GND'
  if (t === 'TWR' || t.includes('TOWER')) return 'TWR'
  if (t === 'APP' || t.includes('APPROACH')) return 'APP'
  if (t === 'DEP' || t.includes('DEPART')) return 'DEP'
  if (t === 'CLD' || t.includes('CLEARANCE')) return 'CLD'
  if (t === 'CTR' || t.includes('CENTER')) return 'CTR'
  return t
}

function buildFromOurAirports() {
  const airportsPath = path.join(NASR_DIR, 'airports.csv')
  const freqPath = path.join(NASR_DIR, 'airport-frequencies.csv')
  if (!fs.existsSync(airportsPath) || !fs.existsSync(freqPath)) {
    throw new Error(
      'Missing scripts/nasr/airports.csv and airport-frequencies.csv. See scripts/README.md',
    )
  }

  console.warn(
    'Using OurAirports CSV fallback (place FAA APT_BASE.csv + FRQ.csv in scripts/nasr/ for NASR)',
  )

  const airportRows = parseCsv(fs.readFileSync(airportsPath, 'utf8'))
  const freqRows = parseCsv(fs.readFileSync(freqPath, 'utf8'))

  const us = airportRows.filter(
    (r) =>
      r.iso_country === 'US' &&
      /^K[A-Z0-9]{3}$/.test(r.gps_code || r.ident) &&
      ['large_airport', 'medium_airport', 'small_airport'].includes(r.type),
  )

  us.sort((a, b) => {
    const pa = TYPE_PRIORITY[a.type] ?? 9
    const pb = TYPE_PRIORITY[b.type] ?? 9
    if (pa !== pb) return pa - pb
    return (a.name || '').localeCompare(b.name || '')
  })

  const selected = us.slice(0, MAX_AIRPORTS)
  const icaoSet = new Set(selected.map((r) => r.gps_code || r.ident))

  const airports = selected.map((r) => {
    const icao = r.gps_code || r.ident
    const region = (r.iso_region || '').split('-')[1] || ''
    return {
      icao,
      name: r.name,
      city: r.municipality || '',
      state: region,
      lat: parseFloat(r.latitude_deg),
      lon: parseFloat(r.longitude_deg),
      elevation_ft: parseInt(r.elevation_ft, 10) || 0,
    }
  })

  const frequencies = {}

  for (const row of freqRows) {
    const icao = row.airport_ident
    if (!icaoSet.has(icao)) continue
    const type = mapFreqType(row.type)
    if (!FREQ_TYPES_KEEP.has(type)) continue
    const mhz = formatMhz(row.frequency_mhz)
    if (!mhz) continue

    if (!frequencies[icao]) frequencies[icao] = []
    const label = FREQ_TYPE_LABELS[type] || row.description || type
    const entry = {
      type,
      frequency: mhz,
      label,
    }
    const dup = frequencies[icao].some(
      (f) => f.type === entry.type && f.frequency === entry.frequency,
    )
    if (!dup) frequencies[icao].push(entry)
  }

  for (const icao of Object.keys(frequencies)) {
    frequencies[icao].sort((a, b) => a.label.localeCompare(b.label))
  }

  return { airports, frequencies, siteNoToIcao: null }
}

function parseRunwayEnd(name, lat, lon, heading) {
  const latN = parseFloat(lat)
  const lonN = parseFloat(lon)
  const hdgN = parseFloat(heading)
  if (Number.isNaN(latN) || Number.isNaN(lonN) || Number.isNaN(hdgN)) return null
  return {
    name: String(name).trim(),
    heading_deg: Math.round(hdgN),
    lat: latN,
    lon: lonN,
  }
}

function buildRunwaysFromOurAirports(icaoSet) {
  const runwaysPath = path.join(NASR_DIR, 'runways.csv')
  if (!fs.existsSync(runwaysPath)) return null

  const rows = parseCsv(fs.readFileSync(runwaysPath, 'utf8'))
  const byIcao = {}

  for (const row of rows) {
    const icao = row.airport_ident
    if (!icaoSet.has(icao)) continue

    const leIdent = (row.le_ident || '').trim()
    const heIdent = (row.he_ident || '').trim()
    if (!leIdent || !heIdent) continue
    if (leIdent.startsWith('H') || heIdent.startsWith('H')) continue

    const leEnd = parseRunwayEnd(
      leIdent,
      row.le_latitude_deg,
      row.le_longitude_deg,
      row.le_heading_degT,
    )
    const heEnd = parseRunwayEnd(
      heIdent,
      row.he_latitude_deg,
      row.he_longitude_deg,
      row.he_heading_degT,
    )
    if (!leEnd || !heEnd) continue

    const lengthFt = parseInt(row.length_ft, 10) || 0
    const rwy = {
      id: `${leIdent}/${heIdent}`,
      length_ft: lengthFt,
      ends: [leEnd, heEnd],
    }

    if (!byIcao[icao]) byIcao[icao] = []
    byIcao[icao].push(rwy)
  }

  return byIcao
}

function buildRunwaysFromNasr(siteNoToIcao, icaoSet) {
  const rwyPath = path.join(NASR_DIR, 'APT_RWY.csv')
  if (!fs.existsSync(rwyPath)) return null

  const rows = parseCsv(fs.readFileSync(rwyPath, 'utf8'))
  const byIcao = {}

  for (const row of rows) {
    const siteNo = row.SITE_NO || row.site_no
    const icao = siteNoToIcao?.[siteNo]
    if (!icao || !icaoSet.has(icao)) continue

    const baseId = (row.BASE_END_RWY_ID || row.base_end_rwy_id || '').trim()
    const recipId = (row.RECIP_END_RWY_ID || row.recip_end_rwy_id || '').trim()
    if (!baseId || !recipId) continue
    if (baseId.startsWith('H') || recipId.startsWith('H')) continue

    const baseEnd = parseRunwayEnd(
      baseId,
      row.BASE_END_LATITUDE_DECIMAL || row.base_end_latitude_decimal,
      row.BASE_END_LONGITUDE_DECIMAL || row.base_end_longitude_decimal,
      row.BASE_END_TRUE_HDNG || row.base_end_true_hdng,
    )
    const recipEnd = parseRunwayEnd(
      recipId,
      row.RECIPROCAL_END_LATITUDE_DECIMAL ||
        row.reciprocal_end_latitude_decimal,
      row.RECIPROCAL_END_LONGITUDE_DECIMAL ||
        row.reciprocal_end_longitude_decimal,
      row.RECIP_END_TRUE_HDNG || row.recip_end_true_hdng,
    )
    if (!baseEnd || !recipEnd) continue

    const lengthFt = parseInt(row.RWY_LEN || row.rwy_len, 10) || 0
    const id = (row.RWY_ID || row.rwy_id || `${baseId}/${recipId}`).trim()
    const rwy = {
      id,
      length_ft: lengthFt,
      ends: [baseEnd, recipEnd],
    }

    if (!byIcao[icao]) byIcao[icao] = []
    byIcao[icao].push(rwy)
  }

  return byIcao
}

function buildRunways(icaoSet, siteNoToIcao) {
  if (siteNoToIcao) {
    const nasr = buildRunwaysFromNasr(siteNoToIcao, icaoSet)
    if (nasr) return nasr
  }
  const ourAirports = buildRunwaysFromOurAirports(icaoSet)
  if (ourAirports) return ourAirports
  return {}
}

function buildFromNasr() {
  const aptPath = path.join(NASR_DIR, 'APT_BASE.csv')
  const frqPath = path.join(NASR_DIR, 'FRQ.csv')
  const attPath = path.join(NASR_DIR, 'APT_ATT.csv')

  if (!fs.existsSync(aptPath) || !fs.existsSync(frqPath)) {
    return null
  }

  console.log('Building from FAA NASR APT_BASE.csv + FRQ.csv')

  const aptRows = parseCsv(fs.readFileSync(aptPath, 'utf8'))
  const frqRows = parseCsv(fs.readFileSync(frqPath, 'utf8'))
  let attById = {}
  if (fs.existsSync(attPath)) {
    const attRows = parseCsv(fs.readFileSync(attPath, 'utf8'))
    for (const r of attRows) {
      attById[r.ARPT_ID || r.arpt_id] = r
    }
  }

  const us = aptRows.filter((r) => {
    const country = r.ARPT_COUNTRY || r.COUNTRY_CODE || r.country_code || ''
    const icao = r.ICAO_ID || r.icao_id || r.ARPT_ID || ''
    return (
      (country === 'US' || country === 'USA') &&
      /^K[A-Z0-9]{3}$/.test(icao) &&
      (r.SERVC_TYPE || r.arpt_type || '').toLowerCase() !== 'heliport'
    )
  })

  const typeRank = (r) => {
    const t = (r.ARPT_TYPE || r.arpt_type || '').toLowerCase()
    if (t.includes('large') || t === 'a') return 0
    if (t.includes('medium') || t === 'b') return 1
    return 2
  }

  us.sort((a, b) => {
    const d = typeRank(a) - typeRank(b)
    if (d !== 0) return d
    return String(a.ARPT_NAME || a.arpt_name || '').localeCompare(
      String(b.ARPT_NAME || b.arpt_name || ''),
    )
  })

  const selected = us.slice(0, MAX_AIRPORTS)
  const icaoSet = new Set(
    selected.map((r) => r.ICAO_ID || r.icao_id || r.ARPT_ID),
  )
  const siteNoToIcao = {}
  for (const r of selected) {
    const icao = r.ICAO_ID || r.icao_id
    const siteNo = r.SITE_NO || r.site_no || r.ARPT_ID || r.arpt_id
    if (icao && siteNo) siteNoToIcao[siteNo] = icao
  }

  const airports = selected.map((r) => {
    const icao = r.ICAO_ID || r.icao_id
    const att = attById[r.ARPT_ID || r.arpt_id] || {}
    const lat = parseFloat(r.LAT_DECIMAL || r.lat_decimal || r.ARPT_LAT)
    const lon = parseFloat(r.LON_DECIMAL || r.lon_decimal || r.ARPT_LON)
    return {
      icao,
      name: (r.ARPT_NAME || r.arpt_name || '').trim(),
      city: (att.CITY || att.city || r.CITY || '').trim(),
      state: (att.STATE_CODE || att.state_code || r.STATE_CODE || '').trim(),
      lat,
      lon,
      elevation_ft:
        parseInt(r.ELEV || r.elev || r.ARPT_ELEV, 10) || 0,
    }
  })

  const frequencies = {}
  for (const row of frqRows) {
    const icao =
      row.ICAO_ID ||
      row.icao_id ||
      row.SERVICED_ARPT ||
      row.serviced_arpt ||
      ''
    if (!icaoSet.has(icao)) continue

    const type = mapFreqType(
      row.FACILITY_TYPE || row.facility_type || row.SERVICE_TYPE || '',
    )
    if (!FREQ_TYPES_KEEP.has(type)) continue
    const mhz = formatMhz(
      row.FREQUENCY || row.frequency || row.FREQ || row.freq,
    )
    if (!mhz) continue

    if (!frequencies[icao]) frequencies[icao] = []
    const label =
      FREQ_TYPE_LABELS[type] ||
      (row.FACILITY_NAME || row.facility_name || type)
    const entry = { type, frequency: mhz, label }
    const dup = frequencies[icao].some(
      (f) => f.type === entry.type && f.frequency === entry.frequency,
    )
    if (!dup) frequencies[icao].push(entry)
  }

  return { airports, frequencies, siteNoToIcao }
}

function main() {
  fs.mkdirSync(path.dirname(OUT_AIRPORTS), { recursive: true })

  let source = 'FAA NASR'
  let data = buildFromNasr()
  if (!data) {
    source = 'OurAirports'
    data = buildFromOurAirports()
  }

  fs.writeFileSync(OUT_AIRPORTS, JSON.stringify(data.airports, null, 2) + '\n')
  fs.writeFileSync(OUT_FREQ, JSON.stringify(data.frequencies, null, 2) + '\n')

  const defaultsPath = path.join(__dirname, 'airport-defaults.json')
  if (fs.existsSync(defaultsPath)) {
    const airportDefaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'))
    const airports = JSON.parse(fs.readFileSync(OUT_AIRPORTS, 'utf8'))
    let mergeCount = 0
    for (const airport of airports) {
      if (airportDefaults[airport.icao]) {
        airport.defaults = airportDefaults[airport.icao]
        mergeCount++
      }
    }
    fs.writeFileSync(OUT_AIRPORTS, JSON.stringify(airports, null, 2) + '\n')
    console.log(`Merged defaults for ${mergeCount} airports`)
  }

  const icaoSet = new Set(data.airports.map((a) => a.icao))
  const runways = buildRunways(icaoSet, data.siteNoToIcao)
  if (Object.keys(runways).length === 0) {
    console.warn(
      'No runway data — place APT_RWY.csv or runways.csv in scripts/nasr/ (see scripts/README.md)',
    )
  }
  fs.writeFileSync(OUT_RUNWAYS, JSON.stringify(runways, null, 2) + '\n')

  console.log(
    `Wrote ${data.airports.length} airports, ${Object.keys(data.frequencies).length} ICAO frequency groups, and ${Object.keys(runways).length} ICAO runway groups`,
  )

  writeDataMeta({
    nasr: { generatedAt: new Date().toISOString(), source },
  })

  writeScopeAirports()
}

main()
