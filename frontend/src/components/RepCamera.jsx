import { useEffect, useRef, useState } from 'react'
import { t, getLang } from '../lib/i18n.js'
import { openCamera, stopStream } from '../lib/camera.js'
import { createPose } from '../lib/pose.js'
import { createSquatSession } from '../lib/squat/session.js'
import { createSpeaker } from '../lib/speech.js'
import { drawPose } from './pose-draw.js'
import { Button } from './ui.jsx'
import './repcam.css'

// Camera rep counter for squats (docs/superpowers/specs/2026-10-07-squat-camera-design.md):
// setup → counting → summary. The set ends only on Finish (or when the app goes to the background,
// which keeps the count). Save hands the count to onSave; nothing is stored here.
const CUE = { shallow: 'Deeper', lean: 'Chest up', heel: 'Stay on your heels', lockout: 'Stand all the way up' }
const SUMMARY = { shallow: 'Not deep enough: {0}', lean: 'Leaning forward: {0}', heel: 'Heels came up: {0}', lockout: 'Not standing all the way up: {0}' }
const SLOW_FPS = 10

export function summaryLines(summary) {
  return [t('{0} reps', summary.reps), ...Object.keys(SUMMARY).filter(k => summary[k] > 0).map(k => t(SUMMARY[k], summary[k]))]
}

export default function RepCamera({ onSave, onCancel, deps = {} }) {
  const {
    open = openCamera, makePose = createPose, makeSpeaker = createSpeaker,
    raf = cb => requestAnimationFrame(cb), caf = id => cancelAnimationFrame(id), now = () => performance.now(),
  } = deps
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const sessionRef = useRef(null)
  const speakerRef = useRef(null)
  const [facing, setFacing] = useState('environment')
  const [stage, setStage] = useState('setup')     // setup | counting | summary
  const [error, setError] = useState(null)        // denied | unavailable | model
  const [count, setCount] = useState(0)
  const [lost, setLost] = useState(false)
  const [slow, setSlow] = useState(false)
  const [summary, setSummary] = useState(null)
  const done = stage === 'summary'

  if (!sessionRef.current) sessionRef.current = createSquatSession()
  if (!speakerRef.current) speakerRef.current = makeSpeaker({ lang: getLang() })
  useEffect(() => () => speakerRef.current?.stop(), [])

  const finish = () => {
    if (sessionRef.current.done) return
    const r = sessionRef.current.finish()
    sessionRef.current.done = true
    speakerRef.current.say(summaryLines(r.summary).join('. '), { interrupt: true })
    setSummary(r.summary)
    setCount(r.count)
    setStage('summary')
  }

  useEffect(() => {
    if (done) return
    let stream = null, pose = null, id = 0, stopped = false
    const stamps = []
    const speak = items => {
      for (const s of items) {
        const sp = speakerRef.current
        if (s.kind === 'count') sp.say(String(s.n), { interrupt: true })
        else if (s.kind === 'cue') sp.say(t(CUE[s.fault]))
        else if (s.kind === 'ready') { setStage('counting'); sp.say(t('Ready')) }
        else if (s.kind === 'lost') sp.say(t("I can't see you"))
      }
    }
    ;(async () => {
      try {
        stream = await open(facing)
        if (stopped) { stopStream(stream); return }
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        try { pose = await makePose() } catch { if (!stopped) setError('model'); return }
        // Closed or switched camera while the model loaded: cleanup already ran without it.
        if (stopped) { pose.close(); return }
        let lastVideoTime = -1
        const loop = () => {
          if (stopped) return
          // The screen repaints faster than the camera delivers; read each camera frame once,
          // so the model isn't run twice on the same picture and the fps below is the camera's.
          if (v.currentTime === lastVideoTime) { id = raf(loop); return }
          lastVideoTime = v.currentTime
          const ts = now()
          const lm = v.readyState >= 2 ? pose.detect(v, ts) : null
          const aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 1
          const r = sessionRef.current.push(lm, ts, aspect)
          speak(r.say)
          setCount(r.count)
          setLost(r.phase === 'lost')
          const c = canvasRef.current
          if (c && v.videoWidth) {
            if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
            drawPose(c.getContext('2d'), lm, c.width, c.height)
          }
          stamps.push(ts)
          while (stamps.length && ts - stamps[0] > 3000) stamps.shift()
          if (ts - stamps[0] > 2500) setSlow(stamps.length / 3 < SLOW_FPS)
          id = raf(loop)
        }
        id = raf(loop)
      } catch (e) {
        if (!stopped) setError(e?.code === 'denied' ? 'denied' : 'unavailable')
      }
    })()
    return () => { stopped = true; caf(id); stopStream(stream); pose?.close() }
  }, [facing, done])

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) finish() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  })

  const message = error === 'denied' ? t('Camera access was denied. Allow it in Settings and try again.')
    : error === 'unavailable' ? t('No camera available.')
    : error === 'model' ? t("The pose model couldn't be loaded.") : null
  const mirror = facing === 'user' ? 'mirror' : ''

  return (
    <div className="repcam">
      <video ref={videoRef} playsInline muted className={mirror} />
      <canvas ref={canvasRef} className={mirror} />
      <div className="repcam-top">
        {stage === 'setup' && !message && <div className="repcam-hint">{t('Put the phone beside you at hip height, with your whole body in the picture.')}</div>}
        {!done && lost && <div className="repcam-warn">{t("I can't see you")}</div>}
        {!done && slow && <div className="repcam-warn">{t('This device is slow, so the count may be off.')}</div>}
        {message && <div className="repcam-warn" role="alert">{message}</div>}
      </div>
      {!done ? <>
        <div className="repcam-count" aria-live="polite">{count}</div>
        <div className="repcam-actions">
          <Button variant="primary" className="repcam-finish" onClick={finish}>{t('Finish')}</Button>
          <Button variant="tinted" icon="swap" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}>{t('Switch camera')}</Button>
          <Button variant="ghost" onClick={onCancel}>{t('Discard')}</Button>
        </div>
      </> : (
        <div className="repcam-summary">
          {summaryLines(summary).map((line, i) => <div key={i} className={i ? 'small' : 'repcam-sum-head'}>{line}</div>)}
          <div className="repcam-actions">
            <Button variant="primary" className="repcam-finish" disabled={!count} onClick={() => onSave(count)}>{t('Save to set')}</Button>
            <Button variant="ghost" onClick={onCancel}>{t('Discard')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
