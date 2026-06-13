import type { Plugin } from 'vite'
import {
  AircraftFeedConfigurationError,
  AircraftFeedRateLimitError,
  fetchAircraftInBoundingBox,
} from '../lib/aircraftFeed'
import {
  FeedConfigurationError,
  applyFeedConfig,
  getFeedConfigStatus,
} from '../lib/feedConfig'
import {
  parseTfrScheduleHtml,
  parseTfrScheduleText,
  type TfrActiveStatus,
} from '../shared/tfrSchedule'

const TFR_WFS_URL =
  'https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=500&outputFormat=application/json&srsname=EPSG:4326'
const TFR_LIST_URL = 'https://tfr.faa.gov/tfrapi/getTfrList'
const TFR_DETAIL_URL = 'https://tfr.faa.gov/tfrapi/getWebText'
const TFR_DETAIL_CACHE_MS = 300_000

type DevTfrListItem = {
  notam_id?: string
  facility?: string
  state?: string
  type?: string
  description?: string
  mod_abs_time?: string
  gid?: string | null
}

type DevTfrArea = {
  id: string
  notamId: string
  facility: string | null
  state: string | null
  type: string
  title: string
  lastModified: string | null
  startsAt: string | null
  endsAt: string | null
  activeStatus: TfrActiveStatus
  boundary: number[][]
}

const detailScheduleCache = new Map<
  string,
  { fetchedAtMs: number; startsAt: string | null; endsAt: string | null; activeStatus: TfrActiveStatus }
>()

function queryNumber(
  params: URLSearchParams,
  key: string,
): number | null {
  const raw = params.get(key)
  if (raw == null) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

function queryString(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key)
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseNotamKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(/\d\/\d{4}/)
  return match?.[0] ?? null
}

function roundCoord(value: number): number {
  return Math.round(value * 100000) / 100000
}

function polygonRings(geometry: unknown): number[][][] {
  if (!geometry || typeof geometry !== 'object') return []
  const g = geometry as { type?: string; coordinates?: unknown }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    return [g.coordinates[0] as number[][]]
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][][]).map((poly) => poly[0])
  }
  return []
}

function normalizeBoundary(ring: number[][]): number[][] {
  return ring
    .filter((coord) => Array.isArray(coord) && coord.length >= 2)
    .map(([lon, lat]) => [roundCoord(lat), roundCoord(lon)])
}

function pointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i]
    const [latJ, lonJ] = polygon[j]
    if (
      (latI > lat) !== (latJ > lat) &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside
    }
  }
  return inside
}

function tfrBboxAround(lat: number, lon: number, radiusNm: number) {
  const latDelta = radiusNm / 60
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const lonDelta = radiusNm / (60 * cosLat)
  return {
    lamin: lat - latDelta,
    lamax: lat + latDelta,
    lomin: lon - lonDelta,
    lomax: lon + lonDelta,
  }
}

function intersectsTfrBbox(
  area: DevTfrArea,
  bbox: ReturnType<typeof tfrBboxAround>,
): boolean {
  for (const [lat, lon] of area.boundary) {
    if (
      lat >= bbox.lamin &&
      lat <= bbox.lamax &&
      lon >= bbox.lomin &&
      lon <= bbox.lomax
    ) {
      return true
    }
  }

  const midLat = (bbox.lamin + bbox.lamax) / 2
  const midLon = (bbox.lomin + bbox.lomax) / 2
  return pointInPolygon(midLat, midLon, area.boundary)
}

