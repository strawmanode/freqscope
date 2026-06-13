import type { Cartesian3 } from 'cesium'

export type AircraftFilter = 'AIR' | 'GND' | 'ALL'
export type AltFilter = 'TWR' | 'TRACON' | 'CTR' | 'ALL'
export type CallsignFilter = 'ALL' | 'ID'

export interface SelectedAircraft {
  icao24: string
  callsign: string
  altitude: string
  altitudeAgl: string
  groundspeed: string
  verticalRate: string
  heading: string
  distanceNm: string
  squawk: string
  trend: string
  aircraftType: string | null
  registration: string | null
  phase: string | null
  isMilitary: boolean
  category: string | null
  emergency: string | null
  onGround: boolean
  position: string
  lastSeen: string
  hex: string
}

export interface TrailFix {
  position: Cartesian3
  lat: number
  lon: number
  time: number
  interpolated: boolean
}

export interface TrailBandSetting {
  length: number
  fade: number
}

export interface TrailConfig {
  twr: TrailBandSetting
  app: TrailBandSetting
  ctr: TrailBandSetting
  gnd: TrailBandSetting
}
