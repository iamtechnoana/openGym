/* Form checks on one squat rep (spec §5). Image y grows downward, so the hip is above the knee
 * while hipY < kneeY; distances are measured against the leg's length so they hold at any camera
 * distance. Thresholds are starting points, tuned later against real videos.
 * Note: the spec's knee-angle fallback for an unseen hip never applies — frameMetrics needs the
 * hip to measure the knee at all, so a frame without it never reaches these checks. */
export const FORM_DEFAULTS = Object.freeze({ depthTol: 0.03, maxLean: 55, maxHeelRise: 0.04, lockoutAt: 165 })
export const FAULT_ORDER = Object.freeze(['shallow', 'lean', 'heel', 'lockout'])

export function bottomFaults(rep, options = {}) {
  const o = { ...FORM_DEFAULTS, ...options }
  const b = rep?.bottom
  if (!b) return []
  const out = []
  if (b.legLen > 0 && (b.kneeY - b.hipY) / b.legLen > o.depthTol) out.push('shallow')
  if (b.torsoLean != null && b.torsoLean > o.maxLean) out.push('lean')
  if ((rep.heelRise || 0) > o.maxHeelRise) out.push('heel')
  return out
}

export function lockoutFault(top, options = {}) {
  const o = { ...FORM_DEFAULTS, ...options }
  return top && top.topKnee < o.lockoutAt ? 'lockout' : null
}

export function summarize(faultsPerRep) {
  const s = { reps: faultsPerRep.length, shallow: 0, lean: 0, heel: 0, lockout: 0 }
  for (const faults of faultsPerRep) for (const f of new Set(faults)) if (f in s) s[f]++
  return s
}
