import type { Runway } from '../types'
import type { RichAircraftState } from '../types/aircraft'
import type { MetarData } from '../components/console/StatusPanel'
import { angleDiffDeg, haversineNm, initialBearingDeg } from './flightPhase'
import { getActiveRunwayEnds } from './runway'

const DEG_TO_RAD = Math.PI / 180
const NM_PER_FT = 1 / 6076.115

/** Votes older than this are discarded — a config change self-corrects within minutes. */
const VOTE_WINDOW_MS = 20 * 60 * 1000
/** An end needs this many votes in the window to be considered active
 *  (a single landing produces a final vote + a roll vote). */
const MIN_VOTES = 2

// Runway roll (touchdown rollout or takeoff roll — both vote the same end)
const ROLL_MIN_KTS = 45
const ROLL_CROSS_TOLERANCE_NM = 0.025
const ROLL_END_BUFFER_NM = 0.03
const ROLL_TRACK_TOL_DEG = 30

// Final approach — cross-track kept below closely-spaced parallel separation
// (SFO 28L/28R ≈ 0.123 nm, ATL parallels ≈ 0.17 nm) so a final on one parallel
// never votes its neighbor.
const FINAL_MAX_ALONG_NM = 8
const FINAL_MIN_ALONG_NM = 0.2
const FINAL_MAX_CROSS_NM = 0.1
const FINAL_MAX_AGL_FT = 4000
const FINAL_MIN_SINK_FPM = 200
const FINAL_TRACK_TOL_DEG = 25

// Initial climb — same parallel-separation constraint; early-turning departures
// simply don't cast a climb vote (their roll vote already counted).
const CLIMB_MAX_AGL_FT = 2500
const CLIMB_MIN_FPM = 300
const CLIMB_MAX_PAST_NM = 4
const CLIMB_MAX_CROSS_NM = 0.12
const CLIMB_TRACK_TOL_DEG = 20

type VoteKind = 'roll' | 'final' | 'climb'

/** endName → vote timestamps (per airport) */
const votesByAirport = new Map<string, Map<string, number[]>>()
/** `${icao24}:${end}:${kind}` → last vote time (per airport) — one vote per
 *  aircraft per end per kind per window, so a long final can't stuff the box. */
const dedupeByAirport = new Map<string, Map<string, number>>()

function castVote(
  airportIcao: string,
  icao24: string,
  endName: string,
  kind: VoteKind,
  now: number,
): void {
  let dedupe = dedupeByAirport.get(airportIcao)
  if (!dedupe) {
    dedupe = new Map()
    dedupeByAirport.set(airportIcao, dedupe)
  }
  const key = `${icao24}:${endName}:${kind}`
  const last = dedupe.get(key)
  if (last != null && now - last < VOTE_WINDOW_MS) return
  dedupe.set(key, now)

  let votes = votesByAirport.get(airportIcao)
  if (!votes) {
    votes = new Map()
    votesByAirport.set(airportIcao, votes)
  }
  const list = votes.get(endName) ?? []
  list.push(now)
  votes.set(endName, list)
}

function pruneVotes(airportIcao: string, now: number): Map<string, number[]> {
  const votes = votesByAirport.get(airportIcao) ?? new Map<string, number[]>()
  for (const [end, list] of votes) {
    const fresh = list.filter((t) => now - t <= VOTE_WINDOW_MS)
    if (fresh.length === 0) votes.delete(end)
    else votes.set(end, fresh)
  }
  const dedupe = dedupeByAirport.get(airportIcao)
  if (dedupe) {
    for (const [key, t] of dedupe) {
      if (now - t > VOTE_WINDOW_MS) dedupe.delete(key)
    }
  }
  return votes
}

/** Observe one poll's aircraft states and cast runway-end votes.
 *  Matches against ALL ends (never the current active set) so a flow change
 *  is always detectable. */