async function fetchDetailSchedule(notamId: string) {
  const cached = detailScheduleCache.get(notamId)
  if (cached && Date.now() - cached.fetchedAtMs < TFR_DETAIL_CACHE_MS) {
    return cached
  }

  const res = await fetch(
    `${TFR_DETAIL_URL}?notamId=${encodeURIComponent(notamId)}`,
  )
  if (!res.ok) return { startsAt: null, endsAt: null, activeStatus: 'unknown' as const }

  const data = await res.json()
  const text = Array.isArray(data) && typeof data[0]?.text === 'string'
    ? data[0].text
    : null
  const schedule = parseTfrScheduleHtml(text)
  detailScheduleCache.set(notamId, { fetchedAtMs: Date.now(), ...schedule })
  return schedule
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

async function enrichUnknownSchedules(areas: DevTfrArea[]): Promise<DevTfrArea[]> {
  const unknownIds = Array.from(
    new Set(
      areas
        .filter((area) => area.activeStatus === 'unknown')
        .map((area) => area.notamId),
    ),
  )
  if (unknownIds.length === 0) return areas

  const entries = await mapWithConcurrency(unknownIds, 5, async (notamId) => {
    const schedule = await fetchDetailSchedule(notamId).catch(() => ({
      startsAt: null,
      endsAt: null,
      activeStatus: 'unknown' as const,
    }))
    return [notamId, schedule] as const
  })
  const schedules = new Map(entries)

  return areas.map((area) => {
    const schedule = schedules.get(area.notamId)
    return schedule ? { ...area, ...schedule } : area
  })
}

async function fetchTfrData(params: URLSearchParams) {
  const [featuresRes, listRes] = await Promise.all([
    fetch(TFR_WFS_URL),
    fetch(TFR_LIST_URL),
  ])
  const [featurePayload, list] = await Promise.all([
    featuresRes.ok ? featuresRes.json() : { features: [] },
    listRes.ok ? listRes.json() : [],
  ])
  const featureCollection = featurePayload as {
    features?: unknown
    timeStamp?: unknown
  }

  const listItems = Array.isArray(list) ? (list as DevTfrListItem[]) : []
  const listById = new Map(
    listItems
      .map((item) => [item.gid ?? item.notam_id ?? null, item] as const)
      .filter(([key]) => Boolean(key)),
  )
  const areas: DevTfrArea[] = []
  const features = Array.isArray(featureCollection.features)
    ? featureCollection.features
    : []
  const nowMs = Date.now()

  for (const [featureIndex, feature] of features.entries()) {
    const props = feature?.properties ?? {}
    const notamId =
      parseNotamKey(props.NOTAM_KEY) ?? parseNotamKey(feature?.id)
    if (!notamId) continue
    const item = listById.get(notamId)
    const title = item?.description ?? props.TITLE ?? notamId
    const schedule = parseTfrScheduleText(title, nowMs)
    for (const [i, ring] of polygonRings(feature?.geometry).entries()) {
      const boundary = normalizeBoundary(ring)
      if (boundary.length < 3) continue
      areas.push({
        id: `${notamId}:${featureIndex}:${i}`,
        notamId,
        facility: item?.facility ?? props.CNS_LOCATION_ID ?? null,
        state: item?.state ?? props.STATE ?? null,
        type: item?.type ?? props.LEGAL ?? 'TFR',
        title,
        lastModified:
          item?.mod_abs_time ?? props.LAST_MODIFICATION_DATETIME ?? null,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        activeStatus: schedule.activeStatus,
        boundary,
      })
    }
  }

  const lat = queryNumber(params, 'lat')
  const lon = queryNumber(params, 'lon')
  const radiusNm = queryNumber(params, 'radiusNm')
  const status = queryString(params, 'status') ?? 'active'
  const spatialAreas =
    lat == null || lon == null || radiusNm == null
      ? areas
      : areas.filter((area) =>
          intersectsTfrBbox(
            area,
            tfrBboxAround(lat, lon, Math.max(1, Math.min(radiusNm, 500))),
          ),
        )
  const enrichedAreas = await enrichUnknownSchedules(spatialAreas)
  const filtered =
    status === 'all'
      ? enrichedAreas
      : enrichedAreas.filter(
          (area) =>
            area.activeStatus === 'active' || area.activeStatus === 'unknown',
        )

  return {
    fetchedAt: new Date().toISOString(),
    sourceTimestamp:
      typeof featureCollection.timeStamp === 'string'
        ? featureCollection.timeStamp
        : null,
    areas: filtered,
    noShape: listItems.filter((item) => {
      const key = item.gid ?? item.notam_id
      return key ? !areas.some((area) => area.notamId === key) : true
    }),
  }
}

async function fetchSigmetData(lat: number, lon: number) {
  const pad = 3
  const bbox = `${lat - pad},${lon - pad},${lat + pad},${lon + pad}`
  const [sigmetRes, gairmetRes] = await Promise.all([
    fetch(`https://aviationweather.gov/api/data/sigmet?format=json&bbox=${bbox}`),
    fetch(`https://aviationweather.gov/api/data/gairmet?format=json&bbox=${bbox}`),
  ])
  const [sigmets, gairmets] = await Promise.all([
    sigmetRes.ok ? sigmetRes.json() : [],
    gairmetRes.ok ? gairmetRes.json() : [],
  ])
  return {
    sigmets: Array.isArray(sigmets) ? sigmets : [],
    airmets: Array.isArray(gairmets) ? gairmets : [],
  }
}

async function fetchMetarData(params: URLSearchParams) {
  const upstreamUrl = new URL('https://aviationweather.gov/api/data/metar')
  params.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value)
  })
  return fetch(upstreamUrl)
}

