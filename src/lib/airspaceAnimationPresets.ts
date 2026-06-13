export type AnimationPreset = 'static' | 'pulse' | 'shimmer' | 'strobe' | 'scan' | 'shift'

export const ANIMATION_PRESETS: { id: AnimationPreset; label: string }[] = [
  { id: 'static', label: 'STATIC' },
  { id: 'pulse', label: 'PULSE' },
  { id: 'shimmer', label: 'SHIMMER' },
  { id: 'strobe', label: 'STROBE' },
  { id: 'scan', label: 'SCAN' },
  { id: 'shift', label: 'SHIFT' },
]