export function updateRunwayVotes(
  airportIcao: string,
  states: RichAircraftState[],
  runways: Runway[],
  airportElevationFt: number,
  now = Date.now(),
): void {
  if (runways.length === 0) return

  for (const s of states) {
    const track = s.trackDeg
    if (track == null) continue
    const lat = s.lat
    const lon = s.lon
    const aglFt = s.altitudeFt - airportElevationFt
    const vr = s.verticalRateFpm ?? 0
    const speed = s.speedKts ?? 0

    if (s.onGround) {
      // Runway roll — on the runway corridor, fast, aligned with an end
      if (speed < ROLL_MIN_KTS) continue
      for (const rwy of runways) {
        const [a, b] = rwy.ends
        const lengthNm = rwy.length_ft * NM_PER_FT
        const distA = haversineNm(a.lat, a.lon, lat, lon)
        if (distA > lengthNm + ROLL_END_BUFFER_NM) continue
        const bearingAB = initialBearingDeg(a.lat, a.lon, b.lat, b.lon)
        const bearingAP = initialBearingDeg(a.lat, a.lon, lat, lon)
        const diff = angleDiffDeg(bearingAB, bearingAP)
        const alongNm = distA * Math.cos(diff * DEG_TO_RAD)
        const crossNm = Math.abs(distA * Math.sin(diff * DEG_TO_RAD))
        if (
          alongNm < -ROLL_END_BUFFER_NM ||
          alongNm > lengthNm + ROLL_END_BUFFER_NM ||
          crossNm > ROLL_CROSS_TOLERANCE_NM
        ) {
          continue
        }
        for (const end of rwy.ends) {
          if (angleDiffDeg(track, end.heading_deg) <= ROLL_TRACK_TOL_DEG) {
            castVote(airportIcao, s.icao24, end.name, 'roll', now)
          }
        }
      }
      continue
    }

    // Airborne — final approach and initial climb votes per end
    for (const rwy of runways) {
      const lengthNm = rwy.length_ft * NM_PER_FT
      for (const end of rwy.ends) {
        const distNm = haversineNm(end.lat, end.lon, lat, lon)
        if (distNm > FINAL_MAX_ALONG_NM + 1) continue
        const bearingToAc = initialBearingDeg(end.lat, end.lon, lat, lon)

        // Final: beyond the threshold on the approach side, descending, aligned
        if (
          aglFt <= FINAL_MAX_AGL_FT &&
          vr <= -FINAL_MIN_SINK_FPM &&
          angleDiffDeg(track, end.heading_deg) <= FINAL_TRACK_TOL_DEG
        ) {
          const approachBearing = (end.heading_deg + 180) % 360
          const diff = angleDiffDeg(bearingToAc, approachBearing)
          const alongNm = distNm * Math.cos(diff * DEG_TO_RAD)
          const crossNm = Math.abs(distNm * Math.sin(diff * DEG_TO_RAD))
          if (
            alongNm >= FINAL_MIN_ALONG_NM &&
            alongNm <= FINAL_MAX_ALONG_NM &&
            crossNm <= FINAL_MAX_CROSS_NM
          ) {
            castVote(airportIcao, s.icao24, end.name, 'final', now)
          }
        }

        // Climb: low, climbing, tracking out along this end's heading
        if (
          aglFt <= CLIMB_MAX_AGL_FT &&
          vr >= CLIMB_MIN_FPM &&
          angleDiffDeg(track, end.heading_deg) <= CLIMB_TRACK_TOL_DEG
        ) {
          const diff = angleDiffDeg(bearingToAc, end.heading_deg)
          const alongNm = distNm * Math.cos(diff * DEG_TO_RAD)
          const crossNm = Math.abs(distNm * Math.sin(diff * DEG_TO_RAD))
          if (
            alongNm > 0 &&
            alongNm <= lengthNm + CLIMB_MAX_PAST_NM &&
            crossNm <= CLIMB_MAX_CROSS_NM
          ) {
            castVote(airportIcao, s.icao24, end.name, 'climb', now)
          }
        }
      }
    }
  }
}

export interface EffectiveActiveRunways {
  ends: Set<string>
  source: 'traffic' | 'wind' | null
}

/** Single source of truth for the active config: traffic-observed ends when
 *  available, METAR wind heuristic as fallback, empty when neither can call it. */
export function getEffectiveActiveRunwayEnds(
  airportIcao: string,
  runways: Runway[],
  metar: MetarData | null,
  now = Date.now(),
): EffectiveActiveRunways {
  const detected = getDetectedRunwayEnds(airportIcao, now)
  if (detected.size > 0) return { ends: detected, source: 'traffic' }
  const wind = getActiveRunwayEnds(runways, metar)
  return { ends: wind, source: wind.size > 0 ? 'wind' : null }
}

/** Runway ends with enough recent traffic evidence. Empty when traffic is too
 *  sparse to call — callers should fall back to the wind heuristic. */
export function getDetectedRunwayEnds(
  airportIcao: string,
  now = Date.now(),
): Set<string> {
  const votes = pruneVotes(airportIcao, now)
  const active = new Set<string>()
  for (const [end, list] of votes) {
    if (list.length >= MIN_VOTES) active.add(end)
  }
  return active
}
