/**
 * Writes src/data/data-manifest.json — the version stamp for the reference-data
 * bundle. Shipped inside the desktop app and published to the data-latest
 * release so installs can tell whether a newer bundle exists online.
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../src/data')
const OUT_PATH = path.join(DATA_DIR, 'data-manifest.json')

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

/**
 * Content hash of the reference-data files, so the version changes whenever the
 * data changes — and only then. This is what the desktop app compares to decide
 * whether to download a newer bundle, so it must be unique per publish (a
 * date-only stamp collided when the feed was published twice in one day) while
 * staying stable when the data is unchanged (avoids needless re-downloads).
 */
function contentHash() {
  const hash = crypto.createHash('sha256')
  for (const file of REFERENCE_DATA_FILES) {
    const p = path.join(DATA_DIR, file)
    hash.update(file)
    hash.update(fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0))
  }
  return hash.digest('hex').slice(0, 12)
}

export function writeDataManifest(source = 'OurAirports') {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const version = `${date}-${contentHash()}`
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
