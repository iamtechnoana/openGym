import { describe, it, expect } from 'vitest'
import { createRepCounter } from './rep-counter.js'
import { feed, ramp, frame } from './test-frames.js'

const types = evs => evs.map(e => e.type)
const STAND = Array(70).fill(170)                              // 2.3 s standing
// One 1.2 s squat, then a quarter second standing — so the smoothed knee angle settles at the top
// before the next rep starts down and each rep's top reads as a full lockout.
const REP = [...ramp(170, 90, 600), ...ramp(90, 170, 600), ...Array(8).fill(170)]
const ready = () => { const c = createRepCounter(); const { t } = feed(c, STAND); return { c, t } }

describe('rep counter — getting ready', () => {
  it('says ready only after two seconds standing in full view', () => {
    const c = createRepCounter()
    expect(types(feed(c, Array(55).fill(170)).events)).toEqual([])
    expect(types(feed(c, Array(15).fill(170), { t0: 55 * 33 }).events)).toEqual(['ready'])
    expect(c.phase).toBe('up')
  })
  it('never gets ready while crouched, and starts the two seconds over after a gap', () => {
    const c = createRepCounter()
    expect(feed(c, Array(100).fill(120)).events).toEqual([])
    const r = feed(c, [...Array(40).fill(170), null, ...Array(40).fill(170)], { t0: 100 * 33 })
    expect(types(r.events)).toEqual([])                          // 40 frames ≈ 1.3 s on each side of the gap
    expect(c.phase).toBe('setup')
  })
})

describe('rep counter — counting', () => {
  it('counts one smooth squat once, with its deepest frame', () => {
    const { c, t } = ready()
    const { events } = feed(c, REP, { t0: t })
    const reps = events.filter(e => e.type === 'rep')
    expect(reps).toHaveLength(1)
    expect(reps[0].n).toBe(1)
    expect(reps[0].minKnee).toBeLessThan(100)
    expect(c.count).toBe(1)
  })
  it('does not count twice for a wobble at the bottom or near the top', () => {
    const { c, t } = ready()
    const wobbly = [...ramp(170, 92, 500), 105, 95, 108, 92, ...ramp(92, 147, 400), 140, 148, 145, ...ramp(145, 170, 200)]
    feed(c, wobbly, { t0: t })
    expect(c.count).toBe(1)
  })
  it('ignores a dip shorter than the minimum rep time', () => {
    const { c, t } = ready()
    feed(c, [...ramp(170, 90, 150), ...ramp(90, 170, 150)], { t0: t })
    expect(c.count).toBe(0)
  })
  it('numbers reps and reports how far each stood up when the next one starts', () => {
    const { c, t } = ready()
    const half = [...ramp(170, 90, 600), ...ramp(90, 156, 600), ...Array(10).fill(156)]   // stands to ~156°
    // The next rep starts down from where that one stopped, not from a jump to 170°.
    const fromHalf = [...ramp(156, 90, 600), ...ramp(90, 170, 600), ...Array(8).fill(170)]
    const { events, t: t2 } = feed(c, [...REP, ...half, ...fromHalf], { t0: t })
    expect(events.filter(e => e.type === 'rep').map(e => e.n)).toEqual([1, 2, 3])
    const tops = events.filter(e => e.type === 'top')
    expect(tops.map(e => e.n)).toEqual([1, 2])
    expect(tops[0].topKnee).toBeGreaterThan(165)
    expect(tops[1].topKnee).toBeLessThan(160)
    expect(c.finish()).toEqual([expect.objectContaining({ type: 'top', n: 3 })])
    expect(c.finish()).toEqual([])
    expect(t2).toBeGreaterThan(t)
  })
  it('measures how far the heel lifted, against the leg length', () => {
    const { c, t } = ready()
    const down = ramp(170, 90, 600).map(k => frame(k, { heelY: 0.9 - (170 - k) / 80 * 0.024 }))   // heel up 0.024 at the bottom
    const up = ramp(90, 170, 600).map(k => frame(k))
    const rep = feed(c, [...down, ...up], { t0: t }).events.find(e => e.type === 'rep')
    expect(rep.heelRise).toBeCloseTo(0.024 / 0.4, 2)
  })
})

describe('rep counter — losing sight', () => {
  it('pauses after a second out of view and carries on with the same count', () => {
    const { c, t } = ready()
    const r1 = feed(c, REP, { t0: t })
    const r2 = feed(c, Array(40).fill(null), { t0: r1.t })
    expect(types(r2.events)).toEqual(['lost'])
    expect(c.phase).toBe('lost')
    const r3 = feed(c, [170, ...REP], { t0: r2.t })
    expect(types(r3.events)).toContain('found')
    expect(c.count).toBe(2)
  })
})