async function readJsonBody(req: import('http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function aircraftApiPlugin(): Plugin {
  return {
    name: 'aircraft-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''

        if (url.startsWith('/api/feed-config')) {
          if (req.method === 'GET') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(getFeedConfigStatus()))
            return
          }

          if (req.method === 'POST') {
            try {
              const body = (await readJsonBody(req)) as {
                application?: unknown
                contact?: unknown
              } | null
              const application =
                typeof body?.application === 'string' ? body.application : ''
              const contact = typeof body?.contact === 'string' ? body.contact : ''
              const status = applyFeedConfig({ application, contact })
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(status))
            } catch (err) {
              const message =
                err instanceof FeedConfigurationError
                  ? err.message
                  : 'Failed to save feed configuration'
              res.statusCode = err instanceof FeedConfigurationError ? 400 : 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: message }))
            }
            return
          }

          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (url.startsWith('/api/metar')) {
          const { searchParams } = new URL(url, 'http://localhost')
          try {
            const upstream = await fetchMetarData(searchParams)
            const contentType = upstream.headers.get('content-type')
            res.statusCode = upstream.status
            if (contentType) res.setHeader('Content-Type', contentType)
            res.end(Buffer.from(await upstream.arrayBuffer()))
          } catch (err) {
            console.error('[metar-api]', err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('METAR proxy failed')
          }
          return
        }

        if (url.startsWith('/api/sigmet')) {
          const { searchParams } = new URL(url, 'http://localhost')
          const lat = queryNumber(searchParams, 'lat')
          const lon = queryNumber(searchParams, 'lon')
          if (lat == null || lon == null) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing lat/lon' }))
            return
          }

          try {
            const data = await fetchSigmetData(lat, lon)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 's-maxage=60')
            res.end(JSON.stringify(data))
          } catch (err) {
            console.error('[sigmet-api]', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ sigmets: [], airmets: [] }))
          }
          return
        }

        if (url.startsWith('/api/tfrs')) {
          const { searchParams } = new URL(url, 'http://localhost')
          try {
            const data = await fetchTfrData(searchParams)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 's-maxage=60')
            res.end(JSON.stringify(data))
          } catch (err) {
            console.error('[tfr-api]', err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ areas: [], noShape: [] }))
          }
          return
        }

        if (!url.startsWith('/api/aircraft/states/all')) {
          next()
          return
        }

        const { searchParams } = new URL(url, 'http://localhost')
        const lamin = queryNumber(searchParams, 'lamin')
        const lamax = queryNumber(searchParams, 'lamax')
        const lomin = queryNumber(searchParams, 'lomin')
        const lomax = queryNumber(searchParams, 'lomax')

        if (
          lamin == null ||
          lamax == null ||
          lomin == null ||
          lomax == null
        ) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing bounding box query params' }))
          return
        }

        try {
          const data = await fetchAircraftInBoundingBox(
            lamin,
            lamax,
            lomin,
            lomax,
          )
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('X-Feed-Source', data.source)
          res.end(JSON.stringify(data))
        } catch (err) {
          if (
            err instanceof AircraftFeedConfigurationError ||
            err instanceof FeedConfigurationError
          ) {
            res.statusCode = err.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message, code: 'feed_configuration' }))
            return
          }
          if (err instanceof AircraftFeedRateLimitError) {
            res.statusCode = 429
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
            return
          }
          console.error('[aircraft-api]', err)
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Aircraft data proxy failed' }))
        }
      })
    },
  }
}
