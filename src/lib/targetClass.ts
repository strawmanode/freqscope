import type { RichAircraftState } from '../types/aircraft'

/**
 * Display classes for target-type filtering, derived from the feed's
 * military flag and the ADS-B emitter category (A1 light … A7 rotorcraft).
 */
export type TargetClass = 'mil' | 'heavy' | 'airliner' | 'ga' | 'helo' | 'other'

export type TypeFilterState = Record<TargetClass, boolean>

export const TARGET_CLASS_OPTIONS: { id: TargetClass; label: string; hint: string }[] = [
  { id: 'mil', label: 'MILITARY', hint: 'Flagged military hex ranges' },
  { id: 'heavy', label: 'HEAVY', hint: 'Emitter category A5 (>300k lbs)' },
  { id: 'airliner', label: 'AIRLINER', hint: 'Emitter categories A3–A4' },
  { id: 'ga', label: 'GA / LIGHT', hint: 'Emitter categories A1, A2, A6' },
  { id: 'helo', label: 'HELICOPTER', hint: 'Emitter category A7' },
  { id: 'other', label: 'OTHER / UNK', hint: 'No emitter category reported' },
]

export const DEFAULT_TYPE_FILTERS: TypeFilterState = {
  mil: true,
  heavy: true,
  airliner: true,
  ga: true,
  helo: true,
  other: true,
}

export function classifyTarget(state: RichAircraftState): TargetClass {
  if (state.isMilitary) return 'mil'
  const c = (state.category ?? '').toUpperCase()
  if (c === 'A7') return 'helo'
  if (c === 'A5') return 'heavy'
  if (c === 'A3' || c === 'A4') return 'airliner'
  if (c === 'A1' || c === 'A2' || c === 'A6') return 'ga'
  return 'other'
}

export function countDisabledTypeFilters(filters: TypeFilterState): number {
  return TARGET_CLASS_OPTIONS.filter(({ id }) => !filters[id]).length
}
