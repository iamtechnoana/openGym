import { describe, it, expect, vi } from 'vitest'
import { cameraError, openCamera, stopStream } from './camera.js'

describe('camera', () => {
  it('maps a refused permission to denied, anything else to unavailable', () => {
    expect(cameraError({ name: 'NotAllowedError' })).toBe('denied')
    expect(cameraError({ name: 'SecurityError' })).toBe('denied')
    expect(cameraError({ name: 'NotFoundError' })).toBe('unavailable')
    expect(cameraError(null)).toBe('unavailable')
  })
  it('asks for the requested camera at a modest resolution, without audio', async () => {
    const getUserMedia = vi.fn().mockResolvedValue('stream')
    await expect(openCamera('user', { getUserMedia })).resolves.toBe('stream')
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
  })
  it('rejects with a code when there is no camera API or the user refuses', async () => {
    await expect(openCamera('environment', null)).rejects.toMatchObject({ code: 'unavailable' })
    const refuse = { getUserMedia: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }) }
    await expect(openCamera('environment', refuse)).rejects.toMatchObject({ code: 'denied' })
  })
  it('stops every track and tolerates no stream', () => {
    const stop = vi.fn()
    stopStream({ getTracks: () => [{ stop }, { stop }] })
    expect(stop).toHaveBeenCalledTimes(2)
    expect(() => stopStream(null)).not.toThrow()
  })
})
