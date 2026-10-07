import { useEffect, useRef, useState } from 'react'
import { openCamera, stopStream } from '../lib/camera.js'
import { createPose } from '../lib/pose.js'
import { drawPose } from './pose-draw.js'

// Step 0 of the camera rep counter (spec §10): how many frames a second this phone's WebView gets
// through MediaPipe. Temporary — components/RepCamera.jsx replaces it.
export default function PoseProbe({ onClose }) {
  const videoRef = useRef(null), canvasRef = useRef(null)
  const [fps, setFps] = useState(0)
  const [status, setStatus] = useState('loading')
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    let stream = null, pose = null, raf = 0, stopped = false
    const stamps = []
    ;(async () => {
      try {
        stream = await openCamera('environment')
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        pose = await createPose()
        if (stopped) return
        setStatus(pose.delegate)
        const loop = () => {
          if (stopped) return
          const now = performance.now()
          const lm = v.readyState >= 2 ? pose.detect(v, now) : null
          const c = canvasRef.current
          if (c && v.videoWidth) {
            if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
            drawPose(c.getContext('2d'), lm, c.width, c.height)
          }
          setSeen(!!lm)
          stamps.push(now)
          while (stamps.length && now - stamps[0] > 2000) stamps.shift()
          setFps(Math.round(stamps.length / 2))
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (e) {
        setStatus('error: ' + (e.code || e.message))
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stopStream(stream); pose?.close() }
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', zIndex: 1000 }}>
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', top: 24, left: 16, fontSize: 28, fontWeight: 700 }}>{fps} fps · {status} · {seen ? 'body' : '—'}</div>
      <button onClick={onClose} style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', fontSize: 20, padding: '12px 32px' }}>Close</button>
    </div>
  )
}
