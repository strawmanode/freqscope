/**
 * Shared helper for stamping src/data/data-meta.json with the date and source
 * of each generated reference dataset.
 *
 * The build scripts call writeDataMeta() after regenerating their output so the
 * app can show how current its baked-in reference data is (see
 * src/lib/dataFreshness.ts). Live data (TFRs, weather, ADS-B) is fetched at
 * runtime and is not tracked here.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const META_PATH = path.join(__dirname, '../src/data/data-meta.json')

const SCHEMA_VERSION = 1

/**
 * Shallow-merges `updates` into data-meta.json. Each dataset owns one top-level
 * key (e.g. `nasr`, `airspace`) holding `{ generatedAt, source }`.
 */
export function writeDataMeta(updates) {
  let meta = {}
  if (fs.existsSync(META_PATH)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'))
    } catch {
      meta = {}
    }
  }

  const merged = { schema: SCHEMA_VERSION, ...meta, ...updates }
  fs.writeFileSync(META_PATH, JSON.stringify(merged, null, 2) + '\n')
  console.log(`data-meta.json updated (${Object.keys(updates).join(', ')})`)
}
