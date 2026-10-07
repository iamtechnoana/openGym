/* Which exercises the camera rep counter offers itself for (spec §1): two-legged squats seen
 * from the side. Catalogue ids are listed one by one — the names alone would let in split, jump,
 * single-leg and "squat row" variants. Custom exercises qualify by name, with the same kinds of
 * variants kept out. The catalogue changes in v1.4.0: re-check this list then. */
import { modeOf, isPerSide } from '../history.js'

export const CAMERA_SQUAT_IDS = new Set([
  '1004', // band squat
  '0029', '0039', '0042', // barbell front squats
  '0043', '1461', '1462', // barbell full squat
  '1436', '1435', '0063', '0124', // high bar, low bar, narrow, wide
  '0127', '1545', // zercher
  '1760', '0413', // dumbbell goblet, dumbbell squat
  '0533', '0534', // kettlebell front, goblet
  '3281', '0770', '1433', '1434', // smith
  '0852', // weighted squat
])
const SQUAT = /\bsquats?\b/i
const NOT_TWO_LEGGED = /split|single|one[- ]leg|pistol|jump|plyo|sissy|cossack|curtsey|row|curl|calf|jerk|reach|hack|overhead|bench|lying|kneel|on knees|bosu|potty|sumo|chair|supported|frankenstein/i

export function isCameraSquat(id, name = '') {
  const key = String(id ?? '')
  if (CAMERA_SQUAT_IDS.has(key)) return true
  if (/^\d{4}$/.test(key)) return false
  return SQUAT.test(name) && !NOT_TWO_LEGGED.test(name)
}

/** The menu's test for one workout entry: a camera squat that is also set up for plain reps. A
 *  per-side row keeps its reps in sides.L/R and a timed row has none, so the count could not be
 *  written there the way logCameraReps writes it. */
export function canCountWithCamera(entry, name = '') {
  if (!entry) return false
  const cfg = { ...(entry.target || {}), id: entry.id }
  return isCameraSquat(entry.id, name) && modeOf(cfg) === 'reps' && !isPerSide(cfg)
}
