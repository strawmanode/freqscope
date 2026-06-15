import { app } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Keeps the desktop app's reference data current.
 *
 * Mirrors the app-update model: on launch we serve the most recent data we've
 * already downloaded, and check for a newer bundle in the background. A newly
 * downloaded bundle is swapped in atomically and takes effect on the *next*
 * launch — so we never block startup or read a half-written file.
 *
 * The data feed is a moving GitHub release (`data-latest`) published by the
 * scheduled data-update workflow.
 */

const RELEASE_BASE =
  'https://github.com/strawmanode/freqscope/releases/download/data-latest'
const MANIFEST_URL = `${RELEASE_BASE}/data-manifest.json`

type Manifest = { version?: string; files?: string[] }

function dataDir(): string {
  return path.join(app.getPath('userData'), 'data')
}

/**
 * Points the embedded server at a previously-downloaded data set, if one
 * exists. Call before the window loads so the client fetches the fresh copy.
 */
export function applyDownloadedDataDir(): void {
  const dir = dataDir()
  if (fs.existsSync(path.join(dir, 'data-manifest.json'))) {
    process.env.FREQSCOPE_DATA_DIR = dir
  }
}

function localVersion(dir: string): string | null {
  try {
    const m = JSON.parse(
      fs.readFileSync(path.join(dir, 'data-manifest.json'), 'utf8'),
    ) as Manifest
    return typeof m.version === 'string' ? m.version : null
  } catch {
    return null
  }
}

async function download(url: string, timeoutMs: number): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Background check for a newer data bundle. Safe to call without awaiting;
 * never throws. Downloads are staged in a temp dir and swapped in atomically.
 */
export async function checkForDataUpdate(): Promise<void> {
  const dir = dataDir()

  let manifest: Manifest
  try {
    const res = await fetch(MANIFEST_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return
    manifest = (await res.json()) as Manifest
  } catch {
    return // offline / no release yet
  }

  const files = Array.isArray(manifest.files) ? manifest.files : []
  if (!manifest.version || files.length === 0) return
  if (manifest.version === localVersion(dir)) return // already current

  const tmp = `${dir}.tmp-${Date.now()}`
  try {
    await fs.promises.mkdir(tmp, { recursive: true })
    for (const file of files) {
      const buf = await download(`${RELEASE_BASE}/${file}`, 30000)
      await fs.promises.writeFile(path.join(tmp, path.basename(file)), buf)
    }
    await fs.promises.writeFile(
      path.join(tmp, 'data-manifest.json'),
      JSON.stringify(manifest),
    )

    // Atomic-ish swap: move current aside, move temp into place, drop the old.
    const backup = `${dir}.old-${Date.now()}`
    if (fs.existsSync(dir)) await fs.promises.rename(dir, backup)
    await fs.promises.rename(tmp, dir)
    await fs.promises.rm(backup, { recursive: true, force: true }).catch(() => {})
    console.log(
      `[freqscope] reference data updated to ${manifest.version} (applies next launch)`,
    )
  } catch (err) {
    console.error('[freqscope] data update failed', err)
    await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
