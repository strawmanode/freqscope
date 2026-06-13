/**
 * Lightweight METAR summary for the landing page facility tiles and ticker.
 * (The scope console has its own richer parser in Scope.tsx.)
 */

export interface MetarBrief {
  /** e.g. "260/12KT", "260/12G18KT", "VRB/05KT", "CALM" */
  wind: string | null
  /** e.g. "10SM" */
  vis: string | null
  /** e.g. "BKN025", "CLR" */
  sky: string | null
  /** Celsius */
  tempC: number | null
  /** Minutes since observation, when derivable */
  obsAgeMin: number | null
}

export function parseMetarBrief(raw: string): MetarBrief {
  let wind: string | null = null
  const windMatch = raw.match(/\b(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT\b/)
  if (windMatch) {
    const speed = parseInt(windMatch[2], 10)
    if (speed === 0) {
      wind = 'CALM'
    } else {
      const gust = windMatch[4] ? `G${parseInt(windMatch[4], 10)}` : ''
      wind = `${windMatch[1]}/${String(speed).padStart(2, '0')}${gust}KT`
    }
  }

  const visMatch = raw.match(/\b(M?(?:\d+\s+)?\d+\/\d+|\d+)SM\b/)
  const vis = visMatch ? `${visMatch[1]}SM` : null

  let sky: string | null = null
  // Cloud groups may carry a TCU/CB convective suffix (e.g. SCT045TCU)
  const skyMatch = raw.match(/\b(CLR|SKC|NSC|NCD|FEW|SCT|BKN|OVC|VV)(\d{3})?(?:TCU|CB)?\b/)
  if (skyMatch) {
    sky = skyMatch[2] ? `${skyMatch[1]}${skyMatch[2]}` : skyMatch[1]
  }

  let tempC: number | null = null
  const tempMatch = raw.match(/\b(M?)(\d{2})\/(?:M?\d{2})?\b/)
  if (tempMatch) {
    tempC = tempMatch[1] === 'M' ? -parseInt(tempMatch[2], 10) : parseInt(tempMatch[2], 10)
  }

  let obsAgeMin: number | null = null
  const timeMatch = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/)
  if (timeMatch) {
    const now = new Date()
    const obs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      parseInt(timeMatch[1], 10),
      parseInt(timeMatch[2], 10),
      parseInt(timeMatch[3], 10),
    )
    const ageMs = Date.now() - obs
    if (ageMs >= 0 && ageMs < 6 * 3_600_000) obsAgeMin = Math.floor(ageMs / 60_000)
  }

  return { wind, vis, sky, tempC, obsAgeMin }
}

/**
 * Parse a multi-station `format=raw` response: one METAR per line, with the
 * station identifier as the first token.
 */
export function parseMetarBatch(text: string): Map<string, MetarBrief> {
  const briefs = new Map<string, MetarBrief>()
  for (const line of text.split('\n')) {
    // Lines arrive as "METAR KLAX 102253Z …" (or SPECI) — drop the report
    // type token before reading the station identifier
    const trimmed = line.trim().replace(/^(METAR|SPECI)\s+/, '')
    const station = trimmed.match(/^([A-Z][A-Z0-9]{3})\b/)?.[1]
    if (!station) continue
    briefs.set(station, parseMetarBrief(trimmed))
  }
  return briefs
}

export function formatTempFahrenheit(tempC: number): string {
  return `${Math.round((tempC * 9) / 5 + 32)}°F`
}
