import dataMeta from '../data/data-meta.json'

/**
 * Reports how current the app's *bundled reference data* is.
 *
 * Airports, frequencies, runways, and airspace volumes are generated at build
 * time (see scripts/build-nasr-data.mjs and scripts/build-airspace.mjs) and
 * stamped into src/data/data-meta.json. The FAA NASR datasets follow a 28-day
 * cycle, so a downloaded build slowly goes out of date.
 *
 * Live data — aircraft positions, TFRs, SIGMET/G-AIRMET, and METAR — is fetched
 * at runtime and is NOT covered here; it is always current.
 */

const NASR_CYCLE_DAYS = 28
const DAY_MS = 86_400_000

export type DataFreshnessStatus = 'current' | 'aging' | 'stale' | 'unknown'

export type DatasetMeta = {
  generatedAt: string | null
  source: string | null
}

export type DataFreshness = {
  status: DataFreshnessStatus
  /** The reference timestamp shown to the user (the NASR build date). */
  generatedAt: Date | null
  ageDays: number | null
  nasr: DatasetMeta
  airspace: DatasetMeta
}

type RawMeta = {
  nasr?: Partial<DatasetMeta>
  airspace?: Partial<DatasetMeta>
}

function dataset(raw: Partial<DatasetMeta> | undefined): DatasetMeta {
  return {
    generatedAt: typeof raw?.generatedAt === 'string' ? raw.generatedAt : null,
    source: typeof raw?.source === 'string' ? raw.source : null,
  }
}

export function getDataFreshness(now: number = Date.now()): DataFreshness {
  const raw = dataMeta as RawMeta
  const nasr = dataset(raw.nasr)
  const airspace = dataset(raw.airspace)

  // NASR drives freshness (28-day cycle); airspace changes far less often.
  const stampIso = nasr.generatedAt ?? airspace.generatedAt
  if (!stampIso) {
    return { status: 'unknown', generatedAt: null, ageDays: null, nasr, airspace }
  }

  const generatedAt = new Date(stampIso)
  if (Number.isNaN(generatedAt.getTime())) {
    return { status: 'unknown', generatedAt: null, ageDays: null, nasr, airspace }
  }

  const ageDays = Math.max(0, Math.floor((now - generatedAt.getTime()) / DAY_MS))

  let status: DataFreshnessStatus
  if (ageDays <= NASR_CYCLE_DAYS) status = 'current'
  else if (ageDays <= NASR_CYCLE_DAYS * 2) status = 'aging'
  else status = 'stale'

  return { status, generatedAt, ageDays, nasr, airspace }
}
