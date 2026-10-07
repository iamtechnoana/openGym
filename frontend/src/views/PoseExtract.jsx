import { useState } from 'react'
import { createPose } from '../lib/pose.js'

// Development only (App.jsx registers it when import.meta.env.DEV): pick a squat video, step
// through it at 30 fps and download its landmarks as a fixture for lib/squat/fixtures.test.js.
// The video never leaves the browser; only numbers are saved. Fill in "expected" by hand after.
export default function PoseExtract() {
  const [status, setStatus] = useState('Pick a video')
  const run = async file => {
    const v = document.createElement('video')
    v.muted = true
    v.src = URL.createObjectURL(file)
    await new Promise(r => { v.onloadeddata = r })
    const pose = await createPose()
    const frames = []
    for (let t = 0; t < v.duration * 1000; t += 1000 / 30) {
      v.currentTime = t / 1000
      await new Promise(r => { v.onseeked = r })
      const lm = pose.detect(v, t)
      frames.push({ t: Math.round(t), lm: lm && lm.map(p => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.visibility ?? 0).toFixed(3)]) })
      if (frames.length % 30 === 0) setStatus(`${Math.round(t / 1000)} s / ${Math.round(v.duration)} s`)
    }
    pose.close()
    const fx = { aspect: v.videoWidth / v.videoHeight, frames, expected: { reps: 0, faults: {} } }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(fx)], { type: 'application/json' }))
    a.download = file.name.replace(/\.[^.]+$/, '') + '.json'
    a.click()
    setStatus(`Done: ${frames.length} frames. Set "expected" in the file, then put it in src/lib/squat/fixtures/.`)
  }
  return (
    <div style={{ padding: 16 }}>
      <h1>Pose extract</h1>
      <input type="file" accept="video/*" onChange={e => e.target.files[0] && run(e.target.files[0])} />
      <p>{status}</p>
    </div>
  )
}
