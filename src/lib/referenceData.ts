import airportsBundled from '../data/airports.json'
import frequenciesBundled from '../data/frequencies.json'
import runwaysBundled from '../data/runways.json'
import airspaceBundled from '../data/airspace.json'
import artccBundled from '../data/artcc.json'
import suaBundled from '../data/sua.json'
import dataMetaBundled from '../data/data-meta.json'

/**
 * Keeps the app's bundled reference data current.
 *
 * The JSON imported above is the instant, offline-safe copy that ships in the
 * build — every other module imports those same objects directly. At startup
 * {@link initReferenceData} fetches `/data/<name>.json` from the embedded
 * server (which serves a downloaded, newer copy when the desktop app has one,
 * otherwise the bundled copy) and merges the result **into those same objects
 * in place**. Because the references don't change, existing consumers pick up
 * the fresher data without any changes of their own.
 *
 * Live data — aircraft, TFRs, weather — is fetched separately at runtime and is
 * not handled here.
 */

type Kind = 'array' | 'object'
type Dataset = { name: string; ref: unknown; kind: Kind }

const DATASETS: Dataset[] = [
  { name: 'airports', ref: airportsBundled, kind: 'array' },
  { name: 'frequencies', ref: frequenciesBundled, kind: 'object' },
  { name: 'runways', ref: runwaysBundled, kind: 'object' },
  { name: 'airspace', ref: airspaceBundled, kind: 'object' },
  { name: 'artcc', ref: artccBundled, kind: 'object' },
  { name: 'sua', ref: suaBundled, kind: 'array' },
  // Keeps the freshness badge (dataFreshness.ts) in sync with downloaded data.
  { name: 'data-meta', ref: dataMetaBundled, kind: 'object' },
]

function mergeArrayInPlace(ref: unknown, fresh: unknown): void {
  if (!Array.isArray(ref) || !Array.isArray(fresh)) return
  const arr = ref as unknown[]
  arr.length = 0
  for (const item of fresh) arr.push(item)
}

function mergeObjectInPlace(ref: unknown, fresh: unknown): void {
  if (!ref || typeof ref !== 'object' || !fresh || typeof fresh !== 'object') return
  const obj = ref as Record<string, unknown>
  for (const key of Object.keys(obj)) delete obj[key]
  Object.assign(obj, fresh as Record<string, unknown>)
}

async function refreshDataset({ name, ref, kind }: Dataset): Promise<void> {
  try {
    const res = await fetch(`/data/${name}.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return
    const fresh: unknown = await res.json()
    if (kind === 'array') mergeArrayInPlace(ref, fresh)
    else mergeObjectInPlace(ref, fresh)
  } catch {
    // Offline, slow, or server unavailable — keep the bundled copy.
  }
}

/**
 * Fetches and merges the latest reference data. Resolves once all datasets have
 * been refreshed or have fallen back to bundled; never rejects, so it is safe
 * to await before the first render.
 */
export async function initReferenceData(): Promise<void> {
  await Promise.all(DATASETS.map(refreshDataset))
}
