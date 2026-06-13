import type {
  AircraftFeedResult,
  RichAircraftState,
} from '../shared/aircraftTypes.js'
import {
  FeedConfigurationError,
  assertFeedConfigured,
  feedFieldLabel,
  validateFeedIdentityValue,
} from './feedConfig.js'

export type { AircraftFeedResult, AircraftFeedSource } from '../shared/aircraftTypes.js'
export { FeedConfigurationError as AircraftFeedConfigurationError } from './feedConfig.js'

type AdsbAircraft = {
  hex: string
  flight?: string
  alt_baro?: number | 'ground'
  gs?: number
  track?: number
  baro_rate?: number
  lat?: number
  lon?: number
  squawk?: string
  seen_pos?: number
  r?: string
  t?: string
  dbFlags?: number
  category?: string
  emergency?: string
}

export class AircraftFeedRateLimitError extends Error {
  readonly status = 429

  constructor(message: string) {
    super(message)
    this.name = 'AircraftFeedRateLimitError'
  }
}

function extraFeedHeaders(): Record<string, string> {
  const raw = envString('AIRCRAFT_FEED_EXTRA_HEADERS_JSON')
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === 'string' &&
            entry[0].trim().length > 0 &&
            typeof entry[1] === 'string' &&
            entry[1].trim().length > 0,
        )
        .map(([key, value]) => [key.trim(), value.trim()]),
    )
  } catch {
    console.warn(
      '[aircraftFeed] AIRCRAFT_FEED_EXTRA_HEADERS_JSON is not valid JSON; ignoring extra headers',
    )
    return {}
  }
}

function envString(name: string): string | null {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

function requiredFeedEnv(name: string): string {
  const value = envString(name)
  if (!value) {
    throw new FeedConfigurationError(
      `${feedFieldLabel(name)} must be set in .env.local before using the live aircraft feed`,
    )
  }
  validateFeedIdentityValue(name, value)
  return value
}

function optionalFeedEnv(name: string): string | null {
  const value = envString(name)
  if (!value) return null
  validateFeedIdentityValue(name, value)
  return value
}

function aircraftFeedHeaders(): Record<string, string> {
  assertFeedConfigured()
  const application =
    optionalFeedEnv('AIRCRAFT_FEED_X_APPLICATION') ??
    requiredFeedEnv('AIRCRAFT_FEED_APPLICATION')
  const contact = requiredFeedEnv('AIRCRAFT_FEED_CONTACT')
  const userAgent =
    optionalFeedEnv('AIRCRAFT_FEED_USER_AGENT') ?? `${application}/0.1 (${contact})`
  const xContact = optionalFeedEnv('AIRCRAFT_FEED_X_CONTACT') ?? contact

  return {
    ...extraFeedHeaders(),
    Accept: 'application/json',
    'User-Agent': userAgent,
    'X-Application': application,
    'X-Contact': xContact,
  }
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  )
}

function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return km / 1.852
}

function toRichAircraftState(ac: AdsbAircraft): RichAircraftState | null {
  if (ac.lat == null || ac.lon == null) return null

  const altFeet = ac.alt_baro === 'ground' ? 0 : ac.alt_baro
  const onGround = ac.alt_baro === 'ground' || altFeet === 0
  const now = Math.floor(Date.now() / 1000)
  const lastSeen = ac.seen_pos != null ? now - Math.round(ac.seen_pos) : now
  const flags = ac.dbFlags ?? 0
  const emergency =
    ac.emergency != null && ac.emergency !== 'none' ? ac.emergency : null

  return {
    icao24: ac.hex.toLowerCase(),
    callsign: ac.flight?.trim() || null,
    lat: ac.lat,
    lon: ac.lon,
    altitudeFt: typeof altFeet === 'number' ? altFeet : 0,
    onGround,
    speedKts: ac.gs ?? null,
    trackDeg: ac.track ?? null,
    verticalRateFpm: ac.baro_rate ?? null,
    squawk: ac.squawk ?? null,
    lastSeen,
    registration: ac.r ?? null,
    aircraftType: ac.t ?? null,
    isMilitary: (flags & 1) !== 0,
    isInteresting: (flags & 2) !== 0,
    isPIA: (flags & 4) !== 0,
    isLADD: (flags & 8) !== 0,
    category: ac.category ?? null,
    emergency,
  }
}

