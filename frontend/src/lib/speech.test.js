import { describe, it, expect, vi } from 'vitest'
import { createSpeaker, speechLang } from './speech.js'

class FakeUtterance { constructor(text) { this.text = text } }
const fakeSynth = () => ({ speak: vi.fn(), cancel: vi.fn() })

describe('speechLang', () => {
  it('maps the app language to a voice language, English when unknown', () => {
    expect(speechLang('tr')).toBe('tr-TR')
    expect(speechLang('pt-BR')).toBe('pt-BR')
    expect(speechLang('xx')).toBe('en-US')
  })
})

describe('createSpeaker — browser', () => {
  it('speaks in the app language through speechSynthesis', async () => {
    const synth = fakeSynth()
    const sp = createSpeaker({ lang: 'tr', native: false, synth, Utterance: FakeUtterance })
    await sp.say('bir')
    expect(synth.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'bir', lang: 'tr-TR' }))
    expect(synth.cancel).not.toHaveBeenCalled()
  })
  it('cuts off what it was saying when told to interrupt', async () => {
    const synth = fakeSynth()
    await createSpeaker({ native: false, synth, Utterance: FakeUtterance }).say('2', { interrupt: true })
    expect(synth.cancel).toHaveBeenCalled()
  })
  it('beeps instead when the browser cannot speak', async () => {
    const fallback = vi.fn()
    await createSpeaker({ native: false, synth: null, Utterance: null, fallback }).say('bir')
    expect(fallback).toHaveBeenCalledTimes(1)
  })
})

describe('createSpeaker — Android app', () => {
  it('speaks through the text-to-speech plugin, queueing lines', async () => {
    const tts = { speak: vi.fn().mockResolvedValue(), stop: vi.fn().mockResolvedValue() }
    const sp = createSpeaker({ lang: 'tr', native: true, loadTts: async () => tts })
    await sp.say('Daha derin')
    expect(tts.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Daha derin', lang: 'tr-TR', queueStrategy: 1 }))
  })
  it('falls back to beeps for good once the plugin fails', async () => {
    const fallback = vi.fn()
    const tts = { speak: vi.fn().mockRejectedValue(new Error('no tts')), stop: vi.fn() }
    const sp = createSpeaker({ native: true, loadTts: async () => tts, fallback })
    await sp.say('1')
    await sp.say('2')
    expect(tts.speak).toHaveBeenCalledTimes(1)
    expect(fallback).toHaveBeenCalledTimes(2)
  })
})
