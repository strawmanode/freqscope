export function liveAtcSearchUrl(icao: string): string {
  return `https://www.liveatc.net/search/?icao=${encodeURIComponent(icao)}`
}
