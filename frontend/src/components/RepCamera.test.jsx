// @vitest-environment happy-dom
// The camera rep counter screen: hint → live count → summary, Save only with a count, the count
// kept when the app goes to the background, and a refused camera explained in place.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// A scripted session: the test sets the count the next frame reports.
const m = vi.hoisted(() => ({ count: 0, say: [] }))
vi.mock('../lib/squat/session.js', () => ({
  createSquatSession: () => ({
    push: () => { const say = m.say; m.say = []; return { say, count: m.count, phase: 'up' } },
    finish: () => ({ say: [], count: m.count, summary: { reps: m.count, shallow: 0, lean: 0, heel: 0, lockout: 0 }, faults: [] }),
  }),
}))
import RepCamera, { summaryLines } from './RepCamera.jsx'

let host, root, frameCb
const deps = (over = {}) => ({
  open: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
  makePose: vi.fn().mockResolvedValue({ detect: () => [], close: vi.fn() }),
  makeSpeaker: () => ({ say: vi.fn(), stop: vi.fn() }),
  raf: cb => { frameCb = cb; return 1 },
  caf: vi.fn(),
  now: () => 0,
  ...over,
})
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
const mount = async props => {
  await act(async () => { root.render(<RepCamera onSave={vi.fn()} onCancel={vi.fn()} deps={deps()} {...props} />) })
  await flush()
}
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.includes(label))
const frame = async count => { m.count = count; await act(async () => { frameCb() }) }

beforeEach(() => {
  m.count = 0
  m.say = []
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue()
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
  // happy-dom only takes a real MediaStream here; the fake stream above is a plain object.
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, get: () => null, set: () => {} })
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

describe('RepCamera', () => {
  it('shows the setup hint, then the live count', async () => {
    await mount()
    expect(host.textContent).toMatch(/whole body in the picture/)
    await frame(3)
    expect(host.querySelector('.repcam-count').textContent).toBe('3')
  })
  it('keeps Save off when nothing was counted', async () => {
    await mount()
    await act(async () => { button('Finish').click() })
    expect(button('Save to set').disabled).toBe(true)
  })
  it('saves the count after Finish', async () => {
    const onSave = vi.fn()
    await mount({ onSave })
    await frame(8)
    await act(async () => { button('Finish').click() })
    expect(host.textContent).toMatch('8 reps')
    await act(async () => { button('Save to set').click() })
    expect(onSave).toHaveBeenCalledWith(8)
  })
  it('goes to the summary, keeping the count, when the app is sent to the background', async () => {
    await mount()
    await frame(5)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(host.textContent).toMatch('5 reps')
  })
  it('explains a refused camera instead of crashing', async () => {
    await mount({ deps: deps({ open: vi.fn().mockRejectedValue({ code: 'denied' }) }) })
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/Camera access was denied/)
  })
})

describe('summaryLines', () => {
  it('leads with the count and lists only faults that happened', () => {
    expect(summaryLines({ reps: 8, shallow: 2, lean: 0, heel: 0, lockout: 1 }))
      .toEqual(['8 reps', 'Not deep enough: 2', 'Not standing all the way up: 1'])
  })
})
