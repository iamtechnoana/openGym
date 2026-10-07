import { describe, it, expect } from 'vitest'
import { pickSetToLog } from './log-reps.js'

describe('pickSetToLog', () => {
  it('takes the first working set not done yet, past warm-ups', () => {
    expect(pickSetToLog([{ phase: 'warmup' }, { done: true }, { done: false }, { done: false }])).toBe(2)
  })
  it('says a new set is needed when every working set is done', () => {
    expect(pickSetToLog([{ phase: 'warmup', done: false }, { done: true }])).toBe(-1)
    expect(pickSetToLog([])).toBe(-1)
  })
})
