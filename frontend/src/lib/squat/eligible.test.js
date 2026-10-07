import { describe, it, expect } from 'vitest'
import { isCameraSquat, CAMERA_SQUAT_IDS } from './eligible.js'

describe('isCameraSquat', () => {
  it('offers itself on two-legged catalogue squats', () => {
    for (const id of ['0043', '1462', '1760', '0413', '0770', '0852']) expect(isCameraSquat(id)).toBe(true)
  })
  it('stays off catalogue variants the side view cannot judge', () => {
    // jump, split, pistol, sissy, hack, squat row
    for (const id of ['0053', '0099', '1759', '1489', '0046', '1003']) expect(isCameraSquat(id)).toBe(false)
  })
  it('judges custom exercises by name', () => {
    expect(isCameraSquat('c_1', 'Back squat')).toBe(true)
    expect(isCameraSquat('c_2', 'Goblet Squat')).toBe(true)
    expect(isCameraSquat('c_3', 'Bulgarian split squat')).toBe(false)
    expect(isCameraSquat('c_4', 'Squat row')).toBe(false)
    expect(isCameraSquat('c_5', 'Bench press')).toBe(false)
    expect(isCameraSquat('c_6')).toBe(false)
  })
  it('lists only four-digit catalogue ids', () => {
    for (const id of CAMERA_SQUAT_IDS) expect(id).toMatch(/^\d{4}$/)
  })
})
