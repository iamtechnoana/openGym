/* Builders for the squat tests: whole landmark arrays (angles), metrics frames (counter, session)
 * and knee-angle ramps at a camera's frame rate. */
import { LM } from './angles.js'

export function poseFrom({ side = 'left', hip, knee, ankle, shoulder, heel, vis = 0.95 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  const ix = LM[side]
  const put = (k, p) => { if (p) lm[ix[k]] = { x: p[0], y: p[1], z: 0, visibility: p[2] ?? vis } }
  put('hip', hip); put('knee', knee); put('ankle', ankle); put('shoulder', shoulder); put('heel', heel)
  return lm
}

// A metrics frame as frameMetrics() returns it; standing defaults, override what the test is about.
export const frame = (knee, over = {}) => ({
  side: 'left', knee, torsoLean: 20, hipY: 0.5, kneeY: 0.7, heelY: 0.9, legLen: 0.4, ...over,
})

export function ramp(from, to, ms, dt = 33) {
  const n = Math.max(1, Math.round(ms / dt))
  return Array.from({ length: n }, (_, i) => from + (to - from) * (i + 1) / n)
}

/** Feeds knee angles (or full frames) into push(frame, t) at dt ms; returns every event emitted. */
export function feed(target, values, { dt = 33, t0 = 0, over = {} } = {}) {
  const events = []
  let t = t0
  for (const v of values) {
    const f = v === null ? null : typeof v === 'number' ? frame(v, over) : v
    events.push(...target.push(f, t))
    t += dt
  }
  return { events, t }
}
