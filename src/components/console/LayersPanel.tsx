import { ANIMATION_PRESETS, type AnimationPreset } from '../../lib/airspaceAnimationPresets'
import {
  getLandmarkColor,
  LANDMARK_LEGEND,
  RADAR_THEME_OPTIONS,
  type RadarThemeId,
} from '../../lib/radarThemes'

interface LayersBarProps {
  airspaceVisible: boolean
  onAirspaceToggle: () => void
  landmarksVisible: boolean
  onLandmarksToggle: () => void
  suaMoaVisible: boolean
  suaRestrictedVisible: boolean
  suaWarningVisible: boolean
  suaAlertVisible: boolean
  tfrVisible: boolean
  onSuaMoaToggle: () => void
  onSuaRestrictedToggle: () => void
  onSuaWarningToggle: () => void
  onSuaAlertToggle: () => void
  onTfrToggle: () => void
  animationPreset: AnimationPreset
  onPresetChange: (preset: AnimationPreset) => void
  radarTheme: RadarThemeId
  onThemeChange: (theme: RadarThemeId) => void
}

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '5px 4px',
  margin: 0,
  fontSize: 9,
  letterSpacing: 1.5,
  minWidth: 0,
  boxSizing: 'border-box',
}

export function LayersBar({
  airspaceVisible,
  onAirspaceToggle,
  landmarksVisible,
  onLandmarksToggle,
  suaMoaVisible,
  suaRestrictedVisible,
  suaWarningVisible,
  suaAlertVisible,
  tfrVisible,
  onSuaMoaToggle,
  onSuaRestrictedToggle,
  onSuaWarningToggle,
  onSuaAlertToggle,
  onTfrToggle,
  animationPreset,
  onPresetChange,
  radarTheme,
  onThemeChange,
}: LayersBarProps) {
  const suaButtons: { label: string; visible: boolean; onClick: () => void }[] = [
    { label: 'MOA', visible: suaMoaVisible, onClick: onSuaMoaToggle },
    { label: 'RESTR', visible: suaRestrictedVisible, onClick: onSuaRestrictedToggle },
    { label: 'WARN', visible: suaWarningVisible, onClick: onSuaWarningToggle },
    { label: 'ALERT', visible: suaAlertVisible, onClick: onSuaAlertToggle },
  ]

  return (
    <section className="bsec bsec-layers metal noise">
      <div className="bsec-title">MAP LAYERS</div>
      <div className="layers-bar">
        <div className="layers-group">
          <div className="filter-label">VISIBILITY</div>
          <div className="layers-stack">
            <button
              type="button"
              className={`btn ${airspaceVisible ? 'active' : ''}`}
              style={btnStyle}
              onClick={onAirspaceToggle}
            >
              AIRSPACE
            </button>
            <button
              type="button"
              className={`btn ${landmarksVisible ? 'active' : ''}`}
              style={btnStyle}
              onClick={onLandmarksToggle}
            >
              LANDMARKS
            </button>
          </div>
          <div
            className="layers-legend"
            style={{ opacity: landmarksVisible ? 1 : 0.45 }}
          >
            {LANDMARK_LEGEND.map(({ label, category }) => (
              <span key={category} className="lg">
                <span
                  aria-hidden
                  className="lg-dot"
                  style={{ background: getLandmarkColor(radarTheme, category) }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="layers-group">
          <div className="filter-label">SPECIAL USE</div>
          <div
            className="layers-grid"
            style={{ opacity: airspaceVisible ? 1 : 0.45 }}
          >
            {suaButtons.map(({ label, visible, onClick }) => (
              <button
                key={label}
                type="button"
                className={`btn ${visible ? 'active' : ''}`}
                style={btnStyle}
                disabled={!airspaceVisible}
                onClick={onClick}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`btn ${tfrVisible ? 'active' : ''}`}
              style={{ ...btnStyle, gridColumn: '1 / -1' }}
              disabled={!airspaceVisible}
              onClick={onTfrToggle}
            >
              TFR
            </button>
          </div>
        </div>

        <div className="layers-group">
          <div className="filter-label">THEME</div>
          <div className="layers-stack">
            {RADAR_THEME_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`btn ${radarTheme === id ? 'active' : ''}`}
                style={btnStyle}
                onClick={() => onThemeChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="layers-group">
          <div className="filter-label">ANIMATION</div>
          <div className="layers-grid">
            {ANIMATION_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`btn ${animationPreset === id ? 'active' : ''}`}
                style={btnStyle}
                onClick={() => onPresetChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
