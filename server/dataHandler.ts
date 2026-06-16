import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'

/**
 * Serves the app's reference-data JSON (airports, frequencies, runways,
 * airspace, etc.) at `/data/<name>.json`.
 *
 * Resolution order:
 *   1. FREQSCOPE_DATA_DIR   — a downloaded, newer copy (set by the Electron app
 *      when it has fetched an updated data bundle into the user's data folder).
 *   2. FREQSCOPE_BUNDLED_DATA_DIR — the copy shipped with this build.
 *   3. <cwd>/src/data       — default for the Vite dev server.
 *
 * This lets a downloaded desktop build serve fresher reference data than it
 * shipped with, while always falling back to the bundled copy offline.
 */

const DATA_FILES = new Set([
  'airports',
  'frequencies',
  'runways',
  'airspace',
  'artcc',
  'sua',
  'landmarks',
  'data-meta',
  'scope-airports',
])

function bundledDir(): string {
  return (
    process.env.FREQSCOPE_BUNDLED_DATA_DIR?.trim() ||
    path.resolve(process.cwd(), 'src/data')
  )
}

function resolveDataFile(name: string): string | null {
  const override = process.env.FREQSCOPE_DATA_DIR?.trim()
  const dirs = [override, bundledDir()].filter((d): d is string => Boolean(d))
  for (const dir of dirs) {
    const file = path.join(dir, `${name}.json`)
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

/**
 * Handles `/data/<name>.json`. Returns true when the request was handled,
 * false to fall through to other handlers.
 */
export async function handleDataRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? ''
  if (!url.startsWith('/data/')) return false

  const raw = url.slice('/data/'.length).split('?')[0]
  const name = raw.replace(/\.json$/, '')
  if (!DATA_FILES.has(name)) return false

  const file = resolveDataFile(name)
  if (!file) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Data file not found' }))
    return true
  }

  try {
    const body = await fs.promises.readFile(file)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    // Always revalidate — the file on disk may have been swapped for a newer
    // downloaded copy between launches.
    res.setHeader('Cache-Control', 'no-cache')
    res.end(body)
  } catch (err) {
    console.error('[data-api]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to read data file' }))
  }
  return true
}
