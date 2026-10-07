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
  it('says a cue after the count it follows, even though the count interrupts', async () => {
    const calls = []
    const tts = {
      speak: vi.fn(async ({ text }) => { calls.push('speak:' + text) }),
      stop: vi.fn(async () => { calls.push('stop') }),
    }
    const sp = createSpeaker({ native: true, loadTts: async () => tts })
    await sp.say('warm')
    sp.say('3', { interrupt: true })
    await sp.say('Deeper')
    expect(calls).toEqual(['speak:warm', 'stop', 'speak:3', 'speak:Deeper'])
  })
  it('says nothing more once stopped, even a line still waiting for the plugin to load', async () => {
    const tts = { speak: vi.fn().mockResolvedValue(), stop: vi.fn().mockResolvedValue() }
    let loaded
    const sp = createSpeaker({ native: true, loadTts: () => new Promise(r => { loaded = r }) })
    const pending = sp.say('Daha derin')
    await new Promise(r => setTimeout(r, 0))   // the line is now waiting on the plugin
    sp.stop()
    loaded(tts)
    await pending
    await sp.say('bir')
    expect(tts.speak).not.toHaveBeenCalled()
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
