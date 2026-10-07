/* The rep counter's voice (spec §2): the count and the form cues, in the app's language. The
 * browser has speechSynthesis; Android's WebView has none, so the app speaks through the
 * text-to-speech plugin, loaded on first use. Where neither can speak, a short beep stands in for
 * each line — and once speaking has failed, it stays beeps for the rest of the set. */
import { MOBILE } from './mobile.js'
import { beep } from './sound.js'

const BCP47 = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT',
  'pt-BR': 'pt-BR', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU', ko: 'ko-KR', zh: 'zh-CN',
  'zh-TW': 'zh-TW', ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH',
}
export const speechLang = lang => BCP47[lang] || BCP47[String(lang || '').split('-')[0]] || 'en-US'

export function createSpeaker({
  lang = 'en',
  native = MOBILE,
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  loadTts = () => import('@capacitor-community/text-to-speech').then(m => m.TextToSpeech),
  fallback = () => beep(true, 880, 0.12),
} = {}) {
  const voice = speechLang(lang)
  let tts = null
  let broken = false
  // Lines reach the engine in the order they were said: each waits until the one before it has
  // been handed over (not until it has been spoken, or a count could never cut a line short).
  // Without this, a cue said right after an interrupting count overtook it while the count was
  // still waiting on stop(), and "deeper" came out before "three".
  let handedOver = Promise.resolve()

  function say(text, options = {}) {
    const previous = handedOver
    let handed
    handedOver = new Promise(resolve => { handed = resolve })
    return (async () => {
      try { await previous; await speak(text, options, handed) } finally { handed() }
    })()
  }

  async function speak(text, { interrupt = false } = {}, handed) {
    if (broken) return fallback()
    try {
      if (native) {
        tts ||= await loadTts()
        if (interrupt) await tts.stop().catch(() => {})
        // queueStrategy 1 = Add: a cue waits for the count before it instead of cutting it off.
        const spoken = tts.speak({ text, lang: voice, rate: 1.1, queueStrategy: 1 })
        handed()
        await spoken
        return
      }
      if (!synth || !Utterance) { broken = true; return fallback() }
      if (interrupt) synth.cancel()
      const u = new Utterance(text)
      u.lang = voice
      u.rate = 1.1
      synth.speak(u)
    } catch {
      broken = true
      fallback()
    }
  }

  function stop() {
    try { if (native) tts?.stop(); else synth?.cancel() } catch { /* nothing to stop */ }
  }

  return { say, stop }
}
