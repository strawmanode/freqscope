/**
 * Download FR24 aircraft GLBs, upgrade glTF 1.0 → 2.0 when needed, apply Cesium orientation fix.
 *
 * Usage:
 *   node scripts/setup-fr24-models.mjs              # download default FreqScope model set
 *   node scripts/setup-fr24-models.mjs b738.glb ... # download specific models
 *
 * c172.glb is not from FR24; see public/models/aircraft/README.md.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const FR24_BASE =
  'https://raw.githubusercontent.com/Flightradar24/fr24-3d-models/master/models'
const outDir = path.resolve('public/models/aircraft')

/** Default set referenced by src/lib/aircraftModels.ts (FR24 upstream only). */
const DEFAULT_FR24_MODELS = [
  'a319.glb',
  'a320.glb',
  'a321.glb',
  'a332.glb',
  'a333.glb',
  'a359.glb',
  'b736.glb',
  'b737.glb',
  'b738.glb',
  'b739.glb',
  'b744.glb',
  'b748.glb',
  'b752.glb',
  'b753.glb',
  'b762.glb',
  'b763.glb',
  'b764.glb',
  'b772.glb',
  'b773.glb',
  'b788.glb',
  'b789.glb',
  'crj900.glb',
]

function gltfVersion(filePath) {
  const buf = fs.readFileSync(filePath)
  if (buf.length < 8 || buf.toString('ascii', 0, 4) !== 'glTF') return null
  return buf.readUInt32LE(4)
}

const requested = process.argv.slice(2)
const models = requested.length > 0 ? requested : DEFAULT_FR24_MODELS

fs.mkdirSync(outDir, { recursive: true })

if (requested.length === 0) {
  console.log(`Downloading ${models.length} default FR24 models to ${outDir}`)
  console.log('(c172.glb is separate — see public/models/aircraft/README.md)\n')
}

for (const name of models) {
  const outPath = path.join(outDir, name)
  const url = `${FR24_BASE}/${name}`

  console.log(`\n→ ${name}`)
  execSync(`curl -fsSL "${url}" -o "${outPath}"`, { stdio: 'inherit' })

  const version = gltfVersion(outPath)
  if (version === 1) {
    console.log('  upgrading glTF 1.0 → 2.0')
    execSync(`npx --yes gltf-pipeline -i "${outPath}" -o "${outPath}"`, { stdio: 'inherit' })
  } else if (version !== 2) {
    console.warn(`  unexpected glTF version: ${version}`)
  }

  execSync(`node scripts/fix-model-orientation.mjs "${name}"`, { stdio: 'inherit' })
}

console.log('\nDone.')
