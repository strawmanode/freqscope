export type TfrActiveStatus = 'active' | 'upcoming' | 'expired' | 'unknown'

export interface TfrSchedule {
  startsAt: string | null
  endsAt: string | null
  activeStatus: TfrActiveStatus
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

const DATE_WORD =
  '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\\s*,?\\s*(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2}),\\s+(\\d{4})'
const DATE_RE = new RegExp(DATE_WORD, 'i')
const RANGE_RE = new RegExp(`${DATE_WORD}\\s+through\\s+${DATE_WORD}`, 'i')
const UTC_DATE_TIME_RE =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{4})\s+UTC/i

function isoFromDateParts(
  monthName: string,
  day: string,
  year: string,
  hour = 0,
  minute = 0,
): string | null {
  const month = MONTHS[monthName.toLowerCase()]
  if (month == null) return null
  const timestamp = Date.UTC(Number(year), month, Number(day), hour, minute)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function endOfUtcDay(monthName: string, day: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()]
  if (month == null) return null
  const timestamp = Date.UTC(Number(year), month, Number(day), 23, 59, 59)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function classify(startsAt: string | null, endsAt: string | null, nowMs: number): TfrActiveStatus {
  const startMs = startsAt ? Date.parse(startsAt) : NaN
  const endMs = endsAt ? Date.parse(endsAt) : NaN
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 'unknown'
  if (startMs > nowMs) return 'upcoming'
  if (endMs < nowMs) return 'expired'
  return 'active'
}

export function parseTfrScheduleText(text: string | null | undefined, nowMs = Date.now()): TfrSchedule {
  if (!text) return { startsAt: null, endsAt: null, activeStatus: 'unknown' }

  const range = text.match(RANGE_RE)
  if (range) {
    const startsAt = isoFromDateParts(range[1], range[2], range[3])
    const endsAt = endOfUtcDay(range[4], range[5], range[6])
    return {
      startsAt,
      endsAt,
      activeStatus: classify(startsAt, endsAt, nowMs),
    }
  }

  const single = text.match(DATE_RE)
  if (single) {
    const startsAt = isoFromDateParts(single[1], single[2], single[3])
    const endsAt = endOfUtcDay(single[1], single[2], single[3])
    return {
      startsAt,
      endsAt,
      activeStatus: classify(startsAt, endsAt, nowMs),
    }
  }

  return { startsAt: null, endsAt: null, activeStatus: 'unknown' }
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#xBA;/gi, ' degrees ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
}

function textLinesFromHtml(html: string): string[] {
  return decodeHtmlText(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:tr|td|table|font|b|a)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function dateAfterLabel(lines: string[], label: string): string | null {
  const index = lines.findIndex((line) =>
    line.toLowerCase().includes(label.toLowerCase()),
  )
  if (index < 0) return null

  for (let i = index + 1; i < Math.min(lines.length, index + 5); i++) {
    if (UTC_DATE_TIME_RE.test(lines[i])) return lines[i]
  }
  return null
}

function parseUtcDateTime(text: string | null): string | null {
  if (!text) return null
  const match = text.match(UTC_DATE_TIME_RE)
  if (!match) return null
  const hhmm = match[4]
  return isoFromDateParts(
    match[1],
    match[2],
    match[3],
    Number(hhmm.slice(0, 2)),
    Number(hhmm.slice(2, 4)),
  )
}

export function parseTfrScheduleHtml(html: string | null | undefined, nowMs = Date.now()): TfrSchedule {
  if (!html) return { startsAt: null, endsAt: null, activeStatus: 'unknown' }

  const lines = textLinesFromHtml(html)
  const startsAt = parseUtcDateTime(dateAfterLabel(lines, 'Beginning Date and Time'))
  const endsAt = parseUtcDateTime(dateAfterLabel(lines, 'Ending Date and Time'))

  if (startsAt && endsAt) {
    return {
      startsAt,
      endsAt,
      activeStatus: classify(startsAt, endsAt, nowMs),
    }
  }

  return parseTfrScheduleText(lines.join(' '), nowMs)
}
