import { Math as CesiumMath, type Viewer } from 'cesium'
import type { RefObject } from 'react'

const BUTTON_CLASS =
  'font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 border rounded transition'

const BUTTON_STYLE = {
  background: 'var(--button-bg)',
  borderColor: 'var(--button-border)',
  color: 'var(--dim)',
} as const

interface CameraControlsProps {
  viewerRef: RefObject<Viewer | null>
  isTilted: boolean
  onTiltToggle: () => void
}

/**
 * Bottom-right camera cluster: hold-to-tilt (▲/▼), hold-to-rotate (◄/►),
 * and the 2D/3D toggle. Hold buttons step the camera every 30 ms until
 * mouseup.
 */
export function CameraControls({ viewerRef, isTilted, onTiltToggle }: CameraControlsProps) {
  const holdCameraStep = (step: (viewer: Viewer) => void) => {
    const viewer = viewerRef.current
    if (!viewer) return
    const interval = window.setInterval(() => {
      step(viewer)
      viewer.scene.requestRender()
    }, 30)
    const stop = () => window.clearInterval(interval)
    window.addEventListener('mouseup', stop, { once: true })
  }

  return (
    <div className="absolute bottom-3 right-3 z-[1000] flex flex-col items-center gap-1">
      {/* Tilt up */}
      <button
        type="button"
        onMouseDown={() =>
          holdCameraStep((viewer) => {
            viewer.camera.setView({
              orientation: {
                heading: viewer.camera.heading,
                pitch: Math.min(
                  viewer.camera.pitch + CesiumMath.toRadians(2),
                  CesiumMath.toRadians(-10),
                ),
                roll: 0,
              },
            })
          })
        }
        className={BUTTON_CLASS}
        style={BUTTON_STYLE}
      >▲</button>

      {/* Middle row: rotate left, 2D/3D, rotate right */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={() =>
            holdCameraStep((viewer) => {
              viewer.camera.setView({
                orientation: {
                  heading: viewer.camera.heading - CesiumMath.toRadians(2),
                  pitch: viewer.camera.pitch,
                  roll: 0,
                },
              })
            })
          }
          className={BUTTON_CLASS}
          style={BUTTON_STYLE}
        >◄</button>

        {/* 2D/3D center */}
        <button
          type="button"
          onClick={onTiltToggle}
          className={BUTTON_CLASS}
          style={{
            background: isTilted ? 'var(--button-active-bg)' : 'var(--button-bg)',
            borderColor: isTilted ? 'var(--green)' : 'var(--button-border)',
            color: isTilted ? 'var(--button-active-text)' : 'var(--dim)',
          }}
        >{isTilted ? '2D' : '3D'}</button>

        <button
          type="button"
          onMouseDown={() =>
            holdCameraStep((viewer) => {
              viewer.camera.setView({
                orientation: {
                  heading: viewer.camera.heading + CesiumMath.toRadians(2),
                  pitch: viewer.camera.pitch,
                  roll: 0,
                },
              })
            })
          }
          className={BUTTON_CLASS}
          style={BUTTON_STYLE}
        >►</button>
      </div>

      {/* Tilt down */}
      <button
        type="button"
        onMouseDown={() =>
          holdCameraStep((viewer) => {
            viewer.camera.setView({
              orientation: {
                heading: viewer.camera.heading,
                pitch: Math.max(
                  viewer.camera.pitch - CesiumMath.toRadians(2),
                  CesiumMath.toRadians(-90),
                ),
                roll: 0,
              },
            })
          })
        }
        className={BUTTON_CLASS}
        style={BUTTON_STYLE}
      >▼</button>
    </div>
  )
}
