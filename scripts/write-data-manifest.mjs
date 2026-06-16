/**
 * Writes src/data/data-manifest.json — the version stamp for the reference-data
 * bundle. Shipped inside the desktop app and published to the data-latest
 * release so installs can tell whether a newer bundle exists online.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '../src/data/data-manifest.json')

export const REFERENCE_DATA_FILES = [
  'airports.json',
  'frequencies.json',
  'runways.json',
  'airspace.json',
  'artcc.json',
  'sua.json',
  'data-meta.json',
  'scope-airports.json',
]

export function writeDataManifest(source = 'OurAirports') {
  const version = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    source,
    files: REFERENCE_DATA_FILES,
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`data-manifest.json → version ${version}`)
  return manifest
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeDataManifest()
}
