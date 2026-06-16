/**
 * Builds src/data/scope-airports.json from scripts/airport-defaults.json.
 *
 * Scope-ready airports (home page tiles, polygon extraction, default filters)
 * are data — not app code — so they can ship via the data-latest release and
 * reach every installed desktop build without a new installer.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULTS_PATH = path.join(__dirname, 'airport-defaults.json')
const OUT_PATH = path.join(__dirname, '../src/data/scope-airports.json')

export function writeScopeAirports() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'))
  const icaos = Object.keys(defaults)
  const facilities = {}

  for (const [icao, entry] of Object.entries(defaults)) {
    const names = {}
    if (entry.towerName) names.tower = entry.towerName
    if (entry.approachName) names.approach = entry.approachName
    if (Object.keys(names).length > 0) facilities[icao] = names
  }

  const scope = {
    schema: 1,
    icaos,
    ...(Object.keys(facilities).length > 0 ? { facilities } : {}),
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(scope, null, 2) + '\n')
  console.log(`Wrote scope-airports.json (${icaos.length} airports)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeScopeAirports()
}
