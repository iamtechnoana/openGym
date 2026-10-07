/* One camera set of squats: frames in, what to say and show out. Ties the counter to the form
 * checks and decides the voice (spec §2, §5): the count on every rep, then at most one cue per rep
 * — a bottom fault right away, or "stand all the way up" when the next rep starts, if that rep had
 * no cue yet. Pure: components/RepCamera.jsx does the camera, the drawing and the speaking. */
import { createRepCounter } from './rep-counter.js'
import { bottomFaults, lockoutFault, summarize } from './form-rules.js'
import { frameMetrics } from './angles.js'

export function createSquatSession({ counter = {}, form = {}, metricsOf = frameMetrics } = {}) {
  const c = createRepCounter(counter)
  const faults = []          // faults[n - 1]: every fault of rep n
  const cued = new Set()     // reps that already got their one spoken cue

  function handle(events, say) {
    for (const ev of events) {
      if (ev.type === 'ready') say.push({ kind: 'ready' })
      else if (ev.type === 'lost') say.push({ kind: 'lost' })
      else if (ev.type === 'rep') {
        const f = bottomFaults(ev, form)
        faults[ev.n - 1] = f
        say.push({ kind: 'count', n: ev.n })
        if (f.length) { say.push({ kind: 'cue', fault: f[0] }); cued.add(ev.n) }
      } else if (ev.type === 'top') {
        const l = lockoutFault(ev, form)
        if (!l) continue
        ;(faults[ev.n - 1] ||= []).push(l)
        if (!cued.has(ev.n)) { say.push({ kind: 'cue', fault: l }); cued.add(ev.n) }
      }
    }
  }

  return {
    push(landmarks, t, aspect = 1) {
      const say = []
      handle(c.push(metricsOf(landmarks, aspect), t), say)
      return { say, count: c.count, phase: c.phase }
    },
    finish() {
      const say = []
      handle(c.finish(), say)
      const perRep = Array.from({ length: c.count }, (_, i) => faults[i] || [])
      return { say, count: c.count, summary: summarize(perRep), faults: perRep }
    },
  }
}
