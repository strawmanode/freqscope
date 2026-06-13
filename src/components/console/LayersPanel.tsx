import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ANIMATION_PRESETS, type AnimationPreset } from '../../lib/airspaceAnimationPresets'
import {
  getLandmarkColor,
  LANDMARK_LEGEND,
  RADAR_THEME_OPTIONS,
  type RadarThemeId,
} from '../../lib/radarThemes'

interface LayersDropdownProps {
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

const gridBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '3px 2px',
  fontSize: 8,
  letterSpacing: 1,
  marginBottom: 0,
  minWidth: 0,
  boxSizing: 'border-box',
}

export function LayersDropdown({
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
}: LayersDropdownProps) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Portal into the console root so theme CSS variables apply
  const [portalTarget, setPortalTarget] = useState<HTMLElement>(() => document.body)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setAnchor({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
      setPortalTarget((buttonRef.current.closest('.console') as HTMLElement) ?? document.body)
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        title="Map layers, theme & animation"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          letterSpacing: 2,
          color: open ? 'var(--position-toolbar-active-text)' : 'var(--position-muted-color)',
          background: open ? 'var(--position-toolbar-active-bg)' : 'transparent',
          border: '1px solid var(--position-bar-border)',
          borderRadius: 3,
          padding: '2px 8px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        LAYERS {open ? '▴' : '▾'}
      </button>

      {open && anchor &&
        createPortal(
          <div
            ref={panelRef}
            className="layers-dropdown"
            style={{
              position: 'fixed',
              top: anchor.top,
              right: anchor.right,
              zIndex: 4000,
              width: 224,
              padding: '8px 10px 10px',
              background: 'var(--position-bar-bg)',
              border: '1px solid var(--position-bar-border)',
              borderRadius: 5,
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)',
              fontFamily: 'var(--mono)',
            }}
          >
            <div className="section-title">LAYERS</div>
            <button
              type="button"
              className={`btn ${airspaceVisible ? 'active' : ''}`}
              style={{ width: '100%', padding: '4px 4px', fontSize: 9, letterSpacing: 2, marginBottom: 3, boxSizing: 'border-box' }}
              onClick={onAirspaceToggle}
            >
              AIRSPACE
            </button>
            <button
              type="button"
              className={`btn ${landmarksVisible ? 'active' : ''}`}
              style={{ width: '100%', padding: '4px 4px', fontSize: 9, letterSpacing: 2, marginBottom: 3, boxSizing: 'border-box' }}
              onClick={onLandmarksToggle}
            >
              LANDMARKS
            </button>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 3,
              width: '100%',
              marginBottom: 3,
              opacity: landmarksVisible ? 1 : 0.45,
            }}>
              {LANDMARK_LEGEND.map(({ label, category }) => (
                <div
                  key={category}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 8,
                    letterSpacing: 1,
                    color: 'var(--dim)',
                    padding: '2px 0',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 1,
                      background: getLandmarkColor(radarTheme, category),
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 3,
              width: '100%',
              marginBottom: 3,
              opacity: airspaceVisible ? 1 : 0.45,
            }}>
              <button
                type="button"
                className={`btn ${suaMoaVisible ? 'active' : ''}`}
                style={gridBtnStyle}
                disabled={!airspaceVisible}
                onClick={onSuaMoaToggle}
              >
                MOA
              </button>
              <button
                type="button"
                className={`btn ${suaRestrictedVisible ? 'active' : ''}`}
                style={gridBtnStyle}
                disabled={!airspaceVisible}
                onClick={onSuaRestrictedToggle}
              >
                RESTR
              </button>
              <button
                type="button"
                className={`btn ${suaWarningVisible ? 'active' : ''}`}
                style={gridBtnStyle}
                disabled={!airspaceVisible}
                onClick={onSuaWarningToggle}
              >
                WARN
              </button>
              <button
                type="button"
                className={`btn ${suaAlertVisible ? 'active' : ''}`}
                style={gridBtnStyle}
                disabled={!airspaceVisible}
                onClick={onSuaAlertToggle}
              >
                ALERT
              </button>
              <button
                type="button"
                className={`btn ${tfrVisible ? 'active' : ''}`}
                style={gridBtnStyle}
                disabled={!airspaceVisible}
                onClick={onTfrToggle}
              >
                TFR
              </button>
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', margin: '6px 0 4px' }}>THEME</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 3,
              width: '100%',
            }}>
              {RADAR_THEME_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ${radarTheme === id ? 'active' : ''}`}
                  style={gridBtnStyle}
                  onClick={() => onThemeChange(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', margin: '6px 0 4px' }}>ANIM</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 3,
              width: '100%',
            }}>
              {ANIMATION_PRESETS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ${animationPreset === id ? 'active' : ''}`}
                  style={gridBtnStyle}
                  onClick={() => onPresetChange(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>,
          portalTarget,
        )}
    </>
  )
}
