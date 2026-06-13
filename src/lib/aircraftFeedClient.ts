import type { AircraftFeedSource, RichAircraftState } from '../../shared/aircraftTypes'

const AIRCRAFT_API_BASE = '/api/aircraft'

export type { AircraftFeedSource }

export type AircraftFeedResponse = {
  states: RichAircraftState[]
  source: AircraftFeedSource
  time: number
}

export type AircraftFeedErrorCode =
  | 'feed_configuration'
  | 'rate_limit'
  | 'upstream'

export class AircraftFeedRequestError extends Error {
  readonly status: number
  readonly code: AircraftFeedErrorCode

  constructor(message: string, status: number, code: AircraftFeedErrorCode) {
    super(message)
    this.name = 'AircraftFeedRequestError'
    this.status = status
    this.code = code
  }
}

export async function getAircraftInBoundingBox(
  lamin: number,
  lamax: number,
  lomin: number,
  lomax: number,
  icao?: string,
): Promise<AircraftFeedResponse> {
  let url = `${AIRCRAFT_API_BASE}/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`
  if (icao) {
    url += `&icao=${encodeURIComponent(icao)}`
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let message = `Aircraft feed ${res.status}`
    let code: AircraftFeedErrorCode = 'upstream'
    try {
      const body = (await res.json()) as { error?: string; code?: string }
      if (body.error) message = body.error
      if (body.code === 'feed_configuration') code = 'feed_configuration'
      else if (res.status === 429) code = 'rate_limit'
    } catch {
      if (res.status === 429) code = 'rate_limit'
    }
    throw new AircraftFeedRequestError(message, res.status, code)
  }
  const data = (await res.json()) as {
    states: RichAircraftState[] | null
    source?: AircraftFeedSource
    time?: number
  }
  const sourceHeader = res.headers.get('X-Feed-Source')
  const source =
    data.source ??
    (sourceHeader === 'airplanes.live' || sourceHeader === 'adsb.lol'
      ? sourceHeader
      : 'airplanes.live')

  return {
    states: data.states ?? [],
    source,
    time: data.time ?? Math.floor(Date.now() / 1000),
  }
}
