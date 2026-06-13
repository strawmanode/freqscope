/**
 * Aircraft photo lookup via the planespotters.net public API (hex, then reg).
 * Free for non-commercial use; photographer attribution is required, so the
 * UI must show the photographer and link back to the original photo page.
 */

export interface AircraftPhoto {
  /** ~640px-wide thumbnail suitable for the detail card. */
  thumbnailUrl: string
  /** Photo page on planespotters.net (attribution link). */
  link: string
  photographer: string
}

interface PlanespottersPhoto {
  thumbnail?: { src?: string }
  thumbnail_large?: { src?: string }
  link?: string
  photographer?: string
}

// Session-scoped cache; null = looked up, no photo available
const cache = new Map<string, AircraftPhoto | null>()
const inflight = new Map<string, Promise<AircraftPhoto | null>>()

function lookupCacheKey(hex: string, registration?: string | null): string {
  const reg = registration?.trim()
  return reg ? `${hex}|reg:${reg.toLowerCase()}` : hex
}

function photoFromResponse(data: { photos?: PlanespottersPhoto[] }): AircraftPhoto | null {
  const photo = data.photos?.[0]
  const src = photo?.thumbnail_large?.src ?? photo?.thumbnail?.src
  if (!src) return null
  return {
    thumbnailUrl: src,
    link: photo?.link ?? 'https://www.planespotters.net/',
    photographer: photo?.photographer ?? 'planespotters.net',
  }
}

async function fetchPlanespottersPhoto(path: string): Promise<AircraftPhoto | null> {
  const res = await fetch(`https://api.planespotters.net/pub/photos/${path}`)
  if (!res.ok) return null
  const data = (await res.json()) as { photos?: PlanespottersPhoto[] }
  return photoFromResponse(data)
}

export function fetchAircraftPhoto(
  icao24: string,
  registration?: string | null,
): Promise<AircraftPhoto | null> {
  const hex = icao24.trim().toLowerCase()
  if (!hex) return Promise.resolve(null)

  const cacheKey = lookupCacheKey(hex, registration)
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return Promise.resolve(cached)

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const request = (async (): Promise<AircraftPhoto | null> => {
    try {
      let result = await fetchPlanespottersPhoto(`hex/${encodeURIComponent(hex)}`)
      const reg = registration?.trim()
      if (!result && reg) {
        result = await fetchPlanespottersPhoto(`reg/${encodeURIComponent(reg)}`)
      }
      cache.set(cacheKey, result)
      return result
    } catch {
      // Network hiccup: cache the miss for this session rather than retrying
      // on every selection of the same target
      cache.set(cacheKey, null)
      return null
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, request)
  return request
}
