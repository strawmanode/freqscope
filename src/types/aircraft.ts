export type {
  AircraftFeedSource,
  RichAircraftState,
} from '../../shared/aircraftTypes'

export type FlightPhase =
  | 'ground'
  | 'departing'
  | 'climbout'
  | 'approach'
  | 'arrival'
  | 'final'
  | 'cruise'
  | 'unknown'

export interface PositionSnapshot {
  timestamp: number
  lat: number
  lon: number
  altitudeFt: number
  speedKts: number
  headingDeg: number
  verticalRateFpm: number
  onGround: boolean
}

export interface EnrichedAircraft {
  icao24: string
  callsign: string | null
  lat: number
  lon: number
  altitudeFt: number
  speedKts: number
  headingDeg: number
  verticalRateFpm: number
  onGround: boolean
  squawk: string | null
  registration: string | null
  aircraftType: string | null
  isMilitary: boolean
  category: string | null
  emergency: string | null
  phase: FlightPhase
  history: PositionSnapshot[]
}
