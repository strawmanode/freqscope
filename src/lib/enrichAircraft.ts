import type { Runway } from '../types'
import type { EnrichedAircraft, RichAircraftState } from '../types/aircraft'
import { updateHistory, getHistory } from './aircraftHistory'
import { getPhaseConfig } from './airspace'
import { classifyPhase } from './flightPhase'
import { getEffectiveActiveRunwayEnds, updateRunwayVotes } from './activeRunways'
import type { MetarData } from '../components/console/StatusPanel'

function buildEnrichedAircraft(
  states: RichAircraftState[],
  runways: Runway[],
  airportIcao: string,
  airportLat: number,
  airportLon: number,
  airportElevationFt: number,
  metar: MetarData | null,
): EnrichedAircraft[] {
  const {
    twr_radius_nm,
    twr_ceil_ft,
    tracon_radius_nm,
    tracon_ceil_ft,
    phase: phaseConfig,
  } = getPhaseConfig(airportIcao)
  // Traffic-observed config wins; wind heuristic only fills in when traffic is sparse
  const activeRunwayEnds = getEffectiveActiveRunwayEnds(airportIcao, runways, metar).ends

  return states.map((s) => {
    const icao24 = s.icao24
    const lat = s.lat
    const lon = s.lon
    const altitudeFt = s.altitudeFt
    const speedKts = s.speedKts != null ? Math.round(s.speedKts) : 0
    const headingDeg = s.trackDeg ?? 0
    const verticalRateFpm =
      s.verticalRateFpm != null ? Math.round(s.verticalRateFpm) : 0
    const onGround = s.onGround
    const squawk = s.squawk
    const callsign = s.callsign
    const history = getHistory(icao24)

    const phase = classifyPhase({
      lat,
      lon,
      altitudeFt,
      speedKts,
      headingDeg,
      onGround,
      history,
      airportLat,
      airportLon,
      airportElevationFt,
      twrRadiusNm: twr_radius_nm,
      twrCeilFt: twr_ceil_ft,
      traconRadiusNm: tracon_radius_nm,
      traconCeilFt: tracon_ceil_ft,
      phase: phaseConfig,
      runways,
      activeRunwayEnds,
    })

    return {
      icao24,
      callsign,
      lat,
      lon,
      altitudeFt,
      speedKts,
      headingDeg,
      verticalRateFpm,
      onGround,
      squawk,
      registration: s.registration,
      aircraftType: s.aircraftType,
      isMilitary: s.isMilitary,
      category: s.category,
      emergency: s.emergency,
      phase,
      history,
    } satisfies EnrichedAircraft
  })
}

export function enrichAircraftStates(
  states: RichAircraftState[],
  runways: Runway[],
  airportIcao: string,
  airportLat: number,
  airportLon: number,
  airportElevationFt: number,
  metar: MetarData | null,
): EnrichedAircraft[] {
  updateHistory(states)
  updateRunwayVotes(airportIcao, states, runways, airportElevationFt)
  return buildEnrichedAircraft(states, runways, airportIcao, airportLat, airportLon, airportElevationFt, metar)
}

export function reclassifyAircraftStates(
  states: RichAircraftState[],
  runways: Runway[],
  airportIcao: string,
  airportLat: number,
  airportLon: number,
  airportElevationFt: number,
  metar: MetarData | null,
): EnrichedAircraft[] {
  return buildEnrichedAircraft(states, runways, airportIcao, airportLat, airportLon, airportElevationFt, metar)
}
