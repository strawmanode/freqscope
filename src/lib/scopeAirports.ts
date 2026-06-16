import scopeBundled from '../data/scope-airports.json'

export type ScopeFacilityNames = {
  tower?: string
  approach?: string
}

export type ScopeAirportsConfig = {
  schema: number
  icaos: string[]
  facilities?: Record<string, ScopeFacilityNames>
}

let config: ScopeAirportsConfig = scopeBundled as ScopeAirportsConfig

/** Merges a downloaded scope-airports.json over the bundled copy. */
export function applyScopeAirports(next: ScopeAirportsConfig): void {
  config = {
    schema: next.schema ?? config.schema,
    icaos: Array.isArray(next.icaos) ? [...next.icaos] : config.icaos,
    facilities: next.facilities ? { ...next.facilities } : config.facilities,
  }
}

export function getVerifiedIcaos(): string[] {
  return config.icaos
}

export function getScopeFacilityNames(icao: string): ScopeFacilityNames | undefined {
  return config.facilities?.[icao]
}
