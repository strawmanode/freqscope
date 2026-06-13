export type AircraftFeedSource = 'airplanes.live' | 'adsb.lol'

export interface RichAircraftState {
  icao24: string
  callsign: string | null
  lat: number
  lon: number
  altitudeFt: number
  onGround: boolean
  speedKts: number | null
  trackDeg: number | null
  verticalRateFpm: number | null
  squawk: string | null
  lastSeen: number
  registration: string | null
  aircraftType: string | null
  isMilitary: boolean
  isInteresting: boolean
  isPIA: boolean
  isLADD: boolean
  category: string | null
  emergency: string | null
}

export type AircraftFeedResult = {
  time: number
  states: RichAircraftState[]
  source: AircraftFeedSource
}
