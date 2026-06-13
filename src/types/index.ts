interface AirportDefaults {
  altFilter?: 'TWR' | 'TRACON' | 'CTR' | 'ALL'
  trafficFilter?: 'AIR' | 'GND' | 'ALL'
  autoTuneSlot?: 'ATIS' | 'CLEARANCE' | 'GROUND' | 'TOWER' | 'DEPARTURE' | 'APPROACH'
}

export interface Airport {
  icao: string
  name: string
  city: string
  state: string
  lat: number
  lon: number
  elevation_ft: number
  defaults?: AirportDefaults
}

export interface Frequency {
  type: string
  frequency: string
  label: string
}

export type FrequenciesByIcao = Record<string, Frequency[]>

export interface RunwayEnd {
  name: string
  heading_deg: number
  lat: number
  lon: number
}

export interface Runway {
  id: string
  length_ft: number
  ends: [RunwayEnd, RunwayEnd]
}

export type RunwaysByIcao = Record<string, Runway[]>

export type { AirspaceConfig } from '../lib/airspace'

export type LandmarkCategory = 'government' | 'military' | 'presidential' | 'landmark'

export interface Landmark {
  id: string
  name: string
  lat: number
  lon: number
  category: LandmarkCategory
}
