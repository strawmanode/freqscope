import { useEffect, useRef, useState } from 'react'
import type { RichAircraftState } from '../../../types/aircraft'
import type { BoundingBox } from '../../../lib/geo'
import { getAircraftInBoundingBox, AircraftFeedRequestError } from '../../../lib/aircraftFeedClient'
import { normalizeGroundState } from '../../../lib/groundInference'
import { AIRCRAFT_POLL_INTERVAL_MS } from '../../../../shared/aircraftFeedConfig'
import { MIN_FETCH_GAP_MS, RATE_LIMIT_BACKOFF_MS } from '../constants'

interface UseAircraftFeedOptions {
  icao: string
  lat: number
  lon: number
  elevationFt: number
  bbox: BoundingBox
  /** Position (TWR/TRACON/CTR) — changing it resets the fetch throttle so the
   *  wider/narrower bbox is polled immediately instead of waiting a cycle. */
  altFilter: string
}

interface UseAircraftFeedResult {
  states: RichAircraftState[]
  feedError: string | null
  feedConfigRequired: boolean
}

/**
 * Polls the aircraft feed for the given bbox every AIRCRAFT_POLL_INTERVAL_MS,
 * with a minimum gap between fetches, transient-failure tolerance, and a
 * ~60s auto-recovering backoff on rate limits or repeated failures.
 */
export function useAircraftFeed({
  icao,
  lat,
  lon,
  elevationFt,
  bbox,
  altFilter,
}: UseAircraftFeedOptions): UseAircraftFeedResult {
  const [states, setStates] = useState<RichAircraftState[]>([])
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedConfigRequired, setFeedConfigRequired] = useState(false)
  const fetchingRef = useRef(false)
  const lastFetchRef = useRef(0)
  const backoffUntilRef = useRef(0)
  const consecutiveFailuresRef = useRef(0)

  useEffect(() => {
    lastFetchRef.current = 0
    backoffUntilRef.current = 0
  }, [altFilter])

  useEffect(() => {
    let cancelled = false
    const { lamin: minLat, lamax: maxLat, lomin: minLon, lomax: maxLon } = bbox

    // Pause polling, then auto-recover — the error panel promises a ~60s retry
    const enterBackoff = () => {
      backoffUntilRef.current = Date.now() + RATE_LIMIT_BACKOFF_MS
      window.setTimeout(() => {
        if (cancelled) return
        consecutiveFailuresRef.current = 0
        backoffUntilRef.current = 0
        setFeedError(null)
      }, RATE_LIMIT_BACKOFF_MS)
    }

    const fetchAircraft = async () => {
      const now = Date.now()
      if (fetchingRef.current) return
      if (now < backoffUntilRef.current) return
      if (now - lastFetchRef.current < MIN_FETCH_GAP_MS) return

      fetchingRef.current = true
      lastFetchRef.current = now
      try {
        const result = await getAircraftInBoundingBox(
          minLat,
          maxLat,
          minLon,
          maxLon,
          icao,
        )
        if (cancelled) return
        consecutiveFailuresRef.current = 0
        setFeedError(null)
        setFeedConfigRequired(false)
        // Some transponders never flip the air/ground bit while taxiing, which
        // left ground traffic labeled AIRBORNE. Normalize once here so every
        // consumer (datablocks, detail card, phase classifier, runway logic)
        // sees a consistent onGround value.
        setStates(normalizeGroundState(result.states, elevationFt))
      } catch (err: unknown) {
        if (cancelled) return
        if (err instanceof AircraftFeedRequestError && err.code === 'feed_configuration') {
          setFeedConfigRequired(true)
          setFeedError(err.message)
          return
        }
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status: number }).status
            : undefined
        const message = err instanceof Error ? err.message : ''
        if (status === 429 || message.includes('429') || message.toLowerCase().includes('rate limit')) {
          setFeedError('Aircraft feed unavailable — both primary and fallback feeds failed')
          enterBackoff()
        } else {
          consecutiveFailuresRef.current += 1
          if (consecutiveFailuresRef.current >= 8) {
            console.warn('[aircraftFeed] fetch error (killing poll temporarily):', err)
            setFeedError(message || 'Failed to load aircraft')
            enterBackoff()
          } else {
            console.warn('[aircraftFeed] fetch error (transient):', err)
          }
        }
      } finally {
        fetchingRef.current = false
      }
    }

    consecutiveFailuresRef.current = 0
    backoffUntilRef.current = 0
    fetchAircraft()
    const id = window.setInterval(fetchAircraft, AIRCRAFT_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // display filters omitted — client-side filter only; avoids refetch on pill toggle
  }, [icao, lat, lon, elevationFt, altFilter, bbox.lamin, bbox.lamax, bbox.lomin, bbox.lomax])

  return { states, feedError, feedConfigRequired }
}
