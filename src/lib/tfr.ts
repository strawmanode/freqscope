export interface TemporaryFlightRestriction {
  id: string
  notamId: string
  facility: string | null
  state: string | null
  type: string
  title: string
  lastModified: string | null
  startsAt: string | null
  endsAt: string | null
  activeStatus: 'active' | 'upcoming' | 'expired' | 'unknown'
  boundary: number[][]
}

interface TfrResponse {
  areas?: TemporaryFlightRestriction[]
}

const CLIENT_CACHE_MS = 240_000
const cache = new Map<
  string,
  { fetchedAtMs: number; areas: TemporaryFlightRestriction[] }
>()

function isTfrArea(value: unknown): value is TemporaryFlightRestriction {
  if (!value || typeof value !== 'object') return false
  const candidate = value as TemporaryFlightRestriction
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.notamId === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.activeStatus === 'string' &&
    Array.isArray(candidate.boundary)
  )
}

export async function getTfrNear(
  lat: number,
  lon: number,
  radiusNm = 250,
): Promise<TemporaryFlightRestriction[]> {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusNm}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAtMs < CLIENT_CACHE_MS) {
    return cached.areas
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radiusNm: String(radiusNm),
  })
  const res = await fetch(`/api/tfrs?${params.toString()}`)
  if (!res.ok) return []

  const payload = (await res.json()) as TfrResponse
  const areas = Array.isArray(payload.areas)
    ? payload.areas.filter(isTfrArea)
    : []
  cache.set(key, { fetchedAtMs: Date.now(), areas })
  return areas
}
