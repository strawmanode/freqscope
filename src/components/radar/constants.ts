import { NearFarScalar } from 'cesium'
import { AIRCRAFT_MIN_FETCH_GAP_MS } from '../../../shared/aircraftFeedConfig'

export const MIN_FETCH_GAP_MS = AIRCRAFT_MIN_FETCH_GAP_MS
export const RATE_LIMIT_BACKOFF_MS = 60_000
export const NM_TO_METERS = 1852

// Beyond this camera altitude, 3D models switch back to billboard triangles.
// Keep models for terminal-area ranges; at center ranges the 48px sprites
// dominate the scope and bury the data blocks.
export const MODEL_LOD_CUTOFF_M = 90_000
export const LABEL_DISPLAY_MAX_M = 500_000
export const GROUND_LABEL_DISPLAY_MAX_M = 150_000
export const CENTER_DECLUTTER_RANGE_NM = 80
export const TRACON_TRACK_DECLUTTER_RANGE_NM = 80
export const BILLBOARD_SCALE_NEAR_M = 200_000
export const BILLBOARD_SCALE_FAR_M = 1_500_000
export const BILLBOARD_SCALE_BY_DISTANCE = new NearFarScalar(
  BILLBOARD_SCALE_NEAR_M,
  1.0,
  BILLBOARD_SCALE_FAR_M,
  0.4,
)

export const TRAIL_INTERP_COUNT = 3
export const MIN_TRAIL_MOVE_METERS = 75
export const LEADER_LENGTH_RANGE_RATIO = 0.025
export const LEADER_MIN_SPEED_KTS = 40
export const LEADER_LOD_CUTOFF_M = 250_000

export const EMERGENCY_CSS = '#ff3b30'
export const TIMESHARE_SLOT_MS = 2667

export const ICON_RADIUS_PX = 12
export const MODEL_ICON_RADIUS_PX = 32
export const MODEL_LABEL_OFFSET_X = 28
export const MODEL_LABEL_OFFSET_Y = -6

export const LANDING_PROFILE_MAX_AGL_FT = 1500
export const STANDARD_QNH_HPA = 1013.25
export const FT_PER_HPA = 27.3

export const BILLBOARD_PICK_HIT_PAD_PX = 158
export const MODEL_ICON_HIT_PAD_PX = 140
export const DRILLPICK_MAX_SLACK_PX = 20
export const LABEL_CHAR_WIDTH_PX = 8
export const LABEL_LINE_HEIGHT_PX = 14
export const LABEL_PADDING_PX = 6
export const LABEL_HIT_PAD_PX = 6
export const MAX_LABEL_PICK_DISTANCE_PX = 96
export const ICON_PICK_PRIORITY_BIAS_PX = 1000
export const MAX_ICON_PICK_DISTANCE_PX = Math.max(
  ICON_PICK_PRIORITY_BIAS_PX + MODEL_ICON_RADIUS_PX + MODEL_ICON_HIT_PAD_PX,
  ICON_PICK_PRIORITY_BIAS_PX + ICON_RADIUS_PX + BILLBOARD_PICK_HIT_PAD_PX,
)
export const CLEAR_SELECTION_MIN_PX = 130
export const ICON_CLUSTER_TIE_PX = 15
export const DIRECT_ICON_CLICK_PX = 25
export const LABEL_ICON_PROXIMITY_BIAS_PX = 20
export const LABEL_HIT_LEFT_PAD_PX = 48
