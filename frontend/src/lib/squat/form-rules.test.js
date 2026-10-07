import { describe, it, expect } from 'vitest'
import { bottomFaults, lockoutFault, summarize, FORM_DEFAULTS } from './form-rules.js'
import { frame } from './test-frames.js'

const rep = (over = {}, heelRise = 0) => ({ bottom: frame(80, { hipY: 0.71, kneeY: 0.7, legLen: 0.4, torsoLean: 35, ...over }), heelRise })

describe('bottomFaults', () => {
  it('finds nothing in a deep, upright rep with heels down', () => {
    expect(bottomFaults(rep())).toEqual([])
  })
  it('calls a rep shallow when the hip stays above the knee by more than the tolerance', () => {
    expect(bottomFaults(rep({ hipY: 0.68 }))).toEqual(['shallow'])          // 0.02/0.4 = 5% above
    expect(bottomFaults(rep({ hipY: 0.695 }))).toEqual([])                  // 1.25%: within 3%
  })
  it('flags a forward lean past the limit, and heels that came up', () => {
    expect(bottomFaults(rep({ torsoLean: 60 }))).toEqual(['lean'])
    expect(bottomFaults(rep({}, 0.05))).toEqual(['heel'])
  })
  it('lists several faults most important first, and skips lean when the shoulder was not seen', () => {
    expect(bottomFaults(rep({ hipY: 0.6, torsoLean: 70 }, 0.1))).toEqual(['shallow', 'lean', 'heel'])
    expect(bottomFaults(rep({ torsoLean: null }))).toEqual([])
  })
  it('takes thresholds as options', () => {
    expect(bottomFaults(rep({ torsoLean: 60 }), { maxLean: 65 })).toEqual([])
  })
})

describe('lockoutFault', () => {
  it('flags a rep that stood up short of the lockout angle', () => {
    expect(lockoutFault({ n: 1, topKnee: 158 })).toBe('lockout')
    expect(lockoutFault({ n: 1, topKnee: FORM_DEFAULTS.lockoutAt })).toBeNull()
    expect(lockoutFault(null)).toBeNull()
  })
})

describe('summarize', () => {
  it('counts reps and, per fault, the reps that had it', () => {
    expect(summarize([[], ['shallow'], ['shallow', 'lockout'], ['lean']])).toEqual({ reps: 4, shallow: 2, lean: 1, heel: 0, lockout: 1 })
    expect(summarize([])).toEqual({ reps: 0, shallow: 0, lean: 0, heel: 0, lockout: 0 })
  })
})
