import { describe, it, expect } from 'vitest'
import { createSquatSession } from './session.js'
import { ramp, frame } from './test-frames.js'

const session = () => createSquatSession({ metricsOf: m => m })   // tests feed metrics frames directly
const STAND = Array(70).fill(170)
const rep = (bottom = {}, topTo = 170) => [
  ...ramp(170, 91, 600).map(k => frame(k, k < 95 ? { hipY: 0.71, kneeY: 0.7, ...bottom } : {})),
  ...ramp(90, topTo, 600), ...Array(8).fill(topTo),
]

function run(frames) {
  const s = session()
  const out = []
  let t = 0
  for (const f of [...STAND, ...frames]) {
    out.push(...s.push(typeof f === 'number' ? frame(f) : f, t).say)
    t += 33
  }
  return { s, out }
}

describe('squat session', () => {
  it('says ready, then counts, with no cue for a clean rep', () => {
    const { out } = run(rep())
    expect(out).toEqual([{ kind: 'ready' }, { kind: 'count', n: 1 }])
  })
  it('follows the count with the most important cue of a faulty rep, only one', () => {
    const { out } = run(rep({ hipY: 0.6, torsoLean: 70 }))
    expect(out.slice(1)).toEqual([{ kind: 'count', n: 1 }, { kind: 'cue', fault: 'shallow' }])
  })
  it('says "stand all the way up" when the next rep starts, if that rep had no cue yet', () => {
    const { out } = run([...rep({}, 157), ...rep()])
    expect(out.slice(1)).toEqual([{ kind: 'count', n: 1 }, { kind: 'cue', fault: 'lockout' }, { kind: 'count', n: 2 }])
  })
  it('keeps to one cue for a rep that was shallow and also stood up short', () => {
    const { out } = run([...rep({ hipY: 0.6 }, 157), ...rep()])
    expect(out.filter(x => x.kind === 'cue')).toEqual([{ kind: 'cue', fault: 'shallow' }])
  })
  it('sums every fault of every rep at the finish, the unspoken ones too', () => {
    const { s } = run([...rep({ hipY: 0.6 }, 157), ...rep(), ...rep({ torsoLean: 70 })])
    const end = s.finish()
    expect(end.count).toBe(3)
    expect(end.summary).toEqual({ reps: 3, shallow: 1, lean: 1, heel: 0, lockout: 1 })
    expect(end.faults).toEqual([['shallow', 'lockout'], [], ['lean']])
  })
  it('says it lost sight of the body', () => {
    const { out } = run([...rep(), ...Array(40).fill(null)])
    expect(out.at(-1)).toEqual({ kind: 'lost' })
  })
})
