import { describe, it, expect } from 'vitest'
import { poseAssetBase, nextTimestamp } from './pose.js'

describe('pose helpers', () => {
  it('finds the bundled assets next to the page, whatever the hash route', () => {
    expect(poseAssetBase('http://localhost:5173/')).toBe('http://localhost:5173/mediapipe/')
    expect(poseAssetBase('https://localhost/index.html#/workout')).toBe('https://localhost/mediapipe/')
  })
  it('keeps timestamps strictly increasing, as detectForVideo requires', () => {
    expect(nextTimestamp(-1, 100)).toBe(100)
    expect(nextTimestamp(100, 100)).toBe(101)
    expect(nextTimestamp(100, 50)).toBe(101)
  })
})
