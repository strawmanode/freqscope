/** Client poll interval for aircraft feed requests. */
export const AIRCRAFT_POLL_INTERVAL_MS = 5_000

/** Minimum gap between client fetches (debounce overlapping requests). */
export const AIRCRAFT_MIN_FETCH_GAP_MS = 5_000

/** adsb.lol fair-use: max 1 request per second (non-feeder). */
export const ADSB_MIN_INTERVAL_MS = 1_000
