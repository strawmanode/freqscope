import type { AnimationPreset } from '../../lib/airspaceAnimationPresets'
import type { ReactNode } from 'react'
import { RadarMap } from '../RadarMap'
import type {
  AircraftFilter,
  AltFilter,
  CallsignFilter,
  SelectedAircraft,
} from '../radar/types'
import type { Airport } from '../../types'
import type { MetarData } from './StatusPanel'
import type { RadarThemeId } from '../../lib/radarThemes'
import type { TypeFilterState } from '../../lib/targetClass'

export interface RadarBezelProps {
  airport: Airport
  rangeNm: number
  filter: AircraftFilter
  altFilter: AltFilter
  callsignFilter: CallsignFilter
  typeFilters: TypeFilterState
  onAircraftCountChange: (n: number) => void
  metarData?: MetarData | null
  trailConfig: {
    twr: { length: number; fade: number }
    app: { length: number; fade: number }
    ctr: { length: number; fade: number }
    gnd: { length: number; fade: number }
  }
  airspaceVisible: boolean
  landmarksVisible: boolean
  suaMoaVisible: boolean
  suaRestrictedVisible: boolean
  suaWarningVisible: boolean
  suaAlertVisible: boolean
  tfrVisible: boolean
  animationPreset: AnimationPreset
  onResetView?: (fn: () => void) => void
  onAircraftSelect?: (aircraft: SelectedAircraft | null) => void
  onEmergencyAircraftChange?: (aircraft: SelectedAircraft[]) => void
  onFlyToRef?: (fn: (icao: string) => void) => void
  radarTheme: RadarThemeId
  children?: ReactNode
}

export function RadarBezel({
  airport,
  rangeNm,
  filter,
  altFilter,
  callsignFilter,
  typeFilters,
  onAircraftCountChange,
  metarData = null,
  trailConfig,
  airspaceVisible,
  landmarksVisible,
  suaMoaVisible,
  suaRestrictedVisible,
  suaWarningVisible,
  suaAlertVisible,
  tfrVisible,
  animationPreset,
  onResetView,
  onAircraftSelect,
  onEmergencyAircraftChange,
  onFlyToRef,
  radarTheme,
  children,
}: RadarBezelProps) {
  return (
    <div className="radar-bezel noise">
      <span className="screw screw-tl" />
      <span className="screw screw-tr" />
      <span className="screw screw-bl" />
      <span className="screw screw-br" />

      <div id="scope">
        <RadarMap
          key={airport.icao}
          airport={airport}
          rangeNm={rangeNm}
          filter={filter}
          altFilter={altFilter}
          callsignFilter={callsignFilter}
          typeFilters={typeFilters}
          onAircraftCountChange={onAircraftCountChange}
          metarData={metarData}
          trailConfig={trailConfig}
          airspaceVisible={airspaceVisible}
          landmarksVisible={landmarksVisible}
          suaMoaVisible={suaMoaVisible}
          suaRestrictedVisible={suaRestrictedVisible}
          suaWarningVisible={suaWarningVisible}
          suaAlertVisible={suaAlertVisible}
          tfrVisible={tfrVisible}
          animationPreset={animationPreset}
          onResetView={onResetView}
          onAircraftSelect={onAircraftSelect}
          onEmergencyAircraftChange={onEmergencyAircraftChange}
          onFlyToRef={onFlyToRef}
          radarTheme={radarTheme}
        />
      </div>
      {children}
      <div className="scope-scanlines" aria-hidden />
      <div className="scope-vignette" aria-hidden />
    </div>
  )
}
