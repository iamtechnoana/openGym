/* Which exercises the camera rep counter offers itself for (spec §1): two-legged squats seen
 * from the side, starting and finishing standing. Catalogue ids are listed one by one — the names
 * alone would let in split, jump, single-leg and "squat row" variants. Custom exercises (ids start
 * with "c") qualify by name, with the same kinds of variants kept out.
 *
 * Catalogue ids never change (catalogue/README.md), so this list survives catalogue updates; new
 * squats need adding by hand. Left out of the v1.4 catalogue on purpose: quarter squats (shallow by
 * design), pin and Anderson squats (start at the bottom), machine squats (lever, pendulum, hack,
 * belt: the machine hides the body), and form-check, mobility, plyometric or combined movements. */
import { modeOf, isPerSide } from '../history.js'

export const CAMERA_SQUAT_IDS = new Set([
  // barbell
  '0029', '0039', '0042', '0043', '0063', '0124', '0127', '0878', '1435', '1436', '1461', '1462',
  '1527', '1545', '1868', '3309', '3530', '3593', '3871', '4064', '4178', '4218', '4219', '5017',
  // dumbbell, kettlebell
  '0413', '0533', '0534', '1555', '1760', '2753', '2966', '5301', '9690', '10673', '10674',
  // smith, cable, landmine, trap bar
  '0770', '1433', '1434', '1595', '1598', '3281', '3349', '3354', '3856', '3857', '4179', '4246',
  '5304', '6544', '7578', '7626', '9878',
  // band, weighted, other loads
  '0784', '0852', '1004', '2153', '4128', '4398', '4683', '6044', '7411', '10384', '10410',
  // body weight
  '1197', '1580', '3948', '4561', '4714', '4805', '7577', '9691',
])
const SQUAT = /\bsquats?\b/i
const NOT_TWO_LEGGED = /split|single|one[- ]leg|pistol|jump|plyo|sissy|cossack|curtsey|row|curl|calf|jerk|reach|hack|overhead|bench|lying|kneel|on knees|bosu|potty|sumo|chair|supported|frankenstein/i

export function isCameraSquat(id, name = '') {
  const key = String(id ?? '')
  if (CAMERA_SQUAT_IDS.has(key)) return true
  if (/^\d+$/.test(key)) return false   // a catalogue exercise not on the list
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