function filterAndMapAircraft(
  acList: AdsbAircraft[] | undefined,
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
): RichAircraftState[] {
  return (
    acList
      ?.filter(
        (ac) =>
          ac.lat != null &&
          ac.lon != null &&
          ac.lat >= lamin &&
          ac.lat <= lamax &&
          ac.lon >= lomin &&
          ac.lon <= lomax,
      )
      .map(toRichAircraftState)
      .filter((state): state is RichAircraftState => state != null) ?? []
  )
}

function boundingBoxDistNm(
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
): number {
  const centerLat = (lamin + lamax) / 2
  const centerLon = (lomin + lomax) / 2
  return Math.ceil(
    Math.max(
      haversineNm(centerLat, centerLon, lamin, lomin),
      haversineNm(centerLat, centerLon, lamin, lomax),
      haversineNm(centerLat, centerLon, lamax, lomin),
      haversineNm(centerLat, centerLon, lamax, lomax),
    ) + 2,
  )
}

async function fetchStatesFromAirplanesLive(
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
): Promise<AircraftFeedResult> {
  const centerLat = (lamin + lamax) / 2
  const centerLon = (lomin + lomax) / 2
  const distNm = Math.min(boundingBoxDistNm(lamin, lamax, lomin, lomax), 250)

  const url = `https://api.airplanes.live/v2/point/${centerLat}/${centerLon}/${distNm}`
  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      { headers: aircraftFeedHeaders() },
      5000,
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('airplanes.live timed out after 5000ms', { cause: err })
    }
    throw err
  }

  if (response.status === 429) {
    throw new AircraftFeedRateLimitError('airplanes.live rate limited (429)')
  }
  if (!response.ok) {
    throw new Error(`airplanes.live ${response.status}`)
  }

  const data = (await response.json()) as { ac?: AdsbAircraft[] }
  const states = filterAndMapAircraft(data.ac, lamin, lamax, lomin, lomax)

  return {
    time: Math.floor(Date.now() / 1000),
    states,
    source: 'airplanes.live',
  }
}

async function fetchStatesFromAdsbLol(
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
): Promise<AircraftFeedResult> {
  const centerLat = (lamin + lamax) / 2
  const centerLon = (lomin + lomax) / 2
  const distNm = Math.min(boundingBoxDistNm(lamin, lamax, lomin, lomax), 300)

  const url = `https://api.adsb.lol/v2/lat/${centerLat}/lon/${centerLon}/dist/${distNm}`
  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      { headers: aircraftFeedHeaders() },
      5000,
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('adsb.lol timed out after 5000ms', { cause: err })
    }
    throw err
  }

  if (response.status === 429) {
    throw new AircraftFeedRateLimitError('adsb.lol rate limited (429)')
  }
  if (!response.ok) {
    throw new Error(`adsb.lol ${response.status}`)
  }

  const data = (await response.json()) as { ac?: AdsbAircraft[] }
  const states = filterAndMapAircraft(data.ac, lamin, lamax, lomin, lomax)

  return {
    time: Math.floor(Date.now() / 1000),
    states,
    source: 'adsb.lol',
  }
}

export async function fetchAircraftInBoundingBox(
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
): Promise<AircraftFeedResult> {
  try {
    return await fetchStatesFromAirplanesLive(lamin, lamax, lomin, lomax)
  } catch (primaryErr) {
    if (primaryErr instanceof FeedConfigurationError) {
      throw primaryErr
    }
    console.warn(
      '[aircraftFeed] airplanes.live failed, trying adsb.lol fallback',
      primaryErr,
    )
    return await fetchStatesFromAdsbLol(lamin, lamax, lomin, lomax)
  }
}

/** Exposed for tests and diagnostics. */
export function getFeedRateLimitStatus(): {
  airplanesLiveReady: boolean
  adsbLolReady: boolean
} {
  return {
    airplanesLiveReady: true,
    adsbLolReady: true,
  }
}
