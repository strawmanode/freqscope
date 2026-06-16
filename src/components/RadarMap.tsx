import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

;(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/'

import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  Math as CesiumMath,
  NearFarScalar,
  DistanceDisplayCondition,
  ScreenSpaceEventType,
  defined,
  CustomDataSource,
  Transforms,
  HeadingPitchRoll,
  ConstantPositionProperty,
  ConstantProperty,
  Matrix4,
  type ScreenSpaceEventHandler,
} from 'cesium'
import { aircraftModelHeadingFromTrack, resolveAircraftModel } from '../lib/aircraftModels'
import { useFeedSetup } from './setup/useFeedSetup'
import { isSafari } from '../lib/browser'
import type { Airport } from '../types'
import { getEffectiveActiveRunwayEnds } from '../lib/activeRunways'
import type { EnrichedAircraft, RichAircraftState } from '../types/aircraft'
import type { MetarData } from './console/StatusPanel'
import { getAirspace, getArtcc } from '../lib/airspace'
import { enrichAircraftStates } from '../lib/enrichAircraft'
import { bboxAround, destinationPoint, fetchRadiusForFilter, haversineNm } from '../lib/geo'
import { getSuaNear } from '../lib/sua'
import { getTfrNear, type TemporaryFlightRestriction } from '../lib/tfr'
import { renderRangeRings, updateSelectionRing, upsertJRing, updateLeaderLinePositions, upsertLeaderLine } from '../lib/scopeOverlays'
import { DR_TICK_MS, deadReckon, type DrPosition } from '../lib/deadReckoning'
import {
  AIRCRAFT_POLL_INTERVAL_MS,
} from '../../shared/aircraftFeedConfig'
import { SUA_LEGEND, airspaceColor, isVfrTarget } from '../lib/airspaceColor'
import { renderTowerAirspace, renderClassBAirspace, renderArtccAirspace, renderSuaAirspace, renderTfrAirspace } from '../lib/airspaceLayers'
import { getAirspacePalette, getTfrColor } from '../lib/airspacePalette'
import type { AnimationPreset } from '../lib/airspaceAnimationPresets'
import {
  getLandmarkColor,
  getRadarTheme,
  LANDMARK_LEGEND,
  type RadarThemeId,
} from '../lib/radarThemes'
import {
  DEFAULT_TYPE_FILTERS,
  type TypeFilterState,
} from '../lib/targetClass'
import { renderRunways } from '../lib/runwayLayers'
import { getLandmarksNear } from '../lib/landmarks'
import { renderLandmarks } from '../lib/landmarkLayers'
import runwaysData from '../data/runways.json'
import { AircraftDetailCard } from './radar/AircraftDetailCard'
import { CameraControls } from './radar/CameraControls'
import { useAircraftFeed } from './radar/hooks/useAircraftFeed'
import { createScopeViewer, type ScopeViewerHandle } from './radar/engine/viewerSetup'
import type {
  AircraftFilter,
  AltFilter,
  CallsignFilter,
  SelectedAircraft,
  TrailFix,
} from './radar/types'
import {
  BILLBOARD_SCALE_BY_DISTANCE,
  CENTER_DECLUTTER_RANGE_NM,
  CLEAR_SELECTION_MIN_PX,
  DRILLPICK_MAX_SLACK_PX,
  EMERGENCY_CSS,
  ICON_PICK_PRIORITY_BIAS_PX,
  LEADER_LENGTH_RANGE_RATIO,
  LEADER_LOD_CUTOFF_M,
  LEADER_MIN_SPEED_KTS,
  MAX_ICON_PICK_DISTANCE_PX,
  MODEL_LOD_CUTOFF_M,
  TRACON_TRACK_DECLUTTER_RANGE_NM,
  TRAIL_INTERP_COUNT,
} from './radar/constants'
import {
  buildDatablockText,
  emergencyAlertCode,
  timesharePhase,
  type TimesharePhase,
} from './radar/domain/datablock'
import {
  matchesAltFilter,
  matchesCallsignFilter,
  matchesTrafficFilter,
  matchesTypeFilter,
} from './radar/domain/filters'
import { toSelectedAircraft } from './radar/domain/selectedAircraft'
import { dedupeStatesByIcao } from './radar/domain/filters'
import { buildNearbyLabelSet, computeLabelPixelOffset } from './radar/domain/labels'
import {
  aircraftUses3DModel,
  deadReckonBaseMs,
  deadReckonContext,
  getLeaderTrackDeg,
} from './radar/domain/tracks'
import { getTrailBandConfig, recordTrailFixes, scopeHeightM } from './radar/domain/trails'
import {
  getTiltedCameraDestination,
  rangeNmToAltitudeM,
} from './radar/engine/camera'
import {
  aircraftLabelDistanceDisplayCondition,
  buildAircraftBillboard,
  cachedAlphaColor,
  cachedColor,
  getAircraftBillboardUri,
  themedLabelBackground,
  themedLabelPadding,
  upsertTrailDot,
} from './radar/engine/icons'
import {
  displayWorldPos,
  findAircraftAtClick,
  isNonAircraftEntityId,
  screenIconDistanceToAircraft,
} from './radar/engine/picking'
import {
  applyRadarTheme,
  themedAirspaceColor,
  themedAirspaceLegend,
  tfrLegendLabel,
} from './radar/engine/theme'
import {
  isAircraftInsideViewport,
  readViewportBounds,
  viewportBoundsEqual,
  type ViewportBounds,
} from './radar/engine/viewport'
import {
  LandmarkLegendSwatch,
  PolygonLegendSwatch,
  TargetLegendDot,
  TfrLegendSwatch,
} from './radar/LegendSwatches'

const allRunways = runwaysData as unknown as Record<string, import('../types').Runway[]>

interface RadarMapProps {
  airport: Airport
  rangeNm?: number
  filter?: AircraftFilter
  altFilter?: AltFilter
  callsignFilter?: CallsignFilter
  onAircraftCountChange?: (count: number) => void
  metarData?: MetarData | null
  trailConfig?: {
    twr: { length: number; fade: number }
    app: { length: number; fade: number }
    ctr: { length: number; fade: number }
    gnd: { length: number; fade: number }
  }
  airspaceVisible?: boolean
  landmarksVisible?: boolean
  suaMoaVisible?: boolean
  suaRestrictedVisible?: boolean
  suaWarningVisible?: boolean
  suaAlertVisible?: boolean
  tfrVisible?: boolean
  animationPreset?: AnimationPreset
  onResetView?: (fn: () => void) => void
  onAircraftSelect?: (aircraft: SelectedAircraft | null) => void
  onEmergencyAircraftChange?: (aircraft: SelectedAircraft[]) => void
  onFlyToRef?: (fn: (icao: string) => void) => void
  radarTheme: RadarThemeId
  typeFilters?: TypeFilterState
}

