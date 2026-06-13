import { CustomDataSource, Math as CesiumMath, Viewer } from 'cesium'
import { isSafari } from '../../../lib/browser'
import type { Airport } from '../../../types'
import type { RadarThemeId } from '../../../lib/radarThemes'
import { cesiumResolutionScale, getTiltedCameraDestination, rangeNmToAltitudeM } from './camera'
import { addAirportEntity } from './icons'
import { applyRadarTheme } from './theme'

export interface ScopeLayers {
  aircraft: CustomDataSource
  trails: CustomDataSource
  runway: CustomDataSource
  airspace: CustomDataSource
  overlay: CustomDataSource
  landmarks: CustomDataSource
}

export interface ScopeViewerHandle {
  viewer: Viewer
  layers: ScopeLayers
  /** Detach all listeners/observers and destroy the viewer. */
  dispose: () => void
}

export interface ScopeViewerOptions {
  container: HTMLElement
  airport: Airport
  radarTheme: RadarThemeId
  initialRangeNm: number
  /** Fired after camera move-end and after container resizes. */
  onViewportChanged: (viewer: Viewer) => void
  onContextLost: () => void
  onContextRestored: () => void
}

/**
 * Create the scope's Cesium viewer: chrome-free widget under
 * requestRenderMode, themed imagery, tilted initial camera, the six entity
 * layers, and lifecycle listeners (camera repaint, WebGL context loss,
 * container resize). Selection/picking handlers are attached by the caller.
 * Throws if the WebGL context cannot be created.
 */
export function createScopeViewer(opts: ScopeViewerOptions): ScopeViewerHandle {
  const { airport } = opts

  const viewer = new Viewer(opts.container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    creditContainer: document.createElement('div'),
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    targetFrameRate: 30,
    orderIndependentTranslucency: !isSafari(),
    contextOptions: {
      webgl: {
        alpha: false,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'high-performance',
      },
    },
  })

  applyRadarTheme(viewer, opts.radarTheme)

  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = false
  if (viewer.scene.sun) viewer.scene.sun.show = false
  if (viewer.scene.moon) viewer.scene.moon.show = false

  viewer.scene.globe.enableLighting = false
  viewer.scene.fog.enabled = false

  viewer.camera.setView({
    destination: getTiltedCameraDestination(
      airport.lon,
      airport.lat,
      rangeNmToAltitudeM(opts.initialRangeNm),
    ),
    orientation: {
      heading: 0,
      pitch: CesiumMath.toRadians(-45),
      roll: 0,
    },
  })

  addAirportEntity(viewer, airport)

  const layers: ScopeLayers = {
    aircraft: new CustomDataSource('aircraft'),
    trails: new CustomDataSource('trails'),
    runway: new CustomDataSource('runways'),
    airspace: new CustomDataSource('airspace'),
    overlay: new CustomDataSource('overlay'),
    landmarks: new CustomDataSource('landmarks'),
  }
  viewer.dataSources.add(layers.aircraft)
  viewer.dataSources.add(layers.trails)
  viewer.dataSources.add(layers.runway)
  viewer.dataSources.add(layers.airspace)
  viewer.dataSources.add(layers.overlay)
  viewer.dataSources.add(layers.landmarks)

  viewer.resolutionScale = cesiumResolutionScale()
  viewer.scene.postProcessStages.fxaa.enabled = false

  // Default changed-threshold (50%) is too coarse under requestRenderMode —
  // small drags and zooms would not repaint until movement accumulates
  viewer.camera.percentageChanged = 0.01
  const removeCameraListener = viewer.camera.changed.addEventListener(() => {
    viewer.scene.requestRender()
  })
  const removeCameraMoveEndListener = viewer.camera.moveEnd.addEventListener(() => {
    opts.onViewportChanged(viewer)
    viewer.scene.requestRender()
  })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    console.warn('[RadarMap] WebGL context lost')
    opts.onContextLost()
  }
  const onContextRestored = () => {
    console.info('[RadarMap] WebGL context restored')
    opts.onContextRestored()
    viewer.scene.requestRender()
  }
  viewer.canvas.addEventListener('webglcontextlost', onContextLost)
  viewer.canvas.addEventListener('webglcontextrestored', onContextRestored)

  // Under requestRenderMode the scene won't repaint when its container
  // changes shape (phone rotation, browser chrome) until something asks
  // for a frame — force a resize + render whenever the scope resizes
  const resizeObserver = new ResizeObserver(() => {
    if (viewer.isDestroyed()) return
    viewer.resize()
    opts.onViewportChanged(viewer)
    viewer.scene.requestRender()
  })
  resizeObserver.observe(opts.container)

  viewer.scene.requestRender()

  return {
    viewer,
    layers,
    dispose: () => {
      resizeObserver.disconnect()
      removeCameraListener()
      removeCameraMoveEndListener()
      viewer.canvas.removeEventListener('webglcontextlost', onContextLost)
      viewer.canvas.removeEventListener('webglcontextrestored', onContextRestored)
      viewer.destroy()
    },
  }
}
