import { describe, it, expect, vi } from 'vitest'
import { drawPose } from './pose-draw.js'

const fakeCtx = () => ({ clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() })
const body = (vis = 1) => Array.from({ length: 33 }, (_, i) => ({ x: 0.25, y: i / 33, visibility: vis }))

describe('drawPose', () => {
  it('clears and draws nothing without landmarks', () => {
    const ctx = fakeCtx()
    drawPose(ctx, null, 100, 200)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 200)
    expect(ctx.stroke).not.toHaveBeenCalled()
  })
  it('skips bones whose ends are not visible enough', () => {
    const ctx = fakeCtx()
    drawPose(ctx, body(0.2), 100, 200)
    expect(ctx.stroke).not.toHaveBeenCalled()
  })
  it('mirrors x for the front camera, so the skeleton sits on the mirrored picture', () => {
    const plain = fakeCtx(), mirrored = fakeCtx()
    drawPose(plain, body(), 100, 200)
    drawPose(mirrored, body(), 100, 200, { mirror: true })
    expect(plain.moveTo.mock.calls[0][0]).toBe(25)
    expect(mirrored.moveTo.mock.calls[0][0]).toBe(75)
  })
})
