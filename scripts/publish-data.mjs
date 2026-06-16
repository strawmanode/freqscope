/**
 * One-command manual publish of the reference-data feed to the moving
 * `data-latest` GitHub release. The desktop app checks this release on launch
 * and downloads a newer bundle, so publishing here is what makes every
 * already-installed app pick up new airports / airspace without reinstalling.
 *
 * Usage:
 *   npm run publish:data
 *     → publishes the committed src/data bundle as-is.
 *
 *   npm run build:reference-data && npm run publish:data
 *     → regenerates from OurAirports + @squawk first, then publishes.
 *
 * Requires the GitHub CLI (`gh`) installed and authenticated (`gh auth login`).
 * Seeds the release on first run, then clobbers the assets on each subsequent
 * run. The scheduled .github/workflows/data-update.yml does the same thing on a
 * weekly cron; this script is for seeding immediately or publishing on demand.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { REFERENCE_DATA_FILES } from './write-data-manifest.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../src/data')

function run(args) {
  execFileSync('gh', args, { stdio: 'inherit' })
}

function ghOk(args) {
  try {
    execFileSync('gh', args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// 1. Preconditions: gh present + authenticated.
if (!ghOk(['--version'])) {
  console.error(
    'GitHub CLI (gh) not found. Install it from https://cli.github.com and run `gh auth login`.',
  )
  process.exit(1)
}
if (!ghOk(['auth', 'status'])) {
  console.error('gh is not authenticated. Run `gh auth login` and retry.')
  process.exit(1)
}

// 2. Preconditions: data bundle present.
const files = [...REFERENCE_DATA_FILES, 'data-manifest.json']
const missing = files.filter((f) => !fs.existsSync(path.join(dataDir, f)))
if (missing.length) {
  console.error(
    `Missing data files: ${missing.join(', ')}\n` +
      'Run `npm run build:reference-data` first.',
  )
  process.exit(1)
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'data-manifest.json'), 'utf8'),
)

// 3. Create the moving release on first run.
if (!ghOk(['release', 'view', 'data-latest'])) {
  console.log('Seeding data-latest release…')
  run([
    'release',
    'create',
    'data-latest',
    '--title',
    'FreqScope reference data (latest)',
    '--notes',
    'Auto-published reference data. The desktop app downloads this on launch.',
    '--prerelease',
  ])
}

// 4. Upload (clobber) the bundle.
console.log(`Publishing reference data — version ${manifest.version}…`)
run([
  'release',
  'upload',
  'data-latest',
  ...files.map((f) => path.join(dataDir, f)),
  '--clobber',
])

console.log(
  '✓ Published to data-latest. Installed apps will pick it up on next launch.',
)
