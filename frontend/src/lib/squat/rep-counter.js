/* Squat rep counter (spec §4): a state machine over the knee angle of the side facing the camera.
 * push(metrics, tMs) takes one frame — frameMetrics() output, or null when the body isn't seen —
 * and returns the events that frame caused:
 *   { type: 'ready' }                                standing in full view for readyMs: counting starts
 *   { type: 'rep', n, bottom, minKnee, heelRise }    a rep finished: the knee came back above upAt
 *   { type: 'top', n, topKnee }                      how far rep n stood up — sent when rep n+1 starts
 *                                                    down, or by finish()
 *   { type: 'lost' } / { type: 'found' }             key points gone for lostMs / back again
 * The gap between downAt and upAt (hysteresis) keeps a wobble at the bottom or the top from
 * counting twice; a dip shorter than minRepMs is noise. The knee angle is smoothed (EMA). */
export const COUNTER_DEFAULTS = Object.freeze({ downAt: 110, upAt: 150, minRepMs: 600, readyMs: 2000, lostMs: 1000, alpha: 0.5 })

export function createRepCounter(options = {}) {
  const o = { ...COUNTER_DEFAULTS, ...options }
  let phase = 'setup'
  let resume = 'up'
  let smooth = null
  let visibleSince = null
  let lastSeen = null
  let count = 0
  let heelRef = null        // heel height while standing: the reference for a heel lift
  let rep = null            // rep in progress: { startT, minKnee, bottom, heelRise }
  let leftTopT = null       // when the knee last dropped below upAt
  let top = null            // { n, topKnee }: the standing peak after rep n, still open

  const closeTop = events => {
    if (top) { events.push({ type: 'top', n: top.n, topKnee: top.topKnee }); top = null }
  }

  function push(m, t) {
    const events = []
    if (!m || m.knee == null) {
      if (phase === 'setup') visibleSince = null
      else if (phase !== 'lost' && lastSeen != null && t - lastSeen > o.lostMs) {
        resume = phase
        phase = 'lost'
        events.push({ type: 'lost' })
      }
      return events
    }
    lastSeen = t
    smooth = smooth == null ? m.knee : o.alpha * m.knee + (1 - o.alpha) * smooth
    if (phase === 'lost') { phase = resume; events.push({ type: 'found' }) }

    if (phase === 'setup') {
      if (smooth < o.upAt) { visibleSince = null; return events }
      if (visibleSince == null) visibleSince = t
      if (t - visibleSince >= o.readyMs) { phase = 'up'; events.push({ type: 'ready' }) }
      return events
    }

    if (phase === 'up') {
      if (smooth >= o.upAt) {
        leftTopT = null
        if (m.heelY != null) heelRef = heelRef == null ? m.heelY : 0.9 * heelRef + 0.1 * m.heelY
        if (top) top.topKnee = Math.max(top.topKnee, smooth)
      } else if (leftTopT == null) {
        leftTopT = t
      }
      if (smooth < o.downAt) {
        closeTop(events)
        phase = 'down'
        rep = { startT: leftTopT ?? t, minKnee: smooth, bottom: m, heelRise: 0 }
      }
      return events
    }

    // phase === 'down'
    if (smooth < rep.minKnee) { rep.minKnee = smooth; rep.bottom = m }
    if (heelRef != null && m.heelY != null && m.legLen > 0) {
      rep.heelRise = Math.max(rep.heelRise, (heelRef - m.heelY) / m.legLen)
    }
    if (smooth >= o.upAt) {
      phase = 'up'
      if (t - rep.startT >= o.minRepMs) {
        count++
        events.push({ type: 'rep', n: count, bottom: rep.bottom, minKnee: rep.minKnee, heelRise: rep.heelRise })
        top = { n: count, topKnee: smooth }
      }
      rep = null
      leftTopT = null
    }
    return events
  }

  function finish() {
    const events = []
    closeTop(events)
    return events
  }

  return {
    push,
    finish,
    get count() { return count },
    get phase() { return phase },
  }
}