export function RadarMap({
  airport,
  rangeNm = 20,
  filter: filterProp,
  altFilter: altFilterProp,
  callsignFilter: callsignFilterProp,
  typeFilters = DEFAULT_TYPE_FILTERS,
  onAircraftCountChange,
  metarData = null,
  trailConfig,
  airspaceVisible = true,
  landmarksVisible = true,
  suaMoaVisible = true,
  suaRestrictedVisible = true,
  suaWarningVisible = true,
  suaAlertVisible = true,
  tfrVisible = true,
  animationPreset = 'pulse',
  onResetView,
  onAircraftSelect,
  onEmergencyAircraftChange,
  onFlyToRef,
  radarTheme,
}: RadarMapProps) {
  const { openSetup } = useFeedSetup()
  const filter: AircraftFilter = filterProp ?? 'AIR'
  const altFilter: AltFilter = altFilterProp ?? 'TRACON'
  const callsignFilter: CallsignFilter = callsignFilterProp ?? 'ID'
  const rangeNmRef = useRef(rangeNm)
  useEffect(() => {
    rangeNmRef.current = rangeNm
  }, [rangeNm])
  const radarThemeRef = useRef(radarTheme)
  useEffect(() => {
    radarThemeRef.current = radarTheme
  }, [radarTheme])
  const altFilterRef = useRef(altFilter)
  useEffect(() => {
    altFilterRef.current = altFilter
  }, [altFilter])
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const aircraftLayerRef = useRef<CustomDataSource | null>(null)
  const trailsLayerRef = useRef<CustomDataSource | null>(null)
  const runwayLayerRef = useRef<CustomDataSource | null>(null)
  const airspaceLayerRef = useRef<CustomDataSource | null>(null)
  const overlayLayerRef = useRef<CustomDataSource | null>(null)
  const landmarksLayerRef = useRef<CustomDataSource | null>(null)
  const trailFixesRef = useRef<Map<string, TrailFix[]>>(new Map())
  const canvasCacheRef = useRef<Map<string, string>>(new Map())
  const statesByIcaoRef = useRef<Map<string, RichAircraftState>>(new Map())
  const visibleStatesListRef = useRef<RichAircraftState[]>([])
  const labelOffsetByIcaoRef = useRef<Map<string, Cartesian2>>(new Map())
  const enrichedByIcaoRef = useRef<Map<string, EnrichedAircraft>>(new Map())
  const selectedIcaoRef = useRef<string | null>(null)
  // Dead reckoning: where each target is currently displayed, extrapolated
  // from the aircraft fix timestamp so client polling never resets motion.
  const drPosByIcaoRef = useRef<Map<string, DrPosition>>(new Map())
  // Last effective ground state rendered per target (feed bit OR dead-reckoning
  // landing model). Lets the animator recolor on touchdown without waiting for
  // the next poll/filter toggle.
  const renderedGroundByIcaoRef = useRef<Map<string, boolean>>(new Map())
  const timesharePhaseRef = useRef<TimesharePhase>('main')
  // J-rings: icao24 -> radius NM (state so toggles re-run the render effect
  // and the detail card chip updates)
  const [jRings, setJRings] = useState<ReadonlyMap<string, number>>(new Map())
  // Current altimeter setting (hPa) for QNH-correcting ADS-B pressure altitude
  const qnhHpaRef = useRef<number | null>(null)
  useEffect(() => {
    qnhHpaRef.current = metarData?.altim ?? null
  }, [metarData])
  const airspaceLegend = useMemo(
    () => themedAirspaceLegend(radarTheme),
    [radarTheme],
  )
  const suaLegend = useMemo(() => {
    const suaPalette = getAirspacePalette(radarTheme).sua
    const typeByKey = {
      moa: 'MOA',
      restricted: 'RESTRICTED',
      warning: 'WARNING',
      alert: 'ALERT',
    } as const
    return SUA_LEGEND.map((item) => ({
      ...item,
      color: suaPalette[typeByKey[item.key]].color,
    }))
  }, [radarTheme])
  const suaVisibility = useMemo(
    () => ({
      moa: suaMoaVisible,
      restricted: suaRestrictedVisible,
      warning: suaWarningVisible,
      alert: suaAlertVisible,
    }),
    [suaMoaVisible, suaRestrictedVisible, suaWarningVisible, suaAlertVisible],
  )
  const anySuaVisible =
    suaMoaVisible || suaRestrictedVisible || suaWarningVisible || suaAlertVisible
  const [tfrAreas, setTfrAreas] = useState<TemporaryFlightRestriction[]>([])
  const tfrLegendItems = useMemo(() => {
    const colors = getAirspacePalette(radarTheme).tfr.colors
    const seen = new Set<string>()
    return tfrAreas.flatMap((area) => {
      const color = getTfrColor(area.type, colors)
      const label = tfrLegendLabel(area.type)
      const key = `${label}:${color}`
      if (seen.has(key)) return []
      seen.add(key)
      return [{ label, color }]
    })
  }, [radarTheme, tfrAreas])
  const visibleSuaLegend = useMemo(
    () =>
      suaLegend.filter((item) => suaVisibility[item.key as keyof typeof suaVisibility]),
    [suaLegend, suaVisibility],
  )
  const landmarkLegend = useMemo(
    () =>
      LANDMARK_LEGEND.map((item) => ({
        ...item,
        color: getLandmarkColor(radarTheme, item.category),
      })),
    [radarTheme],
  )
  const suaAreas = useMemo(
    () => getSuaNear(airport.lat, airport.lon, fetchRadiusForFilter(altFilter)),
    [airport.lat, airport.lon, altFilter],
  )
  const nearbyLandmarks = useMemo(
    () => getLandmarksNear(airport.lat, airport.lon, fetchRadiusForFilter(altFilter)),
    [airport.lat, airport.lon, altFilter],
  )
  useEffect(() => {
    if (!tfrVisible) return

    let cancelled = false
    const radiusNm = fetchRadiusForFilter(altFilter)
    const load = () => {
      getTfrNear(airport.lat, airport.lon, radiusNm)
        .then((areas) => {
          if (!cancelled) setTfrAreas(areas)
        })
        .catch(() => {
          if (!cancelled) setTfrAreas([])
        })
    }

    load()
    const interval = window.setInterval(load, 300_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [airport.lat, airport.lon, altFilter, tfrVisible])
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null)
  const onAircraftSelectRef = useRef(onAircraftSelect)
  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect
  }, [onAircraftSelect])
  const onEmergencyAircraftRef = useRef(onEmergencyAircraftChange)
  useEffect(() => {
    onEmergencyAircraftRef.current = onEmergencyAircraftChange
  }, [onEmergencyAircraftChange])
  const onResetViewRef = useRef(onResetView)
  useEffect(() => {
    onResetViewRef.current = onResetView
  }, [onResetView])
  const onFlyToRefRef = useRef(onFlyToRef)
  useEffect(() => {
    onFlyToRefRef.current = onFlyToRef
  }, [onFlyToRef])
  const [mapInitError, setMapInitError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null)
  const [isTilted, setIsTilted] = useState(true)
  const isTiltedRef = useRef(isTilted)
  useEffect(() => {
    isTiltedRef.current = isTilted
  }, [isTilted])
  const [camDebug, setCamDebug] = useState<{ lat: number; lon: number; altM: number; distNm: number } | null>(null)

  const bbox = useMemo(
    () => bboxAround(airport.lat, airport.lon, fetchRadiusForFilter(altFilter)),
    [airport.lat, airport.lon, altFilter],
  )

  // Stable runway list for the airport (geometry-aware ground inference in the
  // feed hook). Memoized so it doesn't retrigger the polling effect each render.
  const feedRunways = useMemo(
    () => allRunways[airport.icao] ?? [],
    [airport.icao],
  )

  const { states, feedError: error, feedConfigRequired } = useAircraftFeed({
    icao: airport.icao,
    lat: airport.lat,
    lon: airport.lon,
    elevationFt: airport.elevation_ft,
    bbox,
    runways: feedRunways,
    altFilter,
  })

  const enriched = useMemo(() => {
    if (states.length === 0) return []
    return enrichAircraftStates(
      states,
      allRunways[airport.icao] ?? [],
      airport.icao,
      airport.lat,
      airport.lon,
      airport.elevation_ft,
      metarData,
    )
  }, [states, airport.icao, airport.lat, airport.lon, airport.elevation_ft, metarData])

  const activeRwyKey = useMemo(() => {
    const eff = getEffectiveActiveRunwayEnds(
      airport.icao,
      allRunways[airport.icao] ?? [],
      metarData,
    )
    return `${eff.source}:${[...eff.ends].sort().join(',')}`
  }, [airport.icao, metarData])

  const liveSelectedIcao = useMemo(() => {
    if (!selectedIcao) return null
    return states.some((state) => state.icao24 === selectedIcao) ? selectedIcao : null
  }, [selectedIcao, states])

  const selectedAircraft = useMemo(() => {
    if (!liveSelectedIcao) return null
    const state = states.find((entry) => entry.icao24 === liveSelectedIcao)
    if (!state) return null
    const enrichedAc = enriched.find((entry) => entry.icao24 === liveSelectedIcao)
    return toSelectedAircraft(state, enrichedAc, airport)
  }, [liveSelectedIcao, states, enriched, airport])

  useEffect(() => {
    selectedIcaoRef.current = liveSelectedIcao
  }, [liveSelectedIcao])

  useEffect(() => {
    onAircraftSelectRef.current?.(selectedAircraft)
  }, [selectedAircraft])

  const reportedCount = useMemo(() => {
    const visibleStates = dedupeStatesByIcao(states)
      .filter((s) => isAircraftInsideViewport(s, viewportBounds))
    const airspaceCfg = getAirspace(airport.icao)
    const airportRunways = allRunways[airport.icao] ?? []
    const activeRunwayEnds = getEffectiveActiveRunwayEnds(
      airport.icao,
      airportRunways,
      metarData,
    ).ends
    if (altFilter === 'TWR') {
      return states.filter((s) => {
        if (!isAircraftInsideViewport(s, viewportBounds)) return false
        if (!matchesTrafficFilter(s, filter, altFilter, airportRunways, activeRunwayEnds)) return false
        if (!matchesCallsignFilter(s, callsignFilter)) return false
        if (!matchesTypeFilter(s, typeFilters)) return false
        if (!matchesAltFilter(s, airport.icao, altFilter, airport.elevation_ft, airport)) return false
        if (isVfrTarget(s, airport, airspaceCfg)) return false
        return true
      }).length
    }
    return visibleStates.filter((s) => {
      if (!matchesTrafficFilter(s, filter, altFilter, airportRunways, activeRunwayEnds)) return false
      if (!matchesCallsignFilter(s, callsignFilter)) return false
      if (!matchesTypeFilter(s, typeFilters)) return false
      if (!matchesAltFilter(s, airport.icao, altFilter, airport.elevation_ft, airport)) return false
      if (isVfrTarget(s, airport, airspaceCfg)) return false
      return true
    }).length
  }, [states, filter, altFilter, callsignFilter, typeFilters, airport, metarData, viewportBounds])

  useEffect(() => {
    onAircraftCountChange?.(reportedCount)
  }, [reportedCount, onAircraftCountChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container || viewerRef.current) return

    let cancelled = false
    let handle: ScopeViewerHandle | null = null
    let removePostRenderListener: (() => void) | undefined

    const registerViewerCallbacks = (activeViewer: Viewer) => {
      onResetViewRef.current?.(() => {
        const currentViewer = viewerRef.current
        if (!currentViewer) return
        const altitudeM = rangeNmToAltitudeM(rangeNmRef.current)
        const camAlt = altitudeM * 0.264
        const offsetDeg = (camAlt * 1.075) / 111320
        currentViewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(airport.lon, airport.lat - offsetDeg, camAlt),
          orientation: {
            heading: 0,
            pitch: CesiumMath.toRadians(-45),
            roll: 0,
          },
          duration: 0.8,
        })
        setIsTilted(true)
      })

      onFlyToRefRef.current?.((icao: string) => {
        const state = statesByIcaoRef.current.get(icao)
        if (!state) return
        activeViewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(state.lon, state.lat, 50000),
          duration: 1.5,
        })
      })
    }

    const publishViewportBounds = (activeViewer: Viewer) => {
      const nextBounds = readViewportBounds(activeViewer)
      setViewportBounds((prevBounds) =>
        viewportBoundsEqual(prevBounds, nextBounds) ? prevBounds : nextBounds,
      )
    }

    const mountViewer = () => {
      if (cancelled || viewerRef.current || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) {
        requestAnimationFrame(mountViewer)
        return
      }

      try {
        handle = createScopeViewer({
          container: containerRef.current,
          airport,
          radarTheme: radarThemeRef.current,
          initialRangeNm: rangeNmRef.current,
          onViewportChanged: publishViewportBounds,
          onContextLost: () => {
            setMapInitError('Radar display lost WebGL context. Reload the page to restore.')
          },
          onContextRestored: () => {
            setMapInitError(null)
          },
        })
      } catch (err) {
        console.error('[RadarMap] Cesium viewer init failed:', err)
        if (!cancelled) {
          setMapInitError('Unable to initialize radar display. Try reloading the page.')
        }
        return
      }

      const viewer = handle.viewer
      publishViewportBounds(viewer)
      aircraftLayerRef.current = handle.layers.aircraft
      trailsLayerRef.current = handle.layers.trails
      runwayLayerRef.current = handle.layers.runway
      airspaceLayerRef.current = handle.layers.airspace
      overlayLayerRef.current = handle.layers.overlay
      landmarksLayerRef.current = handle.layers.landmarks

      viewer.screenSpaceEventHandler.setInputAction(
        (click: ScreenSpaceEventHandler.PositionedEvent) => {
          const releaseCamera = () => {
            viewer.camera.lookAtTransform(Matrix4.IDENTITY)
          }

          // STARS ownership colors: the selected ("owned") datablock is white;
          // retint on selection changes since the render effect won't re-run
          const retintDatablock = (icao: string | null) => {
            if (!icao) return
            const st = statesByIcaoRef.current.get(icao)
            const ent = aircraftLayerRef.current?.entities.getById(icao)
            if (!st || !ent?.label) return
            const cfg = getAirspace(airport.icao)
            const currentTheme = radarThemeRef.current
            const base = cachedColor(
              themedAirspaceColor(
                airspaceColor(st, airport, cfg, cfg.artcc ? getArtcc(cfg.artcc) : undefined),
                currentTheme,
              ),
            )
            const color = emergencyAlertCode(st)
              ? cachedColor(EMERGENCY_CSS)
              : selectedIcaoRef.current === icao
                ? cachedColor(getRadarTheme(currentTheme).selectedTrackColor)
                : base
            ent.label.fillColor = new ConstantProperty(color)
          }

          const clearSelection = () => {
            const prev = selectedIcaoRef.current
            selectedIcaoRef.current = null
            setSelectedIcao(null)
            retintDatablock(prev)
            updateSelectionRing(overlayLayerRef.current, null)
            releaseCamera()
            viewer.scene.requestRender()
          }

          const applySelection = (entityId: string, state: RichAircraftState) => {
            releaseCamera()
            const prev = selectedIcaoRef.current
            selectedIcaoRef.current = entityId
            setSelectedIcao(entityId)
            retintDatablock(prev)
            retintDatablock(entityId)
            updateSelectionRing(
              overlayLayerRef.current,
              Cartesian3.fromDegrees(
                state.lon,
                state.lat,
                scopeHeightM(state.altitudeFt, airport.elevation_ft),
              ),
            )
            viewer.scene.requestRender()
          }

          // requestRenderMode leaves the pick buffer stale until a render completes
          viewer.scene.render(viewer.clock.currentTime)

          const camAltM = viewer.camera.positionCartographic.height
          const includeDatablockFallback = !(
            altFilterRef.current === 'CTR' &&
            rangeNmRef.current > CENTER_DECLUTTER_RANGE_NM
          )
          const visibleList = visibleStatesListRef.current
          const pickResult = findAircraftAtClick(
            viewer.scene,
            click.position,
            visibleList,
            camAltM,
            includeDatablockFallback,
            dedupeStatesByIcao([...statesByIcaoRef.current.values()]),
            airport.elevation_ft,
            labelOffsetByIcaoRef.current,
            drPosByIcaoRef.current,
          )
          if (pickResult.match) {
            applySelection(pickResult.match.icao24, pickResult.match)
            return
          }

          const picks = viewer.scene.drillPick(click.position, 10, 15, 15)
          const visibleStatesByIcao = new Map(
            visibleList.map((state) => [state.icao24, state]),
          )
          const closestAllowed =
            pickResult.closestPx > 0
              ? pickResult.closestPx + DRILLPICK_MAX_SLACK_PX
              : MAX_ICON_PICK_DISTANCE_PX - ICON_PICK_PRIORITY_BIAS_PX
          let bestDrillPick: {
            id: string
            state: RichAircraftState
            drillIconDist: number
          } | null = null
          for (const pick of picks) {
            if (!defined(pick) || !pick.id) continue
            const id = typeof pick.id === 'string' ? pick.id : pick.id.id
            if (typeof id !== 'string') continue
            const state = visibleStatesByIcao.get(id)
            if (!state) continue
            const drillIconDist = screenIconDistanceToAircraft(
              viewer.scene,
              click.position,
              state,
              airport.elevation_ft,
              drPosByIcaoRef.current,
            )
            if (drillIconDist == null || drillIconDist > closestAllowed) continue
            if (!bestDrillPick || drillIconDist < bestDrillPick.drillIconDist) {
              bestDrillPick = { id, state, drillIconDist }
            }
          }
          if (bestDrillPick) {
            applySelection(bestDrillPick.id, bestDrillPick.state)
            return
          }

          const hitNonAircraft = picks.some((pick) => {
            if (!defined(pick) || !pick.id) return false
            const id = typeof pick.id === 'string' ? pick.id : pick.id.id
            return typeof id === 'string' && isNonAircraftEntityId(id)
          })
          const outcome =
            (picks.length === 0 || !hitNonAircraft) &&
            pickResult.closestPx > CLEAR_SELECTION_MIN_PX
              ? 'clear'
              : 'miss'
          if (outcome === 'clear') {
            clearSelection()
          }
        },
        ScreenSpaceEventType.LEFT_CLICK,
      )

      viewerRef.current = viewer
      setMapInitError(null)
      setViewerReady(true)
      registerViewerCallbacks(viewer)

      if (import.meta.env.DEV) {
        let lastCamDebugAt = 0
        removePostRenderListener = viewer.scene.postRender.addEventListener(() => {
          const now = Date.now()
          if (now - lastCamDebugAt < 250) return
          lastCamDebugAt = now
          const pos = viewer.camera.positionCartographic
          const lat = CesiumMath.toDegrees(pos.latitude)
          const lon = CesiumMath.toDegrees(pos.longitude)
          const altM = pos.height
          const distNm = haversineNm(airport.lat, airport.lon, lat, lon)
          setCamDebug({ lat, lon, altM, distNm })
        })
      }

      viewer.scene.requestRender()
    }

    const scheduleMount = () => {
      if (isSafari()) {
        requestAnimationFrame(() => {
          if (!cancelled) requestAnimationFrame(mountViewer)
        })
      } else {
        requestAnimationFrame(mountViewer)
      }
    }

    scheduleMount()

    const trailFixes = trailFixesRef.current
    return () => {
      cancelled = true
      removePostRenderListener?.()
      handle?.dispose()
      handle = null
      viewerRef.current = null
      aircraftLayerRef.current = null
      trailsLayerRef.current = null
      runwayLayerRef.current = null
      airspaceLayerRef.current = null
      overlayLayerRef.current = null
      landmarksLayerRef.current = null
      trailFixes.clear()
      statesByIcaoRef.current.clear()
      setViewportBounds(null)
      setViewerReady(false)
    }
  }, [airport])

  useEffect(() => {
    if (!viewerReady) return
    const viewer = viewerRef.current
    if (!viewer) return
    applyRadarTheme(viewer, radarTheme)
    viewer.scene.requestRender()
  }, [radarTheme, viewerReady])

  useEffect(() => {
    recordTrailFixes(states, trailFixesRef.current, airport.elevation_ft)
  }, [states, airport.elevation_ft])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const altitudeM = rangeNmToAltitudeM(rangeNm)

    if (isTiltedRef.current) {
      viewer.camera.flyTo({
        destination: getTiltedCameraDestination(airport.lon, airport.lat, altitudeM),
        orientation: {
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: 0,
        },
        duration: 0.8,
      })
    } else {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(airport.lon, airport.lat, altitudeM),
        orientation: {
          heading: viewer.camera.heading,
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        },
        duration: 0.8,
      })
    }
    viewer.scene.requestRender()
  }, [rangeNm, airport.lon, airport.lat])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const altitudeM = rangeNmToAltitudeM(rangeNm)
    viewer.camera.flyTo({
      destination: getTiltedCameraDestination(airport.lon, airport.lat, altitudeM),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
      duration: 0.8,
    })
    viewer.scene.requestRender()
  }, [airport.icao, airport.lat, airport.lon, rangeNm])

  const handleTiltToggle = () => {
    const viewer = viewerRef.current
    if (!viewer) return
    const altitudeM = rangeNmToAltitudeM(rangeNm)
    const nextTilted = !isTilted
    setIsTilted(nextTilted)

    if (nextTilted) {
      viewer.camera.flyTo({
        destination: getTiltedCameraDestination(airport.lon, airport.lat, altitudeM),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
        duration: 0.8,
      })
    } else {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(airport.lon, airport.lat, altitudeM),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        },
        duration: 0.8,
      })
    }
    viewer.scene.requestRender()
  }

  useEffect(() => {
    if (!viewerReady) return
    const eff = getEffectiveActiveRunwayEnds(
      airport.icao,
      allRunways[airport.icao] ?? [],
      metarData,
    )
    renderRunways(runwayLayerRef.current, airport, eff.ends, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [airport, metarData, viewerReady, activeRwyKey, radarTheme])

  useEffect(() => {
    if (!viewerReady) return
    renderRangeRings(overlayLayerRef.current, airport, getRadarTheme(radarTheme).rangeRingColor)
    viewerRef.current?.scene.requestRender()
  }, [airport, radarTheme, viewerReady])

  useEffect(() => {
    if (!viewerReady) return
    const layer = landmarksLayerRef.current
    if (!layer) return

    if (!landmarksVisible) {
      const toRemove = layer.entities.values.filter(
        (e) => typeof e.id === 'string' && e.id.startsWith('landmark-'),
      )
      for (const e of toRemove) layer.entities.remove(e)
      viewerRef.current?.scene.requestRender()
      return
    }

    renderLandmarks(layer, nearbyLandmarks, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [viewerReady, landmarksVisible, nearbyLandmarks, radarTheme])

  useEffect(() => {
    if (!viewerReady) return
    renderTowerAirspace(airspaceLayerRef.current, airport, getAirspace(airport.icao), animationPreset, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [airport, animationPreset, viewerReady, radarTheme])

  useEffect(() => {
    if (!viewerReady) return
    if (altFilter === 'TWR') {
      const layer = airspaceLayerRef.current
      if (layer) {
        const toRemove = layer.entities.values.filter(
          (e) =>
            typeof e.id === 'string' &&
            (e.id.startsWith('class-b-') ||
              e.id.startsWith('class-c-') ||
              e.id.startsWith('tracon-')),
        )
        for (const e of toRemove) layer.entities.remove(e)
      }
      viewerRef.current?.scene.requestRender()
      return
    }
    renderClassBAirspace(airspaceLayerRef.current, airport, getAirspace(airport.icao), animationPreset, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [airport, altFilter, animationPreset, viewerReady, radarTheme])

  useEffect(() => {
    if (!viewerReady) return
    const layer = airspaceLayerRef.current
    if (!layer) return

    if (altFilter === 'TWR' || altFilter === 'TRACON') {
      const toRemove = layer.entities.values.filter(
        (e) => typeof e.id === 'string' && e.id.startsWith('artcc-'),
      )
      for (const e of toRemove) layer.entities.remove(e)
      viewerRef.current?.scene.requestRender()
      return
    }

    const artccId = getAirspace(airport.icao).artcc
    if (!artccId) return
    renderArtccAirspace(layer, getArtcc(artccId), artccId, animationPreset, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [airport.icao, altFilter, animationPreset, viewerReady, radarTheme])

  useEffect(() => {
    if (!viewerReady) return
    const layer = airspaceLayerRef.current
    if (!layer) return

    if (!airspaceVisible || !anySuaVisible) {
      const toRemove = layer.entities.values.filter(
        (e) => typeof e.id === 'string' && e.id.startsWith('sua-'),
      )
      for (const e of toRemove) layer.entities.remove(e)
      viewerRef.current?.scene.requestRender()
      return
    }

    renderSuaAirspace(layer, suaAreas, animationPreset, suaVisibility, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [
    airport.icao,
    altFilter,
    animationPreset,
    viewerReady,
    airspaceVisible,
    anySuaVisible,
    suaVisibility,
    suaAreas,
    radarTheme,
  ])

  useEffect(() => {
    if (!viewerReady) return
    const layer = airspaceLayerRef.current
    if (!layer) return

    if (!airspaceVisible || !tfrVisible || tfrAreas.length === 0) {
      const toRemove = layer.entities.values.filter(
        (e) => typeof e.id === 'string' && e.id.startsWith('tfr-'),
      )
      for (const e of toRemove) layer.entities.remove(e)
      viewerRef.current?.scene.requestRender()
      return
    }

    renderTfrAirspace(layer, tfrAreas, animationPreset, radarTheme)
    viewerRef.current?.scene.requestRender()
  }, [
    animationPreset,
    viewerReady,
    airspaceVisible,
    tfrVisible,
    tfrAreas,
    radarTheme,
  ])

  useEffect(() => {
    if (!viewerReady) return
    const layer = airspaceLayerRef.current
    if (!layer) return
    layer.show = airspaceVisible
    viewerRef.current?.scene.requestRender()
  }, [airspaceVisible, viewerReady])

  // Animated presets drive airspace outline colors through CallbackProperty,
  // which only re-evaluates when a frame renders — under requestRenderMode the
  // animation freezes unless frames keep getting requested (~15 fps here).
  useEffect(() => {
    if (!viewerReady || !airspaceVisible || animationPreset === 'static') return
    const id = window.setInterval(() => {
      viewerRef.current?.scene.requestRender()
    }, 66)
    return () => window.clearInterval(id)
  }, [viewerReady, airspaceVisible, animationPreset])

  useEffect(() => {
    const aircraftLayer = aircraftLayerRef.current
    const trailsLayer = trailsLayerRef.current
    if (!viewerReady || !aircraftLayer || !trailsLayer) return

    const nextStatesByIcao = new Map<string, RichAircraftState>()
    for (const s of states) {
      nextStatesByIcao.set(s.icao24, s)
    }
    statesByIcaoRef.current = nextStatesByIcao

    const nextEnrichedByIcao = new Map<string, EnrichedAircraft>()
    for (const ac of enriched) {
      nextEnrichedByIcao.set(ac.icao24, ac)
    }
    enrichedByIcaoRef.current = nextEnrichedByIcao

    const emergencyStates = Array.from(statesByIcaoRef.current.values())
      .filter((s) => {
        const sq = String(s.squawk ?? '')
        return sq === '7500' || sq === '7600' || sq === '7700'
      })
      .map((s) => toSelectedAircraft(s, nextEnrichedByIcao.get(s.icao24), airport))
    onEmergencyAircraftRef.current?.(emergencyStates)

    const visibleStates = dedupeStatesByIcao(states)
    const airspaceCfg = getAirspace(airport.icao)
    const airportRunways = allRunways[airport.icao] ?? []
    const activeRunwayEnds = getEffectiveActiveRunwayEnds(
      airport.icao,
      airportRunways,
      metarData,
    ).ends
    const artccStrata = airspaceCfg.artcc ? getArtcc(airspaceCfg.artcc) : undefined
    const nextVisibleStatesByIcao = new Map<string, RichAircraftState>()
    const camAltM = viewerRef.current?.camera.positionCartographic.height ?? 0
    const declutterWideCenter = altFilter === 'CTR' && rangeNm > CENTER_DECLUTTER_RANGE_NM
    const declutterTrackArtifacts =
      declutterWideCenter || (altFilter === 'TRACON' && rangeNm > TRACON_TRACK_DECLUTTER_RANGE_NM)
    const nearbyLabelSet = declutterWideCenter ? new Set<string>() : buildNearbyLabelSet(visibleStates)
    const renderedEntityIds = new Set<string>()
    const renderedTrailDotIds = new Set<string>()
    const renderedLeaderIds = new Set<string>()
    const renderedJRingIds = new Set<string>()
    const nextLabelOffsetsByIcao = new Map<string, Cartesian2>()
    const nowMs = Date.now()

    // Batch entity churn: every add/remove/modify otherwise fires a
    // collectionChanged event that the DataSourceDisplay processes
    // individually — with hundreds of targets (CTR/ALL) that serial event
    // storm is what freezes the frame. Suspend once, mutate everything,
    // resume to flush a single batched event.
    aircraftLayer.entities.suspendEvents()
    trailsLayer.entities.suspendEvents()

    for (const s of visibleStates) {
      const lat = s.lat
      const lon = s.lon
      if (!isAircraftInsideViewport(s, viewportBounds)) continue
      if (!matchesTrafficFilter(s, filter, altFilter, airportRunways, activeRunwayEnds)) continue
      if (!matchesCallsignFilter(s, callsignFilter)) continue
      if (!matchesTypeFilter(s, typeFilters)) continue
      if (!matchesAltFilter(s, airport.icao, altFilter, airport.elevation_ft, airport)) continue

      nextVisibleStatesByIcao.set(s.icao24, s)
      renderedEntityIds.add(s.icao24)

      // Display position is dead-reckoned forward from the reported fix so
      // re-renders (filter/range changes) never snap targets backwards
      const trailFixes = trailFixesRef.current.get(s.icao24)
      const leaderTrackDeg = getLeaderTrackDeg(s, camAltM, trailFixes)
      const dr = deadReckon(
        s,
        deadReckonBaseMs(s, nowMs),
        nowMs,
        leaderTrackDeg,
        deadReckonContext(
          s,
          enrichedByIcaoRef.current.get(s.icao24)?.phase,
          airport.elevation_ft,
          airportRunways,
          qnhHpaRef.current,
        ),
      )
      if (dr) {
        drPosByIcaoRef.current.set(s.icao24, dr)
      } else {
        drPosByIcaoRef.current.delete(s.icao24)
      }
      const dispLat = dr?.lat ?? lat
      const dispLon = dr?.lon ?? lon
      const dispAltM = scopeHeightM(dr?.altitudeFt ?? s.altitudeFt, airport.elevation_ft)
      const position = Cartesian3.fromDegrees(dispLon, dispLat, dispAltM)
      // Effective ground state: the feed's air/ground bit can lag a landing by
      // many seconds, so also treat a target the dead-reckoning model has put
      // on the runway as on-ground. Without this a just-landed target keeps its
      // tower/approach color until the feed catches up (or a filter toggle
      // forces a refetch).
      const onGroundEff = s.onGround || (dr?.onGround ?? false)
      renderedGroundByIcaoRef.current.set(s.icao24, onGroundEff)
      const alertCode = emergencyAlertCode(s)
      const aircraftColor = alertCode
        ? cachedColor(EMERGENCY_CSS)
        : cachedColor(
            themedAirspaceColor(
              airspaceColor(s, airport, airspaceCfg, artccStrata, onGroundEff),
              radarTheme,
            ),
          )

      const use3DModel = !onGroundEff && aircraftUses3DModel(s, camAltM)
      const modelDef = use3DModel ? resolveAircraftModel(s.aircraftType) : null
      const isSelected = selectedIcaoRef.current === s.icao24
      const showAircraftLabel = !declutterWideCenter || isSelected

      const labelText = buildDatablockText(s, timesharePhaseRef.current, onGroundEff)
      const themeLabel = getRadarTheme(radarTheme).label
      // Ownership colors: selected/owned track uses the theme's strongest contrast.
      const labelColor =
        !alertCode && isSelected
          ? cachedColor(getRadarTheme(radarTheme).selectedTrackColor)
          : aircraftColor
      const labelOutlineColor = cachedColor(themeLabel.outlineColor)
      const labelBackground = themedLabelBackground(radarTheme)
      const labelPadding = themedLabelPadding(radarTheme)
      const labelPixelOffset = showAircraftLabel
        ? computeLabelPixelOffset(
            s.icao24,
            nearbyLabelSet,
            Boolean(modelDef),
          )
        : new Cartesian2(0, 0)
      if (showAircraftLabel) {
        nextLabelOffsetsByIcao.set(s.icao24, labelPixelOffset)
      }

      let existing = aircraftLayer.entities.getById(s.icao24)
      if (existing) {
        const needsModel = Boolean(modelDef)
        const hasModel = Boolean(existing.model)
        if (needsModel !== hasModel) {
          aircraftLayer.entities.remove(existing)
          existing = undefined
        }
      }

      if (existing) {
        existing.position = new ConstantPositionProperty(position)

        if (modelDef) {
          existing.orientation = new ConstantProperty(
            Transforms.headingPitchRollQuaternion(
              position,
              new HeadingPitchRoll(
                aircraftModelHeadingFromTrack(
                  s.trackDeg,
                  leaderTrackDeg,
                  modelDef.headingOffsetDeg,
                ),
                0,
                0,
              ),
            ),
          )
          if (existing.model) {
            existing.model.silhouetteColor = new ConstantProperty(Color.WHITE)
          }
        } else if (existing.billboard) {
          existing.billboard.image = new ConstantProperty(
            getAircraftBillboardUri(
              aircraftColor.toCssColorString(),
              onGroundEff,
              getRadarTheme(radarTheme).aircraftSymbolHalo,
              canvasCacheRef.current,
            ),
          )
          existing.billboard.rotation = new ConstantProperty(
            onGroundEff ? 0 : CesiumMath.toRadians(-(leaderTrackDeg ?? 0)),
          )
          existing.billboard.scaleByDistance = new ConstantProperty(
            BILLBOARD_SCALE_BY_DISTANCE,
          )
        }

        if (existing.label) {
          existing.label.show = new ConstantProperty(showAircraftLabel)
          if (showAircraftLabel) {
            existing.label.text = new ConstantProperty(labelText)
            existing.label.font = new ConstantProperty(themeLabel.font)
            existing.label.scale = new ConstantProperty(themeLabel.scale)
            existing.label.fillColor = new ConstantProperty(labelColor)
            existing.label.outlineColor = new ConstantProperty(labelOutlineColor)
            existing.label.outlineWidth = new ConstantProperty(themeLabel.outlineWidth)
            existing.label.style = new ConstantProperty(LabelStyle.FILL_AND_OUTLINE)
            existing.label.pixelOffset = new ConstantProperty(labelPixelOffset)
            existing.label.showBackground = new ConstantProperty(true)
            existing.label.backgroundColor = new ConstantProperty(labelBackground)
            existing.label.backgroundPadding = new ConstantProperty(labelPadding)
          }
          existing.label.distanceDisplayCondition = new ConstantProperty(
            aircraftLabelDistanceDisplayCondition(onGroundEff, {
              altFilter,
              isSelected,
            }),
          )
        }
      } else {
        aircraftLayer.entities.add({
          id: s.icao24,
          position,
          ...(modelDef
            ? {
                orientation: Transforms.headingPitchRollQuaternion(
                  position,
                  new HeadingPitchRoll(
                    aircraftModelHeadingFromTrack(
                      s.trackDeg,
                      leaderTrackDeg,
                      modelDef.headingOffsetDeg,
                    ),
                    0,
                    0,
                  ),
                ),
                model: {
                  uri: modelDef.uri,
                  minimumPixelSize: modelDef.minimumPixelSize,
                  scale: modelDef.scale,
                  heightReference: HeightReference.NONE,
                  scaleByDistance: new NearFarScalar(5_000, 1.0, MODEL_LOD_CUTOFF_M, 0.2),
                  distanceDisplayCondition: new DistanceDisplayCondition(0, 10000000),
                  silhouetteColor: Color.WHITE,
                  silhouetteSize: 1.0,
                },
              }
            : {
                billboard: buildAircraftBillboard(
                  aircraftColor,
                  onGroundEff,
                  s.trackDeg,
                  getRadarTheme(radarTheme).aircraftSymbolHalo,
                  canvasCacheRef.current,
                ),
              }),
          label: {
            text: labelText,
            show: showAircraftLabel,
            font: themeLabel.font,
            scale: themeLabel.scale,
            fillColor: labelColor,
            outlineColor: labelOutlineColor,
            outlineWidth: themeLabel.outlineWidth,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.LEFT,
            pixelOffset: labelPixelOffset,
            showBackground: showAircraftLabel,
            backgroundColor: labelBackground,
            backgroundPadding: labelPadding,
            scaleByDistance: new NearFarScalar(1000, 1.0, 2000000, 0.6),
            distanceDisplayCondition: aircraftLabelDistanceDisplayCondition(
              onGroundEff,
              { altFilter, isSelected },
            ),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      }

      const fixes = trailFixes
      const tCfg = getTrailBandConfig(s, airport, trailConfig, airport.elevation_ft)

      // Max dots = tCfg.length real fixes × (interp + 1)
      const maxDots = tCfg.length * (TRAIL_INTERP_COUNT + 1)
      const visibleFixes = fixes
        ? fixes.slice(Math.max(0, fixes.length - maxDots - 1, 0), fixes.length - 1)
        : []

      if (!declutterTrackArtifacts && visibleFixes.length > 0) {
        const total = visibleFixes.length
        for (let i = 0; i < total; i++) {
          const fix = visibleFixes[i]
          // t = 0 is oldest, 1 is newest
          const t = (i + 1) / total
          const alpha = 0.05 + t * tCfg.fade
          // Interpolated dots are slightly smaller than real fix dots
          const pixelSize = fix.interpolated ? 2 : 3
          const trailDotId = `trail-dot-${s.icao24}-${i}`
          renderedTrailDotIds.add(trailDotId)
          upsertTrailDot(
            trailsLayer,
            trailDotId,
            fix.position,
            pixelSize,
            cachedAlphaColor(aircraftColor, alpha),
          )
        }
      }

      // Leader line — fixed screen-size tick so all targets read consistently
      if (
        !declutterTrackArtifacts &&
        !onGroundEff &&
        camAltM < LEADER_LOD_CUTOFF_M &&
        s.speedKts != null &&
        s.speedKts >= LEADER_MIN_SPEED_KTS &&
        leaderTrackDeg != null
      ) {
        const leaderId = `leader-${s.icao24}`
        renderedLeaderIds.add(leaderId)
        const leaderLengthNm = rangeNm * LEADER_LENGTH_RANGE_RATIO
        const endPoint = destinationPoint(dispLat, dispLon, leaderTrackDeg, leaderLengthNm)
        const endPosition = Cartesian3.fromDegrees(endPoint.lon, endPoint.lat, dispAltM)
        upsertLeaderLine(
          trailsLayer,
          leaderId,
          position,
          endPosition,
          cachedAlphaColor(aircraftColor, isSelected ? 0.9 : 0.4),
          isSelected ? 1.5 : 1,
        )
      }

      // J-ring — separation halo toggled per target (detail card or "J" key)
      const jRingNm = jRings.get(s.icao24)
      if (jRingNm != null) {
        const jRingId = `jring-${s.icao24}`
        renderedJRingIds.add(jRingId)
        upsertJRing(
          trailsLayer,
          jRingId,
          dispLon,
          dispLat,
          dispAltM,
          jRingNm,
          cachedAlphaColor(aircraftColor, 0.8),
        )
      }
    }

    for (const entity of [...aircraftLayer.entities.values]) {
      if (typeof entity.id === 'string' && !renderedEntityIds.has(entity.id)) {
        aircraftLayer.entities.remove(entity)
      }
    }

    for (const entity of [...trailsLayer.entities.values]) {
      const entityId = entity.id
      if (typeof entityId !== 'string') continue
      if (
        (entityId.startsWith('trail-dot-') && !renderedTrailDotIds.has(entityId)) ||
        (entityId.startsWith('leader-') && !renderedLeaderIds.has(entityId)) ||
        (entityId.startsWith('jring-') && !renderedJRingIds.has(entityId))
      ) {
        trailsLayer.entities.remove(entity)
      }
    }

    aircraftLayer.entities.resumeEvents()
    trailsLayer.entities.resumeEvents()

    // Prune dead-reckoning entries for vanished targets. J-ring toggles are
    // kept (rings re-attach if the track reappears) and reset per airport.
    for (const icao of drPosByIcaoRef.current.keys()) {
      if (!renderedEntityIds.has(icao)) drPosByIcaoRef.current.delete(icao)
    }
    for (const icao of renderedGroundByIcaoRef.current.keys()) {
      if (!renderedEntityIds.has(icao)) renderedGroundByIcaoRef.current.delete(icao)
    }

    visibleStatesListRef.current = [...nextVisibleStatesByIcao.values()]
    labelOffsetByIcaoRef.current = nextLabelOffsetsByIcao

    // Keep the selection brackets pinned to the selected target; hide them
    // while the target is filtered out or dropped from the feed
    const selectedVisibleState = selectedIcaoRef.current
      ? nextVisibleStatesByIcao.get(selectedIcaoRef.current)
      : undefined
    updateSelectionRing(
      overlayLayerRef.current,
      selectedVisibleState
        ? displayWorldPos(selectedVisibleState, airport.elevation_ft, drPosByIcaoRef.current)
        : null,
    )

    viewerRef.current?.scene.requestRender()
  }, [states, enriched, filter, altFilter, callsignFilter, typeFilters, airport, metarData, activeRwyKey, rangeNm, trailConfig, viewerReady, jRings, radarTheme, viewportBounds])

  // Dead-reckoning animator: between feed updates, advance each target along
  // its track at its last groundspeed so motion is continuous instead of stepped.
  // Also drives STARS datablock timesharing (field flips every few seconds).
  useEffect(() => {
    if (!viewerReady) return
    const id = window.setInterval(() => {
      const viewer = viewerRef.current
      const aircraftLayer = aircraftLayerRef.current
      const trailsLayer = trailsLayerRef.current
      if (!viewer || !aircraftLayer || !trailsLayer) return

      const now = Date.now()
      let dirty = false

      const phase = timesharePhase(now)
      const phaseFlipped = phase !== timesharePhaseRef.current
      if (phaseFlipped) timesharePhaseRef.current = phase

      const camAltM = viewer.camera.positionCartographic.height
      const airportRunways = allRunways[airport.icao] ?? []
      const airspaceCfgAnim = getAirspace(airport.icao)
      const artccStrataAnim = airspaceCfgAnim.artcc
        ? getArtcc(airspaceCfgAnim.artcc)
        : undefined
      const themeAnim = radarThemeRef.current

      // Batch per-tick property churn into one collectionChanged flush
      aircraftLayer.entities.suspendEvents()
      trailsLayer.entities.suspendEvents()

      for (const s of visibleStatesListRef.current) {
        const entity = aircraftLayer.entities.getById(s.icao24)
        if (!entity) continue

        const leaderTrackDeg = getLeaderTrackDeg(
          s,
          camAltM,
          trailFixesRef.current.get(s.icao24),
        )
        const dr = deadReckon(
          s,
          deadReckonBaseMs(s, now),
          now,
          leaderTrackDeg,
          deadReckonContext(
            s,
            enrichedByIcaoRef.current.get(s.icao24)?.phase,
            airport.elevation_ft,
            airportRunways,
            qnhHpaRef.current,
          ),
        )
        // Effective ground state: feed bit OR the dead-reckoning landing model.
        const onGroundEff = s.onGround || (dr?.onGround ?? false)

        if (phaseFlipped && entity.label) {
          entity.label.text = new ConstantProperty(
            buildDatablockText(s, phase, onGroundEff),
          )
          dirty = true
        }

        // Recolor on touchdown: the moment the landing model puts the target on
        // the runway, switch it to the GND color/symbol instead of waiting for
        // the feed's air/ground bit (or a filter toggle) to catch up. Also drop
        // the predicted-track leader so it doesn't dangle off the now-grounded
        // target until the next poll prunes it.
        if (
          renderedGroundByIcaoRef.current.get(s.icao24) !== onGroundEff &&
          !emergencyAlertCode(s)
        ) {
          renderedGroundByIcaoRef.current.set(s.icao24, onGroundEff)
          const color = cachedColor(
            themedAirspaceColor(
              airspaceColor(s, airport, airspaceCfgAnim, artccStrataAnim, onGroundEff),
              themeAnim,
            ),
          )
          if (entity.billboard) {
            entity.billboard.image = new ConstantProperty(
              getAircraftBillboardUri(
                color.toCssColorString(),
                onGroundEff,
                getRadarTheme(themeAnim).aircraftSymbolHalo,
                canvasCacheRef.current,
              ),
            )
            entity.billboard.rotation = new ConstantProperty(
              onGroundEff ? 0 : CesiumMath.toRadians(-(leaderTrackDeg ?? 0)),
            )
          }
          if (entity.label) {
            entity.label.fillColor = new ConstantProperty(
              selectedIcaoRef.current === s.icao24
                ? cachedColor(getRadarTheme(themeAnim).selectedTrackColor)
                : color,
            )
            entity.label.distanceDisplayCondition = new ConstantProperty(
              aircraftLabelDistanceDisplayCondition(onGroundEff, {
                altFilter: altFilterRef.current,
                isSelected: selectedIcaoRef.current === s.icao24,
              }),
            )
          }
          if (onGroundEff) {
            const leaderEntity = trailsLayer.entities.getById(`leader-${s.icao24}`)
            if (leaderEntity) trailsLayer.entities.remove(leaderEntity)
          }
          dirty = true
        }

        if (!dr) {
          drPosByIcaoRef.current.delete(s.icao24)
          continue
        }
        drPosByIcaoRef.current.set(s.icao24, dr)
        const altM = scopeHeightM(dr.altitudeFt, airport.elevation_ft)
        const pos = Cartesian3.fromDegrees(dr.lon, dr.lat, altM)
        // Assign a fresh position property (rather than mutating via setValue)
        // so the datablock label repositions in lockstep with the symbol on
        // every tick — mirrors the per-poll render path. Mutating in place left
        // the label trailing behind the moving target between polls.
        entity.position = new ConstantPositionProperty(pos)
        dirty = true

        // Keep target-anchored geometry attached as the target moves
        const leader = trailsLayer.entities.getById(`leader-${s.icao24}`)
        if (!onGroundEff && leaderTrackDeg != null && s.speedKts != null) {
          if (leader?.polyline) {
            const endPt = destinationPoint(
              dr.lat,
              dr.lon,
              leaderTrackDeg,
              rangeNmRef.current * LEADER_LENGTH_RANGE_RATIO,
            )
            updateLeaderLinePositions(
              trailsLayer,
              `leader-${s.icao24}`,
              pos,
              Cartesian3.fromDegrees(endPt.lon, endPt.lat, altM),
            )
          }
        }

        const jRing = trailsLayer.entities.getById(`jring-${s.icao24}`)
        if (jRing) {
          if (jRing.position instanceof ConstantPositionProperty) {
            jRing.position.setValue(pos)
          } else {
            jRing.position = new ConstantPositionProperty(pos)
          }
          if (jRing.ellipse) jRing.ellipse.height = new ConstantProperty(altM)
        }

        if (selectedIcaoRef.current === s.icao24) {
          updateSelectionRing(overlayLayerRef.current, pos)
        }
      }

      aircraftLayer.entities.resumeEvents()
      trailsLayer.entities.resumeEvents()

      if (dirty) viewer.scene.requestRender()
    }, DR_TICK_MS)
    return () => window.clearInterval(id)
  }, [viewerReady, airport])

  // J-ring cycle: off -> 3 NM -> 5 NM -> off
  const cycleJRing = useCallback((icao: string) => {
    setJRings((prev) => {
      const next = new Map(prev)
      const current = next.get(icao)
      if (current == null) next.set(icao, 3)
      else if (current === 3) next.set(icao, 5)
      else next.delete(icao)
      return next
    })
  }, [])

  // Controller keyboard shortcut: J = J-ring on selected target
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'j' || e.key === 'J') {
        const icao = selectedIcaoRef.current
        if (icao) cycleJRing(icao)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleJRing])

  return (
    <div className="relative h-full w-full bg-radar">
      <div ref={containerRef} className="h-full w-full" />
      {selectedAircraft && (
        <AircraftDetailCard
          key={`${selectedAircraft.icao24}:${selectedAircraft.registration ?? ''}`}
          aircraft={selectedAircraft}
          jRingNm={jRings.get(selectedAircraft.icao24) ?? null}
          onToggleJRing={() => cycleJRing(selectedAircraft.icao24)}
          onClose={() => {
            selectedIcaoRef.current = null
            setSelectedIcao(null)
            updateSelectionRing(overlayLayerRef.current, null)
            const viewer = viewerRef.current
            if (viewer) {
              viewer.camera.lookAtTransform(Matrix4.IDENTITY)
              viewer.scene.requestRender()
            }
          }}
        />
      )}
      {import.meta.env.DEV && camDebug && (
        <div className="absolute top-3 right-3 z-[1000] font-mono text-[9px] text-white/40 text-right leading-relaxed">
          <div>LAT {camDebug.lat.toFixed(5)}</div>
          <div>LON {camDebug.lon.toFixed(5)}</div>
          <div>ALT {Math.round(camDebug.altM).toLocaleString()} m</div>
          <div>DST {camDebug.distNm.toFixed(1)} nm</div>
        </div>
      )}
      {(states.length > 0 ||
        (airspaceVisible && tfrVisible && tfrAreas.length > 0) ||
        (landmarksVisible && nearbyLandmarks.length > 0)) && (
        <div
          className="absolute bottom-3 left-3 z-[999] flex flex-wrap items-center gap-x-3 gap-y-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.04em]"
        >
          {states.length > 0 && airspaceLegend.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1">
              <TargetLegendDot color={color} />
              <span style={{ color: 'var(--green)', opacity: 0.85 }}>{label}</span>
            </span>
          ))}
          {states.length > 0 && airspaceVisible && anySuaVisible &&
            visibleSuaLegend.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1">
                <PolygonLegendSwatch color={color} />
                <span style={{ color: 'var(--green)', opacity: 0.85 }}>{label}</span>
              </span>
            ))}
          {airspaceVisible && tfrVisible && tfrLegendItems.map(({ label, color }) => (
            <span key={`${label}-${color}`} className="flex items-center gap-1">
              <TfrLegendSwatch color={color} />
              <span style={{ color: 'var(--green)', opacity: 0.85 }}>{label}</span>
            </span>
          ))}
          {landmarksVisible && nearbyLandmarks.length > 0 &&
            landmarkLegend.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1">
                <LandmarkLegendSwatch color={color} />
                <span style={{ color, opacity: 0.85 }}>{label}</span>
              </span>
            ))}
        </div>
      )}
      <CameraControls viewerRef={viewerRef} isTilted={isTilted} onTiltToggle={handleTiltToggle} />
      {mapInitError && (
        <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 w-[480px] rounded border border-red-500/60 bg-[#0a0a0f]/95 p-4 font-mono text-xs shadow-xl">
          <div className="mb-2 text-red-400 text-sm font-bold tracking-widest">
            RADAR DISPLAY UNAVAILABLE
          </div>
          <p className="text-red-300 leading-relaxed">{mapInitError}</p>
        </div>
      )}
      {error && (
        <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 w-[480px] rounded border border-amber-500/60 bg-[#0a0a0f]/95 p-4 font-mono text-xs shadow-xl">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-amber-400 text-sm font-bold tracking-widest">
              {feedConfigRequired ? '⚠ FEED IDENTITY REQUIRED' : '⚠ RADAR FEED INTERRUPTED'}
            </span>
          </div>

          {feedConfigRequired ? (
            <>
              <p className="mb-3 text-amber-300 leading-relaxed">
                Live aircraft data needs your name and email before upstream ADS-B
                providers will respond.
              </p>
              <p className="mb-3 text-white/60 leading-relaxed text-[10px]">
                {error}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="feed-setup-inline-btn"
                  onClick={openSetup}
                >
                  Open setup
                </button>
              </div>
            </>
          ) : error.includes('429') || error.includes('rate') || error.includes('unavailable') ? (
            <>
              <p className="mb-2 text-amber-300 leading-relaxed">
                Primary feed (airplanes.live) and fallback (adsb.lol) are both unavailable.
                Radar will auto-retry shortly.
              </p>
              <div className="mb-3 border border-white/10 rounded p-2 bg-white/5 text-white/70 leading-relaxed space-y-1">
                <p>
                  <span className="text-white/40">PRIMARY FEED</span>
                  <span className="ml-2 text-white/80">airplanes.live</span>
                </p>
                <p>
                  <span className="text-white/40">FALLBACK FEED</span>
                  <span className="ml-2 text-white/80">adsb.lol (max 1 req/sec)</span>
                </p>
                <p>
                  <span className="text-white/40">POLL INTERVAL</span>
                  <span className="ml-2 text-white/80">{AIRCRAFT_POLL_INTERVAL_MS / 1000}s</span>
                </p>
              </div>
              <p className="mb-3 text-white/50 leading-relaxed text-[10px]">
                Under normal operation FreqScope uses airplanes.live and falls back to adsb.lol
                when the primary feed fails.
              </p>
            </>
          ) : (
            <p className="mb-3 text-red-300 leading-relaxed">
              {error}
            </p>
          )}

          {!feedConfigRequired && (
            <>
          <div className="mb-3 border border-green-500/20 rounded p-2 bg-green-500/5">
            <p className="text-green-400 text-[10px] leading-relaxed tracking-wide">
              💡 <span className="text-green-300 font-bold">TIP:</span> The radar will auto-retry in ~60 seconds. If it persists, airplanes.live or adsb.lol may be experiencing an outage.
            </p>
          </div>

          <div className="flex items-center justify-end">
            <span className="text-white/30 text-[10px]">Auto-retry in ~60s</span>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
