import { describe, it, expect } from 'vitest'
import { createSquatSession } from './session.js'

// Real sets, recorded by the user and reduced to landmark numbers on /#/dev/pose-extract (no video
// is ever stored). Each file carries what really happened: the rep count and the faulty reps.
const files = import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' })
const toLandmarks = lm => lm && lm.map(([x, y, visibility]) => ({ x, y, z: 0, visibility }))

describe.skipIf(Object.keys(files).length === 0)('squat fixtures', () => {
  for (const [name, fx] of Object.entries(files)) {
    it(`${name}: counts ${fx.expected.reps} reps and flags the faulty ones`, () => {
      const s = createSquatSession()
      for (const f of fx.frames) s.push(toLandmarks(f.lm), f.t, fx.aspect)
      const end = s.finish()
      expect(end.count).toBe(fx.expected.reps)
      const flagged = Object.fromEntries(end.faults.map((f, i) => [String(i + 1), f]).filter(([, f]) => f.length))
      expect(flagged).toEqual(fx.expected.faults)
    })
  }
})
