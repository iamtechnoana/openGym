import { describe, it, expect } from 'vitest'
import { angleAt, leanFromVertical, pickSide, frameMetrics } from './angles.js'
import { poseFrom } from './test-frames.js'

describe('angleAt', () => {
  it('measures the angle at the middle point', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180)
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90)
  })
  it('is null for a missing or coincident point', () => {
    expect(angleAt(null, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
  })
})

describe('leanFromVertical', () => {
  it('is 0 for an upright torso and 45 for a torso halfway to the floor', () => {
    expect(leanFromVertical({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 })).toBeCloseTo(0)
    expect(leanFromVertical({ x: 0.8, y: 0.2 }, { x: 0.5, y: 0.5 })).toBeCloseTo(45)
  })
})

describe('pickSide', () => {
  it('reads the side whose leg the camera sees better', () => {
    const lm = poseFrom({ side: 'right', hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9] })
    expect(pickSide(lm)).toBe('right')
  })
})

describe('frameMetrics', () => {
  const standing = { hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9], shoulder: [0.5, 0.2], heel: [0.48, 0.92] }
  it('reads a straight leg as about 180° and an upright torso', () => {
    const m = frameMetrics(poseFrom(standing))
    expect(m.side).toBe('left')
    expect(m.knee).toBeCloseTo(180)
    expect(m.torsoLean).toBeCloseTo(0)
    expect(m.legLen).toBeCloseTo(0.4)
    expect(m.heelY).toBeCloseTo(0.92)
  })
  it('corrects for a wide picture: x is stretched by the aspect ratio before measuring', () => {
    // At aspect 2 this knee is a right angle; read raw it would not be.
    const lm = poseFrom({ hip: [0.4, 0.6], knee: [0.5, 0.6], ankle: [0.5, 0.8] })
    expect(frameMetrics(lm, 2).knee).toBeCloseTo(90)
  })
  it('is null when hip, knee or ankle is not visible enough', () => {
    expect(frameMetrics(poseFrom({ ...standing, knee: [0.5, 0.7, 0.3] }))).toBeNull()
    expect(frameMetrics(null)).toBeNull()
  })
  it('leaves torso lean and heel empty when those points are not visible', () => {
    const m = frameMetrics(poseFrom({ ...standing, shoulder: [0.5, 0.2, 0.1], heel: [0.5, 0.9, 0.1] }))
    expect(m.torsoLean).toBeNull()
    expect(m.heelY).toBeNull()
  })
})
