/* Squat geometry from MediaPipe's 33 pose landmarks (spec §4–5), side view. x and y arrive
 * normalised to the picture's width and height, so x is stretched by the aspect ratio before any
 * angle is measured. The side whose hip, knee and ankle the camera sees best is the one read. */
export const LM = Object.freeze({
  left: Object.freeze({ shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 }),
  right: Object.freeze({ shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 }),
})
export const MIN_VIS = 0.6

const vis = p => (p && typeof p.visibility === 'number' ? p.visibility : 0)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** Angle ABC at B, in degrees 0..180; null for a missing or coincident point. */
export function angleAt(a, b, c) {
  if (!a || !b || !c) return null
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y
  const nu = Math.hypot(ux, uy), nv = Math.hypot(vx, vy)
  if (nu === 0 || nv === 0) return null
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)))
  return Math.acos(cos) * 180 / Math.PI
}

/** How far the segment bottom→top leans from straight up, in degrees (image y grows downward). */
export function leanFromVertical(top, bottom) {
  return Math.atan2(Math.abs(top.x - bottom.x), bottom.y - top.y) * 180 / Math.PI
}

export function pickSide(lm) {
  const score = side => ['hip', 'knee', 'ankle'].reduce((s, k) => s + vis(lm[LM[side][k]]), 0)
  return score('right') > score('left') ? 'right' : 'left'
}

export function frameMetrics(lm, aspect = 1) {
  if (!Array.isArray(lm) || lm.length < 33) return null
  const side = pickSide(lm)
  const ix = LM[side]
  const at = k => {
    const p = lm[ix[k]]
    return p ? { x: p.x * aspect, y: p.y, v: vis(p) } : null
  }
  const hip = at('hip'), knee = at('knee'), ankle = at('ankle'), shoulder = at('shoulder'), heel = at('heel')
  if (!hip || !knee || !ankle || hip.v < MIN_VIS || knee.v < MIN_VIS || ankle.v < MIN_VIS) return null
  const kneeAngle = angleAt(hip, knee, ankle)
  if (kneeAngle == null) return null
  return {
    side,
    knee: kneeAngle,
    torsoLean: shoulder && shoulder.v >= MIN_VIS ? leanFromVertical(shoulder, hip) : null,
    hipY: hip.y,
    kneeY: knee.y,
    heelY: heel && heel.v >= MIN_VIS ? heel.y : null,
    legLen: dist(hip, knee) + dist(knee, ankle),
  }
}
