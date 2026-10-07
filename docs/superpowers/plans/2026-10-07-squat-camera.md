# Kamera ile squat sayımı — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Squat yaparken telefon kamerası tekrarları sayar, form hatalarını Türkçe sesle söyler ve
set bitince tekrar sayısını onayla sete yazar.

**Architecture:** MediaPipe Pose Landmarker WebView/tarayıcıda çalışır, her kareden 33 nokta
çıkarır. Saf modüller (`lib/squat/*`) noktaları açıya, açıları tekrara, tekrarları form hatasına
çevirir. Ekran (`RepCamera.jsx`) yalnızca kamerayı, çizimi ve sesi yönetir. Mevcut koda dokunuş
`Workout.jsx`'teki bir menü satırı ve bir kayıt fonksiyonuyla sınırlıdır.

**Tech Stack:** React 19, Vite 8, Vitest 4 (happy-dom), Capacitor 7, `@mediapipe/tasks-vision`
1.1.0, `@capacitor-community/text-to-speech` 6.x, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-07-squat-camera-design.md`

**Çalışma yeri:** `build/open-source/openGym`, dal `kisisel`. Bütün komutlar aksi
belirtilmedikçe `frontend/` içinden çalışır.

## Global Constraints

- Yalnızca iki bacakla squat, yandan çekim; diğer hareketler kapsam dışı.
- Set **yalnızca "Bitir" düğmesiyle** biter; otomatik bitiş yok.
- Tekrar başına **en fazla bir** sesli uyarı; öncelik: derinlik > öne eğilme > topuk > tam kalkma.
- Eşikler: dip `< 110°`, ayakta `> 150°`, tekrar `≥ 0,6 s`, hazır `2 s`, kayıp `1 s`, derinlik
  toleransı bacak boyunun `%3`'ü, gövde `55°`, topuk bacak boyunun `%4`'ü, tam kalkma `165°`.
- Kamera görüntüsü kaydedilmez, saklanmaz, gönderilmez. Kullanıcı videoları repoya girmez.
- Model ve WASM dosyaları uygulamanın içinde; çalışma anında CDN yok.
- Sırlar repoya girmez; keystore'un kanonik kopyası `C:\Users\90531\.secrets\bertalanffy\opengym\`.
- Yeni UI metinleri `t()` ile, 17 dil dosyasının hepsine eklenir (tr gerçek, diğerleri İngilizce).
- Windows'ta `scripts/check-mobile-bundle.test.mjs` 4 testi zaten kırık (yol ayırıcı); bu plan
  onları düzeltmez, "geçti" sayımında hariç tutulur.

## Review Focus

1. **Ön kamerada ayna görüntüsü:** iskelet videoyla aynı tarafta çizilmeli, sayım etkilenmemeli → Task 4 `drawPose` ayna testi.
2. **Tamamlanmamış set kalmamışken "Sete yaz":** sayı kaybolmamalı, yeni bir set eklenip ona yazılmalı → Task 9 `pickSetToLog` testi.
3. **Set sırasında uygulamanın arka plana atılması:** sayım kaybolmamalı, özet ekranına geçilmeli ve kamera kapanmalı → Task 9 RepCamera testi.
4. **Hiç tekrar sayılmadan "Bitir":** "Sete yaz" pasif olmalı → Task 9 RepCamera testi.
5. **Hazır olmadan çömelmiş başlamak:** çömelik pozisyonda "Hazır" denmemeli, sayım başlamamalı → Task 6 rep-counter testi.

---

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `frontend/scripts/fetch-pose-assets.mjs` | WASM'ı `node_modules`'tan kopyalar, modeli bir kez indirir → `public/mediapipe/` |
| `frontend/scripts/add-locale-keys.mjs` | JSON'daki yeni metinleri 17 dil dosyasına ekler |
| `frontend/src/lib/camera.js` | `openCamera`, `stopStream`, hata eşleme |
| `frontend/src/lib/pose.js` | MediaPipe yükleme, `detect(video, t)` |
| `frontend/src/lib/squat/eligible.js` | Hangi hareketlerde "Kamerayla say" çıkar |
| `frontend/src/lib/squat/angles.js` | Noktalar → açılar (`frameMetrics`) |
| `frontend/src/lib/squat/rep-counter.js` | Açı akışı → tekrar olayları |
| `frontend/src/lib/squat/form-rules.js` | Tekrar → hata listesi, özet |
| `frontend/src/lib/squat/session.js` | Hepsini birleştirir: kare girer, "ne söyle / ne göster" çıkar |
| `frontend/src/lib/squat/test-frames.js` | Testler için metrik ve açı dizisi üreticileri |
| `frontend/src/lib/speech.js` | Ses: tarayıcı `speechSynthesis` / Android eklentisi / bip |
| `frontend/src/components/pose-draw.js` | İskeleti canvas'a çizer |
| `frontend/src/components/PoseProbe.jsx` | Geçici hız deneyi ekranı (Task 9'da silinir) |
| `frontend/src/components/RepCamera.jsx` + `repcam.css` | Asıl ekran |
| `frontend/src/views/PoseExtract.jsx` | Yalnız geliştirmede: videodan nokta JSON'u çıkarır |
| `frontend/src/lib/squat/fixtures/*.json` + `fixtures.test.js` | Gerçek veriyle regresyon testi |
| `frontend/src/views/Workout.jsx` | Menü satırı + `logCameraReps` |
| `frontend/src/App.jsx` | Yalnız DEV'de `/dev/pose-extract` rotası |
| `.github/workflows/android-apk.yml` | `kisisel` push'unda debug APK |

---

### Task 1: Model dosyaları, kamera ve pose sarmalayıcısı

**Files:**
- Create: `frontend/scripts/fetch-pose-assets.mjs`, `frontend/src/lib/camera.js`, `frontend/src/lib/camera.test.js`, `frontend/src/lib/pose.js`, `frontend/src/lib/pose.test.js`
- Modify: `frontend/package.json` (bağımlılık + script'ler), `.gitignore` (kök)

**Interfaces:**
- Produces: `openCamera(facing = 'environment', md?) → Promise<MediaStream>` (hata `{ code: 'denied'|'unavailable' }`), `stopStream(stream)`, `cameraError(e) → 'denied'|'unavailable'`; `createPose({ base?, delegate? }) → Promise<{ detect(video, tMs) → Landmark[]|null, close(), delegate: 'GPU'|'CPU' }>`; `poseAssetBase(baseURI) → string`; `nextTimestamp(last, t) → number`. `Landmark = { x, y, z, visibility }` (x, y 0..1 normalize).

- [ ] **Step 1: Bağımlılığı kur**

Run: `npm install @mediapipe/tasks-vision@1.1.0`
Expected: `package.json` dependencies içinde `"@mediapipe/tasks-vision": "^1.1.0"`.

- [ ] **Step 2: Kamera testlerini yaz** — `frontend/src/lib/camera.test.js`

```js
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
```

- [ ] **Step 3: Çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run src/lib/camera.test.js`
Expected: FAIL — `Cannot find module './camera.js'`

- [ ] **Step 4: `frontend/src/lib/camera.js`**

```js
/* The camera for the rep counter (components/RepCamera.jsx). Same error mapping as
 * components/CameraScan.jsx: 'denied' for a refused permission, 'unavailable' for the rest.
 * 640×480 is plenty for a pose model and keeps a phone's WebView fast. */
export function cameraError(e) {
  return e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable'
}

export async function openCamera(facing = 'environment', md = globalThis.navigator?.mediaDevices) {
  if (!md || !md.getUserMedia) throw Object.assign(new Error('no camera'), { code: 'unavailable' })
  try {
    return await md.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
  } catch (e) {
    throw Object.assign(new Error(e?.message || 'camera'), { code: cameraError(e) })
  }
}

export function stopStream(stream) {
  stream?.getTracks?.().forEach(track => track.stop())
}
```

- [ ] **Step 5: Yeşil olduğunu gör**

Run: `npx vitest run src/lib/camera.test.js` → Expected: 4 passed

- [ ] **Step 6: Pose yardımcılarının testi** — `frontend/src/lib/pose.test.js`

```js
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
```

Run: `npx vitest run src/lib/pose.test.js` → Expected: FAIL (`./pose.js` yok)

- [ ] **Step 7: `frontend/src/lib/pose.js`**

```js
/* MediaPipe Pose Landmarker for the rep counter. The library is imported on first use, so it never
 * weighs on the main bundle; its WASM runtime and model ship in public/mediapipe/ (see
 * scripts/fetch-pose-assets.mjs), so it works offline in the browser and the APK. GPU first, CPU
 * when a WebView refuses the GPU delegate. */
export const POSE_MODEL = 'pose_landmarker_lite.task'

export const poseAssetBase = (baseURI = globalThis.document?.baseURI) => new URL('mediapipe/', baseURI).href

export const nextTimestamp = (last, t) => Math.max(Math.round(t), last + 1)

export async function createPose({ base = poseAssetBase(), delegate = 'GPU' } = {}) {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(base + 'wasm')
  const make = d => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: base + POSE_MODEL, delegate: d },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  let used = delegate, landmarker
  try { landmarker = await make(delegate) } catch (e) {
    if (delegate !== 'GPU') throw e
    used = 'CPU'
    landmarker = await make('CPU')
  }
  let last = -1
  return {
    delegate: used,
    detect(video, tMs) {
      last = nextTimestamp(last, tMs)
      return landmarker.detectForVideo(video, last).landmarks?.[0] || null
    },
    close() { landmarker.close() },
  }
}
```

Run: `npx vitest run src/lib/pose.test.js` → Expected: 2 passed

- [ ] **Step 8: Model indirme script'i** — `frontend/scripts/fetch-pose-assets.mjs`

```js
#!/usr/bin/env node
/* Puts what the camera rep counter needs into public/mediapipe/ (gitignored): MediaPipe's WASM
 * runtime, copied from node_modules, and the pose model, downloaded once. Both ship inside the
 * web build and the APK, so counting works offline. Run by predev, prebuild and build:mobile. */
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'mediapipe')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const model = join(out, 'pose_landmarker_lite.task')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const MIN_MODEL_BYTES = 1_000_000

if (!existsSync(wasmSrc)) {
  console.error('fetch-pose-assets: @mediapipe/tasks-vision is not installed — run npm install')
  process.exit(1)
}
mkdirSync(out, { recursive: true })
cpSync(wasmSrc, join(out, 'wasm'), { recursive: true })
if (!existsSync(model) || statSync(model).size < MIN_MODEL_BYTES) {
  const res = await fetch(MODEL_URL)
  if (!res.ok) { console.error(`fetch-pose-assets: model download failed (${res.status})`); process.exit(1) }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < MIN_MODEL_BYTES) { console.error('fetch-pose-assets: model looks truncated'); process.exit(1) }
  writeFileSync(model, buf)
}
console.log('fetch-pose-assets: ok')
```

- [ ] **Step 9: `package.json` script'leri**

`frontend/package.json` içinde `"scripts"` bloğuna ekle/değiştir:

```json
"pose-assets": "node scripts/fetch-pose-assets.mjs",
"predev": "npm run pose-assets",
"prebuild": "npm run pose-assets",
"build:mobile": "npm run pose-assets && VITE_MOBILE=1 VITE_IMG_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/ VITE_GIF_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/ vite build && cap sync && node scripts/check-mobile-bundle.mjs",
```

(`build:mobile` satırında tek değişiklik başa eklenen `npm run pose-assets && `.)

Kök `.gitignore` sonuna:

```
# camera rep counter: MediaPipe runtime + model, fetched by frontend/scripts/fetch-pose-assets.mjs
frontend/public/mediapipe/
```

- [ ] **Step 10: Script'i çalıştır**

Run: `npm run pose-assets && ls public/mediapipe public/mediapipe/wasm`
Expected: `fetch-pose-assets: ok`; `pose_landmarker_lite.task` (~5,7 MB) ve `wasm/` içinde `vision_wasm_internal.js`/`.wasm` dosyaları. `git status` bu dosyaları göstermemeli.

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json .gitignore frontend/scripts/fetch-pose-assets.mjs frontend/src/lib/camera.js frontend/src/lib/camera.test.js frontend/src/lib/pose.js frontend/src/lib/pose.test.js
git commit -m "camera reps: bundle MediaPipe pose model, camera and pose wrappers"
```

---

### Task 2: Uygun hareketler, iskelet çizimi, hız deneyi ekranı ve menü girişi

**Files:**
- Create: `frontend/src/lib/squat/eligible.js`, `frontend/src/lib/squat/eligible.test.js`, `frontend/src/components/pose-draw.js`, `frontend/src/components/pose-draw.test.js`, `frontend/src/components/PoseProbe.jsx`, `frontend/scripts/add-locale-keys.mjs`, `frontend/scripts/locale-keys/camera-menu.json`
- Modify: `frontend/src/views/Workout.jsx` (import satırı 1, `ExerciseBlock` imzası satır ~100, "Today" menüsü satır ~377, `blockProps` satır ~1209), `frontend/src/locales/*.js` (script ile)

**Interfaces:**
- Consumes: Task 1 `openCamera`, `stopStream`, `createPose`
- Produces: `isCameraSquat(id, name?) → boolean`; `drawPose(ctx, landmarks, w, h, { color?, minVis?, mirror? })`; `ExerciseBlock` prop'u `onCameraCount: (() => void) | null`; `ActiveWorkout` içinde `openCameraCount(idx)`; `node scripts/add-locale-keys.mjs <json>`

- [ ] **Step 1: Uygunluk testi** — `frontend/src/lib/squat/eligible.test.js`

```js
import { describe, it, expect } from 'vitest'
import { isCameraSquat, CAMERA_SQUAT_IDS } from './eligible.js'

describe('isCameraSquat', () => {
  it('offers itself on two-legged catalogue squats', () => {
    for (const id of ['0043', '1462', '1760', '0413', '0770', '0852']) expect(isCameraSquat(id)).toBe(true)
  })
  it('stays off catalogue variants the side view cannot judge', () => {
    // jump, split, pistol, sissy, hack, squat row
    for (const id of ['0053', '0099', '1759', '1489', '0046', '1003']) expect(isCameraSquat(id)).toBe(false)
  })
  it('judges custom exercises by name', () => {
    expect(isCameraSquat('c_1', 'Back squat')).toBe(true)
    expect(isCameraSquat('c_2', 'Goblet Squat')).toBe(true)
    expect(isCameraSquat('c_3', 'Bulgarian split squat')).toBe(false)
    expect(isCameraSquat('c_4', 'Squat row')).toBe(false)
    expect(isCameraSquat('c_5', 'Bench press')).toBe(false)
    expect(isCameraSquat('c_6')).toBe(false)
  })
  it('lists only four-digit catalogue ids', () => {
    for (const id of CAMERA_SQUAT_IDS) expect(id).toMatch(/^\d{4}$/)
  })
})
```

Run: `npx vitest run src/lib/squat/eligible.test.js` → Expected: FAIL (modül yok)

- [ ] **Step 2: `frontend/src/lib/squat/eligible.js`**

```js
/* Which exercises the camera rep counter offers itself for (spec §1): two-legged squats seen
 * from the side. Catalogue ids are listed one by one — the names alone would let in split, jump,
 * single-leg and "squat row" variants. Custom exercises qualify by name, with the same kinds of
 * variants kept out. The catalogue changes in v1.4.0: re-check this list then. */
export const CAMERA_SQUAT_IDS = new Set([
  '1004', // band squat
  '0029', '0039', '0042', // barbell front squats
  '0043', '1461', '1462', // barbell full squat
  '1436', '1435', '0063', '0124', // high bar, low bar, narrow, wide
  '0127', '1545', // zercher
  '1760', '0413', // dumbbell goblet, dumbbell squat
  '0533', '0534', // kettlebell front, goblet
  '3281', '0770', '1433', '1434', // smith
  '0852', // weighted squat
])
const SQUAT = /\bsquats?\b/i
const NOT_TWO_LEGGED = /split|single|one[- ]leg|pistol|jump|plyo|sissy|cossack|curtsey|row|curl|calf|jerk|reach|hack|overhead|bench|lying|kneel|on knees|bosu|potty|sumo|chair|supported|frankenstein/i

export function isCameraSquat(id, name = '') {
  const key = String(id ?? '')
  if (CAMERA_SQUAT_IDS.has(key)) return true
  if (/^\d{4}$/.test(key)) return false
  return SQUAT.test(name) && !NOT_TWO_LEGGED.test(name)
}
```

Run: `npx vitest run src/lib/squat/eligible.test.js` → Expected: 4 passed

- [ ] **Step 3: Çizim testi** — `frontend/src/components/pose-draw.test.js`

```js
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
```

Run: `npx vitest run src/components/pose-draw.test.js` → Expected: FAIL

- [ ] **Step 4: `frontend/src/components/pose-draw.js`**

```js
/* Draws the pose over the camera picture: torso, arms and both legs. `mirror` matches a
 * front-camera picture that the screen shows flipped. */
const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
]

export function drawPose(ctx, lm, w, h, { color = '#30d158', minVis = 0.5, mirror = false } = {}) {
  ctx.clearRect(0, 0, w, h)
  if (!lm) return
  const X = p => (mirror ? 1 - p.x : p.x) * w
  const Y = p => p.y * h
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  for (const [a, b] of BONES) {
    const p = lm[a], q = lm[b]
    if (!p || !q || (p.visibility ?? 1) < minVis || (q.visibility ?? 1) < minVis) continue
    ctx.beginPath()
    ctx.moveTo(X(p), Y(p))
    ctx.lineTo(X(q), Y(q))
    ctx.stroke()
  }
}
```

Run: `npx vitest run src/components/pose-draw.test.js` → Expected: 3 passed

- [ ] **Step 5: Hız deneyi ekranı** — `frontend/src/components/PoseProbe.jsx` (geçici; Task 9'da silinir, metinleri bu yüzden çevrilmez)

```jsx
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
```

- [ ] **Step 6: Dil anahtarı ekleme script'i** — `frontend/scripts/add-locale-keys.mjs`

```js
#!/usr/bin/env node
/* Adds new UI strings to all 17 locale packs: `node scripts/add-locale-keys.mjs <file.json>`, where
 * the JSON maps each English key to { "tr": "…" }. Turkish gets its translation; every other pack
 * gets the English text, so check-locales stays green. Keys a pack already has are left alone.
 * Each key goes in just before the pack's closing brace. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales')
const keys = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const quote = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
for (const file of readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('.test.'))) {
  const lang = file.replace(/\.js$/, '')
  const src = readFileSync(join(dir, file), 'utf8')
  const lines = src.split('\n')
  const end = lines.lastIndexOf('}')
  if (end < 0) throw new Error('no closing brace in ' + file)
  const add = Object.entries(keys)
    .filter(([en]) => !src.includes(quote(en) + ':'))
    .map(([en, tr]) => `  ${quote(en)}: ${quote(lang === 'tr' ? tr.tr : en)},`)
  lines.splice(end, 0, ...add)
  writeFileSync(join(dir, file), lines.join('\n'))
  console.log(file, '+' + add.length)
}
```

`frontend/scripts/locale-keys/camera-menu.json`:

```json
{ "Count with camera": { "tr": "Kamerayla say" } }
```

Run: `node scripts/add-locale-keys.mjs scripts/locale-keys/camera-menu.json && node scripts/check-locales.mjs`
Expected: her dosya için `+1`, ardından `17 locales, … keys each — in sync.`

- [ ] **Step 7: Workout.jsx bağlantısı**

1. Satır 1'deki import'a `lazy, Suspense` ekle:
```js
import { Fragment, lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
```
2. Diğer `lib` import'larının yanına:
```js
import { isCameraSquat } from '../lib/squat/eligible.js'
const PoseProbe = lazy(() => import('../components/PoseProbe.jsx'))
```
3. `function ExerciseBlock({ … onSwap, …` imzasına `onCameraCount,` ekle (`onSwap`'tan hemen sonra).
4. `openMore` içinde, `{ title: t('Today'), items: [` listesinde `onSwap && {…}` satırından hemen sonra:
```js
        onCameraCount && isCameraSquat(entry.id, ex?.n) && { icon: 'camera', label: t('Count with camera'), onClick: onCameraCount },
```
5. `ActiveWorkout` içinde, `const blockProps = idx => ({` satırından hemen önce:
```js
  // Camera rep counter (docs/superpowers/specs/2026-10-07-squat-camera-design.md). Step 0 opens the
  // frame-rate probe; Task 9 swaps in RepCamera.
  const openCameraCount = () => useUI.getState().openSheet(
    close => <Suspense fallback={null}><PoseProbe onClose={close} /></Suspense>, { locked: true })
```
6. `blockProps` nesnesine, `onSwap` satırından sonra:
```js
    onCameraCount: editing ? null : () => openCameraCount(idx),
```

- [ ] **Step 8: Mevcut testler ve elle kontrol**

Run: `npx vitest run src/views/Workout src/lib/squat src/components/pose-draw 2>&1 | grep -E "Test Files|Tests |FAIL"`
Expected: FAIL yok.

Run (ayrı terminal): `npm run dev`, tarayıcıda `http://localhost:5173/#/workout` aç, içinde squat olan bir antrenman başlat (demo: `VITE_DEMO=1 npx vite` → Leg Day), squat'ın "⋯" menüsünde **Kamerayla say** görünmeli; tıklayınca kamera açılmalı ve sol üstte `N fps · GPU|CPU · body` yazmalı. Bench gibi bir hareketin menüsünde görünmemeli.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/squat/eligible.js frontend/src/lib/squat/eligible.test.js frontend/src/components/pose-draw.js frontend/src/components/pose-draw.test.js frontend/src/components/PoseProbe.jsx frontend/scripts/add-locale-keys.mjs frontend/scripts/locale-keys/camera-menu.json frontend/src/views/Workout.jsx frontend/src/locales
git commit -m "camera reps: squat menu entry opening a frame-rate probe"
```

---

### Task 3: Bulutta APK derleme ve hız deneyi (KARAR NOKTASI)

**Files:**
- Create: `.github/workflows/android-apk.yml`
- Dış: `C:\Users\90531\.secrets\bertalanffy\opengym\debug.keystore`, fork secret'ı `DEBUG_KEYSTORE_B64`, fork Actions ayarları

**Interfaces:**
- Consumes: Task 1–2 (APK içinde PoseProbe)
- Produces: Her `kisisel` push'unda `openGym-kisisel-debug-<run>` artifact'ı (paket adı `ch.duartesantos.opengym.test`; resmi uygulamanın yanına ayrı kurulur)

- [ ] **Step 1: Sabit debug keystore üret** (bir kez; Java 8'in `keytool`'u yeterli)

```bash
mkdir -p /c/Users/90531/.secrets/bertalanffy/opengym
keytool -genkeypair -v -keystore /c/Users/90531/.secrets/bertalanffy/opengym/debug.keystore \
  -storepass android -keypass android -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10950 -dname "CN=Android Debug,O=Android,C=US"
```
Expected: `debug.keystore` oluştu. (Şifreler Android'in standart debug değerleri; yalnızca debug imzası.)

- [ ] **Step 2: Secret'ı fork'a koy, Actions'ı aç, upstream workflow'larını kapat**

```bash
base64 -w0 /c/Users/90531/.secrets/bertalanffy/opengym/debug.keystore | gh secret set DEBUG_KEYSTORE_B64 -R iamtechnoana/openGym
gh api -X PUT repos/iamtechnoana/openGym/actions/permissions -F enabled=true -f allowed_actions=all
```
Workflow dosyası push edildikten sonra (Step 4), upstream'in yalnızca `main`'de çalışan ve fork'ta secret'sız patlayacak üç workflow'unu kapat:
```bash
gh workflow disable docker-publish.yml -R iamtechnoana/openGym
gh workflow disable mirror.yml -R iamtechnoana/openGym
gh workflow disable pages.yml -R iamtechnoana/openGym
```

- [ ] **Step 3: `.github/workflows/android-apk.yml`**

```yaml
# Personal fork only: a debug APK of the `kisisel` branch on every push, downloadable from the run.
# Signed with a fixed debug key (secret DEBUG_KEYSTORE_B64) so each build installs over the last
# one without wiping the app's data.
name: Android APK (kisisel)

on:
  push:
    branches: [kisisel]
  workflow_dispatch:

jobs:
  apk:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - uses: android-actions/setup-android@v3
      - name: Fixed debug key
        env:
          KS: ${{ secrets.DEBUG_KEYSTORE_B64 }}
        run: |
          test -n "$KS" || { echo "secret DEBUG_KEYSTORE_B64 is missing" >&2; exit 1; }
          mkdir -p ~/.android
          echo "$KS" | base64 -d > ~/.android/debug.keystore
      - name: Web bundle + cap sync
        working-directory: frontend
        run: |
          npm ci
          npm run build:mobile
      - name: assembleDebug
        working-directory: frontend/android
        run: ./gradlew --no-daemon assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: openGym-kisisel-debug-${{ github.run_number }}
          path: frontend/android/app/build/outputs/apk/debug/*.apk
          retention-days: 30
```

- [ ] **Step 4: Push ve derlemeyi izle**

```bash
git add .github/workflows/android-apk.yml
git commit -m "ci: debug APK of the kisisel branch, signed with a fixed debug key"
git push origin kisisel
gh run watch -R iamtechnoana/openGym --exit-status $(gh run list -R iamtechnoana/openGym -w "Android APK (kisisel)" -L 1 --json databaseId -q '.[0].databaseId')
```
Expected: run başarılı. Sonra Step 2'deki üç `gh workflow disable` komutunu çalıştır.

- [ ] **Step 5: KARAR — telefonda hız ölçümü (kullanıcıyla)**

Kullanıcı: GitHub → Actions → son "Android APK (kisisel)" çalışması → artifact'ı indir, zip'ten APK'yı çıkar, telefona kur (bilinmeyen kaynak izni gerekir). Uygulamada squat içeren bir antrenman → "⋯" → **Kamerayla say** → telefonu yana koy, squat yap, ekrandaki `fps` değerini ve `GPU/CPU` bilgisini bildir.

- **≥ 15 fps:** Task 4'e devam.
- **10–15 fps:** `pose.js`'te kamera çözünürlüğünü 480×360'a düşür (`camera.js` ideal değerleri), tekrar ölç.
- **< 10 fps:** DUR. Spec §3'teki geri dönüş: yaklaşımı kullanıcıyla yeniden konuş (ML Kit native).

---

### Task 4: Açı hesapları (`angles.js`)

**Files:**
- Create: `frontend/src/lib/squat/angles.js`, `frontend/src/lib/squat/angles.test.js`, `frontend/src/lib/squat/test-frames.js`

**Interfaces:**
- Produces: `LM`, `MIN_VIS = 0.6`, `angleAt(a, b, c) → number|null` (derece), `leanFromVertical(top, bottom) → number` (derece, 0 = dik), `pickSide(lm) → 'left'|'right'`, `frameMetrics(lm, aspect = 1) → Metrics|null` where `Metrics = { side, knee, torsoLean: number|null, hipY, kneeY, heelY: number|null, legLen }`; test yardımcısı `poseFrom({ side, hip, knee, ankle, shoulder?, heel?, vis? }) → Landmark[33]`

- [ ] **Step 1: Test yardımcısı** — `frontend/src/lib/squat/test-frames.js`

```js
/* Builders for the squat tests: whole landmark arrays (angles), metrics frames (counter, session)
 * and knee-angle ramps at a camera's frame rate. */
import { LM } from './angles.js'

export function poseFrom({ side = 'left', hip, knee, ankle, shoulder, heel, vis = 0.95 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  const ix = LM[side]
  const put = (k, p) => { if (p) lm[ix[k]] = { x: p[0], y: p[1], z: 0, visibility: p[2] ?? vis } }
  put('hip', hip); put('knee', knee); put('ankle', ankle); put('shoulder', shoulder); put('heel', heel)
  return lm
}

// A metrics frame as frameMetrics() returns it; standing defaults, override what the test is about.
export const frame = (knee, over = {}) => ({
  side: 'left', knee, torsoLean: 20, hipY: 0.5, kneeY: 0.7, heelY: 0.9, legLen: 0.4, ...over,
})

export function ramp(from, to, ms, dt = 33) {
  const n = Math.max(1, Math.round(ms / dt))
  return Array.from({ length: n }, (_, i) => from + (to - from) * (i + 1) / n)
}

/** Feeds knee angles (or full frames) into push(frame, t) at dt ms; returns every event emitted. */
export function feed(target, values, { dt = 33, t0 = 0, over = {} } = {}) {
  const events = []
  let t = t0
  for (const v of values) {
    const f = v === null ? null : typeof v === 'number' ? frame(v, over) : v
    events.push(...target.push(f, t))
    t += dt
  }
  return { events, t }
}
```

- [ ] **Step 2: Açı testleri** — `frontend/src/lib/squat/angles.test.js`

```js
import { describe, it, expect } from 'vitest'
import { angleAt, leanFromVertical, pickSide, frameMetrics } from './angles.js'
import { poseFrom } from './test-frames.js'

describe('angleAt', () => {
  it('measures the angle at the middle point', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180)
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90)
  })
  it('is null for a missing or coincident point', () => {
    expect(angleAt(null, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
  })
})

describe('leanFromVertical', () => {
  it('is 0 for an upright torso and 45 for a torso halfway to the floor', () => {
    expect(leanFromVertical({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 })).toBeCloseTo(0)
    expect(leanFromVertical({ x: 0.8, y: 0.2 }, { x: 0.5, y: 0.5 })).toBeCloseTo(45)
  })
})

describe('pickSide', () => {
  it('reads the side whose leg the camera sees better', () => {
    const lm = poseFrom({ side: 'right', hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9] })
    expect(pickSide(lm)).toBe('right')
  })
})

describe('frameMetrics', () => {
  const standing = { hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9], shoulder: [0.5, 0.2], heel: [0.48, 0.92] }
  it('reads a straight leg as about 180° and an upright torso', () => {
    const m = frameMetrics(poseFrom(standing))
    expect(m.side).toBe('left')
    expect(m.knee).toBeCloseTo(180)
    expect(m.torsoLean).toBeCloseTo(0)
    expect(m.legLen).toBeCloseTo(0.4)
    expect(m.heelY).toBeCloseTo(0.92)
  })
  it('corrects for a wide picture: x is stretched by the aspect ratio before measuring', () => {
    // At aspect 2 this knee is a right angle; read raw it would not be.
    const lm = poseFrom({ hip: [0.4, 0.6], knee: [0.5, 0.6], ankle: [0.5, 0.8] })
    expect(frameMetrics(lm, 2).knee).toBeCloseTo(90)
  })
  it('is null when hip, knee or ankle is not visible enough', () => {
    expect(frameMetrics(poseFrom({ ...standing, knee: [0.5, 0.7, 0.3] }))).toBeNull()
    expect(frameMetrics(null)).toBeNull()
  })
  it('leaves torso lean and heel empty when those points are not visible', () => {
    const m = frameMetrics(poseFrom({ ...standing, shoulder: [0.5, 0.2, 0.1], heel: [0.5, 0.9, 0.1] }))
    expect(m.torsoLean).toBeNull()
    expect(m.heelY).toBeNull()
  })
})
```

Run: `npx vitest run src/lib/squat/angles.test.js` → Expected: FAIL (modül yok)

- [ ] **Step 3: `frontend/src/lib/squat/angles.js`**

```js
/* Squat geometry from MediaPipe's 33 pose landmarks (spec §4–5), side view. x and y arrive
 * normalised to the picture's width and height, so x is stretched by the aspect ratio before any
 * angle is measured. The side whose hip, knee and ankle the camera sees best is the one read. */
export const LM = Object.freeze({
  left: Object.freeze({ shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 }),
  right: Object.freeze({ shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 }),
})
export const MIN_VIS = 0.6

const vis = p => (p && typeof p.visibility === 'number' ? p.visibility : 0)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** Angle ABC at B, in degrees 0..180; null for a missing or coincident point. */
export function angleAt(a, b, c) {
  if (!a || !b || !c) return null
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y
  const nu = Math.hypot(ux, uy), nv = Math.hypot(vx, vy)
  if (nu === 0 || nv === 0) return null
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)))
  return Math.acos(cos) * 180 / Math.PI
}

/** How far the segment bottom→top leans from straight up, in degrees (image y grows downward). */
export function leanFromVertical(top, bottom) {
  return Math.atan2(Math.abs(top.x - bottom.x), bottom.y - top.y) * 180 / Math.PI
}

export function pickSide(lm) {
  const score = side => ['hip', 'knee', 'ankle'].reduce((s, k) => s + vis(lm[LM[side][k]]), 0)
  return score('right') > score('left') ? 'right' : 'left'
}

export function frameMetrics(lm, aspect = 1) {
  if (!Array.isArray(lm) || lm.length < 33) return null
  const side = pickSide(lm)
  const ix = LM[side]
  const at = k => {
    const p = lm[ix[k]]
    return p ? { x: p.x * aspect, y: p.y, v: vis(p) } : null
  }
  const hip = at('hip'), knee = at('knee'), ankle = at('ankle'), shoulder = at('shoulder'), heel = at('heel')
  if (!hip || !knee || !ankle || hip.v < MIN_VIS || knee.v < MIN_VIS || ankle.v < MIN_VIS) return null
  const kneeAngle = angleAt(hip, knee, ankle)
  if (kneeAngle == null) return null
  return {
    side,
    knee: kneeAngle,
    torsoLean: shoulder && shoulder.v >= MIN_VIS ? leanFromVertical(shoulder, hip) : null,
    hipY: hip.y,
    kneeY: knee.y,
    heelY: heel && heel.v >= MIN_VIS ? heel.y : null,
    legLen: dist(hip, knee) + dist(knee, ankle),
  }
}
```

Run: `npx vitest run src/lib/squat/angles.test.js` → Expected: 8 passed

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/squat/angles.js frontend/src/lib/squat/angles.test.js frontend/src/lib/squat/test-frames.js
git commit -m "camera reps: squat geometry from pose landmarks"
```

---

### Task 5: Form kuralları (`form-rules.js`)

**Files:**
- Create: `frontend/src/lib/squat/form-rules.js`, `frontend/src/lib/squat/form-rules.test.js`

**Interfaces:**
- Consumes: `Metrics` (Task 4) — tekrarın `bottom` alanı
- Produces: `FORM_DEFAULTS`, `FAULT_ORDER = ['shallow','lean','heel','lockout']`, `bottomFaults(rep, opts?) → ('shallow'|'lean'|'heel')[]`, `lockoutFault(top, opts?) → 'lockout'|null`, `summarize(faultsPerRep: string[][]) → { reps, shallow, lean, heel, lockout }`. `rep = { bottom: Metrics, heelRise: number }`, `top = { n, topKnee }`.

- [ ] **Step 1: Testler** — `frontend/src/lib/squat/form-rules.test.js`

```js
import { describe, it, expect } from 'vitest'
import { bottomFaults, lockoutFault, summarize, FORM_DEFAULTS } from './form-rules.js'
import { frame } from './test-frames.js'

const rep = (over = {}, heelRise = 0) => ({ bottom: frame(80, { hipY: 0.71, kneeY: 0.7, legLen: 0.4, torsoLean: 35, ...over }), heelRise })

describe('bottomFaults', () => {
  it('finds nothing in a deep, upright rep with heels down', () => {
    expect(bottomFaults(rep())).toEqual([])
  })
  it('calls a rep shallow when the hip stays above the knee by more than the tolerance', () => {
    expect(bottomFaults(rep({ hipY: 0.68 }))).toEqual(['shallow'])          // 0.02/0.4 = 5% above
    expect(bottomFaults(rep({ hipY: 0.695 }))).toEqual([])                  // 1.25%: within 3%
  })
  it('flags a forward lean past the limit, and heels that came up', () => {
    expect(bottomFaults(rep({ torsoLean: 60 }))).toEqual(['lean'])
    expect(bottomFaults(rep({}, 0.05))).toEqual(['heel'])
  })
  it('lists several faults most important first, and skips lean when the shoulder was not seen', () => {
    expect(bottomFaults(rep({ hipY: 0.6, torsoLean: 70 }, 0.1))).toEqual(['shallow', 'lean', 'heel'])
    expect(bottomFaults(rep({ torsoLean: null }))).toEqual([])
  })
  it('takes thresholds as options', () => {
    expect(bottomFaults(rep({ torsoLean: 60 }), { maxLean: 65 })).toEqual([])
  })
})

describe('lockoutFault', () => {
  it('flags a rep that stood up short of the lockout angle', () => {
    expect(lockoutFault({ n: 1, topKnee: 158 })).toBe('lockout')
    expect(lockoutFault({ n: 1, topKnee: FORM_DEFAULTS.lockoutAt })).toBeNull()
    expect(lockoutFault(null)).toBeNull()
  })
})

describe('summarize', () => {
  it('counts reps and, per fault, the reps that had it', () => {
    expect(summarize([[], ['shallow'], ['shallow', 'lockout'], ['lean']])).toEqual({ reps: 4, shallow: 2, lean: 1, heel: 0, lockout: 1 })
    expect(summarize([])).toEqual({ reps: 0, shallow: 0, lean: 0, heel: 0, lockout: 0 })
  })
})
```

Run: `npx vitest run src/lib/squat/form-rules.test.js` → Expected: FAIL

- [ ] **Step 2: `frontend/src/lib/squat/form-rules.js`**

```js
/* Form checks on one squat rep (spec §5). Image y grows downward, so the hip is above the knee
 * while hipY < kneeY; distances are measured against the leg's length so they hold at any camera
 * distance. Thresholds are starting points, tuned later against real videos.
 * Note: the spec's knee-angle fallback for an unseen hip never applies — frameMetrics needs the
 * hip to measure the knee at all, so a frame without it never reaches these checks. */
export const FORM_DEFAULTS = Object.freeze({ depthTol: 0.03, maxLean: 55, maxHeelRise: 0.04, lockoutAt: 165 })
export const FAULT_ORDER = Object.freeze(['shallow', 'lean', 'heel', 'lockout'])

export function bottomFaults(rep, options = {}) {
  const o = { ...FORM_DEFAULTS, ...options }
  const b = rep?.bottom
  if (!b) return []
  const out = []
  if (b.legLen > 0 && (b.kneeY - b.hipY) / b.legLen > o.depthTol) out.push('shallow')
  if (b.torsoLean != null && b.torsoLean > o.maxLean) out.push('lean')
  if ((rep.heelRise || 0) > o.maxHeelRise) out.push('heel')
  return out
}

export function lockoutFault(top, options = {}) {
  const o = { ...FORM_DEFAULTS, ...options }
  return top && top.topKnee < o.lockoutAt ? 'lockout' : null
}

export function summarize(faultsPerRep) {
  const s = { reps: faultsPerRep.length, shallow: 0, lean: 0, heel: 0, lockout: 0 }
  for (const faults of faultsPerRep) for (const f of new Set(faults)) if (f in s) s[f]++
  return s
}
```

Run: `npx vitest run src/lib/squat/form-rules.test.js` → Expected: 8 passed

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/squat/form-rules.js frontend/src/lib/squat/form-rules.test.js
git commit -m "camera reps: squat form checks"
```

---

### Task 6: Tekrar sayacı (`rep-counter.js`)

**Files:**
- Create: `frontend/src/lib/squat/rep-counter.js`, `frontend/src/lib/squat/rep-counter.test.js`

**Interfaces:**
- Consumes: `Metrics|null` (Task 4); test yardımcıları `frame`, `ramp`, `feed` (Task 4)
- Produces: `COUNTER_DEFAULTS`, `createRepCounter(opts?) → { push(m, tMs) → Event[], finish() → Event[], count, phase }`. `Event` = `{type:'ready'}` | `{type:'rep', n, bottom: Metrics, minKnee, heelRise}` | `{type:'top', n, topKnee}` | `{type:'lost'}` | `{type:'found'}`. `phase` ∈ `'setup'|'up'|'down'|'lost'`.

- [ ] **Step 1: Testler** — `frontend/src/lib/squat/rep-counter.test.js`

```js
import { describe, it, expect } from 'vitest'
import { createRepCounter } from './rep-counter.js'
import { feed, ramp, frame } from './test-frames.js'

const types = evs => evs.map(e => e.type)
const STAND = Array(70).fill(170)                              // 2.3 s standing
// One 1.2 s squat, then a quarter second standing — so the smoothed knee angle settles at the top
// before the next rep starts down and each rep's top reads as a full lockout.
const REP = [...ramp(170, 90, 600), ...ramp(90, 170, 600), ...Array(8).fill(170)]
const ready = () => { const c = createRepCounter(); const { t } = feed(c, STAND); return { c, t } }

describe('rep counter — getting ready', () => {
  it('says ready only after two seconds standing in full view', () => {
    const c = createRepCounter()
    expect(types(feed(c, Array(55).fill(170)).events)).toEqual([])
    expect(types(feed(c, Array(15).fill(170), { t0: 55 * 33 }).events)).toEqual(['ready'])
    expect(c.phase).toBe('up')
  })
  it('never gets ready while crouched, and starts the two seconds over after a gap', () => {
    const c = createRepCounter()
    expect(feed(c, Array(100).fill(120)).events).toEqual([])
    const r = feed(c, [...Array(40).fill(170), null, ...Array(40).fill(170)], { t0: 100 * 33 })
    expect(types(r.events)).toEqual([])                          // 40 frames ≈ 1.3 s on each side of the gap
    expect(c.phase).toBe('setup')
  })
})

describe('rep counter — counting', () => {
  it('counts one smooth squat once, with its deepest frame', () => {
    const { c, t } = ready()
    const { events } = feed(c, REP, { t0: t })
    const reps = events.filter(e => e.type === 'rep')
    expect(reps).toHaveLength(1)
    expect(reps[0].n).toBe(1)
    expect(reps[0].minKnee).toBeLessThan(100)
    expect(c.count).toBe(1)
  })
  it('does not count twice for a wobble at the bottom or near the top', () => {
    const { c, t } = ready()
    const wobbly = [...ramp(170, 92, 500), 105, 95, 108, 92, ...ramp(92, 147, 400), 140, 148, 145, ...ramp(145, 170, 200)]
    feed(c, wobbly, { t0: t })
    expect(c.count).toBe(1)
  })
  it('ignores a dip shorter than the minimum rep time', () => {
    const { c, t } = ready()
    feed(c, [...ramp(170, 90, 150), ...ramp(90, 170, 150)], { t0: t })
    expect(c.count).toBe(0)
  })
  it('numbers reps and reports how far each stood up when the next one starts', () => {
    const { c, t } = ready()
    const half = [...ramp(170, 90, 600), ...ramp(90, 156, 600), ...Array(10).fill(156)]   // stands to ~156°
    const { events, t: t2 } = feed(c, [...REP, ...half, ...REP], { t0: t })
    expect(events.filter(e => e.type === 'rep').map(e => e.n)).toEqual([1, 2, 3])
    const tops = events.filter(e => e.type === 'top')
    expect(tops.map(e => e.n)).toEqual([1, 2])
    expect(tops[0].topKnee).toBeGreaterThan(165)
    expect(tops[1].topKnee).toBeLessThan(160)
    expect(c.finish()).toEqual([expect.objectContaining({ type: 'top', n: 3 })])
    expect(c.finish()).toEqual([])
    expect(t2).toBeGreaterThan(t)
  })
  it('measures how far the heel lifted, against the leg length', () => {
    const { c, t } = ready()
    const down = ramp(170, 90, 600).map(k => frame(k, { heelY: 0.9 - (170 - k) / 80 * 0.024 }))   // heel up 0.024 at the bottom
    const up = ramp(90, 170, 600).map(k => frame(k))
    const rep = feed(c, [...down, ...up], { t0: t }).events.find(e => e.type === 'rep')
    expect(rep.heelRise).toBeCloseTo(0.024 / 0.4, 2)
  })
})

describe('rep counter — losing sight', () => {
  it('pauses after a second out of view and carries on with the same count', () => {
    const { c, t } = ready()
    const r1 = feed(c, REP, { t0: t })
    const r2 = feed(c, Array(40).fill(null), { t0: r1.t })
    expect(types(r2.events)).toEqual(['lost'])
    expect(c.phase).toBe('lost')
    const r3 = feed(c, [170, ...REP], { t0: r2.t })
    expect(types(r3.events)).toContain('found')
    expect(c.count).toBe(2)
  })
})
```

Run: `npx vitest run src/lib/squat/rep-counter.test.js` → Expected: FAIL

- [ ] **Step 2: `frontend/src/lib/squat/rep-counter.js`**

```js
/* Squat rep counter (spec §4): a state machine over the knee angle of the side facing the camera.
 * push(metrics, tMs) takes one frame — frameMetrics() output, or null when the body isn't seen —
 * and returns the events that frame caused:
 *   { type: 'ready' }                                standing in full view for readyMs: counting starts
 *   { type: 'rep', n, bottom, minKnee, heelRise }    a rep finished: the knee came back above upAt
 *   { type: 'top', n, topKnee }                      how far rep n stood up — sent when rep n+1 starts
 *                                                    down, or by finish()
 *   { type: 'lost' } / { type: 'found' }             key points gone for lostMs / back again
 * The gap between downAt and upAt (hysteresis) keeps a wobble at the bottom or the top from
 * counting twice; a dip shorter than minRepMs is noise. The knee angle is smoothed (EMA). */
export const COUNTER_DEFAULTS = Object.freeze({ downAt: 110, upAt: 150, minRepMs: 600, readyMs: 2000, lostMs: 1000, alpha: 0.5 })

export function createRepCounter(options = {}) {
  const o = { ...COUNTER_DEFAULTS, ...options }
  let phase = 'setup'
  let resume = 'up'
  let smooth = null
  let visibleSince = null
  let lastSeen = null
  let count = 0
  let heelRef = null        // heel height while standing: the reference for a heel lift
  let rep = null            // rep in progress: { startT, minKnee, bottom, heelRise }
  let leftTopT = null       // when the knee last dropped below upAt
  let top = null            // { n, topKnee }: the standing peak after rep n, still open

  const closeTop = events => {
    if (top) { events.push({ type: 'top', n: top.n, topKnee: top.topKnee }); top = null }
  }

  function push(m, t) {
    const events = []
    if (!m || m.knee == null) {
      if (phase === 'setup') visibleSince = null
      else if (phase !== 'lost' && lastSeen != null && t - lastSeen > o.lostMs) {
        resume = phase
        phase = 'lost'
        events.push({ type: 'lost' })
      }
      return events
    }
    lastSeen = t
    smooth = smooth == null ? m.knee : o.alpha * m.knee + (1 - o.alpha) * smooth
    if (phase === 'lost') { phase = resume; events.push({ type: 'found' }) }

    if (phase === 'setup') {
      if (smooth < o.upAt) { visibleSince = null; return events }
      if (visibleSince == null) visibleSince = t
      if (t - visibleSince >= o.readyMs) { phase = 'up'; events.push({ type: 'ready' }) }
      return events
    }

    if (phase === 'up') {
      if (smooth >= o.upAt) {
        leftTopT = null
        if (m.heelY != null) heelRef = heelRef == null ? m.heelY : 0.9 * heelRef + 0.1 * m.heelY
        if (top) top.topKnee = Math.max(top.topKnee, smooth)
      } else if (leftTopT == null) {
        leftTopT = t
      }
      if (smooth < o.downAt) {
        closeTop(events)
        phase = 'down'
        rep = { startT: leftTopT ?? t, minKnee: smooth, bottom: m, heelRise: 0 }
      }
      return events
    }

    // phase === 'down'
    if (smooth < rep.minKnee) { rep.minKnee = smooth; rep.bottom = m }
    if (heelRef != null && m.heelY != null && m.legLen > 0) {
      rep.heelRise = Math.max(rep.heelRise, (heelRef - m.heelY) / m.legLen)
    }
    if (smooth >= o.upAt) {
      phase = 'up'
      if (t - rep.startT >= o.minRepMs) {
        count++
        events.push({ type: 'rep', n: count, bottom: rep.bottom, minKnee: rep.minKnee, heelRise: rep.heelRise })
        top = { n: count, topKnee: smooth }
      }
      rep = null
      leftTopT = null
    }
    return events
  }

  function finish() {
    const events = []
    closeTop(events)
    return events
  }

  return {
    push,
    finish,
    get count() { return count },
    get phase() { return phase },
  }
}
```

- [ ] **Step 3: Yeşil olduğunu gör**

Run: `npx vitest run src/lib/squat/rep-counter.test.js` → Expected: 8 passed.
Bir test eşik/zamanlama yüzünden kırmızıysa önce testin girdisinin spec'teki davranışı doğru tarif ettiğini kontrol et (örn. EMA gecikmesi `ramp` süresine yetiyor mu); eşikleri gevşetme.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/squat/rep-counter.js frontend/src/lib/squat/rep-counter.test.js
git commit -m "camera reps: squat rep counter state machine"
```

---

### Task 7: Oturum (`session.js`) — sayaç + kurallar + ne söylenecek

**Files:**
- Create: `frontend/src/lib/squat/session.js`, `frontend/src/lib/squat/session.test.js`

**Interfaces:**
- Consumes: `createRepCounter` (Task 6), `bottomFaults`, `lockoutFault`, `summarize` (Task 5), `frameMetrics` (Task 4)
- Produces: `createSquatSession({ counter?, form?, metricsOf? }) → { push(landmarks, tMs, aspect?) → { say: Say[], count, phase }, finish() → { say: Say[], count, summary, faults: string[][] } }`. `Say` = `{kind:'ready'}` | `{kind:'lost'}` | `{kind:'count', n}` | `{kind:'cue', fault}`.

- [ ] **Step 1: Testler** — `frontend/src/lib/squat/session.test.js`

```js
import { describe, it, expect } from 'vitest'
import { createSquatSession } from './session.js'
import { ramp, frame } from './test-frames.js'

const session = () => createSquatSession({ metricsOf: m => m })   // tests feed metrics frames directly
const STAND = Array(70).fill(170)
const rep = (bottom = {}, topTo = 170) => [
  ...ramp(170, 91, 600).map(k => frame(k, k < 95 ? { hipY: 0.71, kneeY: 0.7, ...bottom } : {})),
  ...ramp(90, topTo, 600), ...Array(8).fill(topTo),
]

function run(frames) {
  const s = session()
  const out = []
  let t = 0
  for (const f of [...STAND, ...frames]) {
    out.push(...s.push(typeof f === 'number' ? frame(f) : f, t).say)
    t += 33
  }
  return { s, out }
}

describe('squat session', () => {
  it('says ready, then counts, with no cue for a clean rep', () => {
    const { out } = run(rep())
    expect(out).toEqual([{ kind: 'ready' }, { kind: 'count', n: 1 }])
  })
  it('follows the count with the most important cue of a faulty rep, only one', () => {
    const { out } = run(rep({ hipY: 0.6, torsoLean: 70 }))
    expect(out.slice(1)).toEqual([{ kind: 'count', n: 1 }, { kind: 'cue', fault: 'shallow' }])
  })
  it('says "stand all the way up" when the next rep starts, if that rep had no cue yet', () => {
    const { out } = run([...rep({}, 157), ...rep()])
    expect(out.slice(1)).toEqual([{ kind: 'count', n: 1 }, { kind: 'cue', fault: 'lockout' }, { kind: 'count', n: 2 }])
  })
  it('keeps to one cue for a rep that was shallow and also stood up short', () => {
    const { out } = run([...rep({ hipY: 0.6 }, 157), ...rep()])
    expect(out.filter(x => x.kind === 'cue')).toEqual([{ kind: 'cue', fault: 'shallow' }])
  })
  it('sums every fault of every rep at the finish, the unspoken ones too', () => {
    const { s } = run([...rep({ hipY: 0.6 }, 157), ...rep(), ...rep({ torsoLean: 70 })])
    const end = s.finish()
    expect(end.count).toBe(3)
    expect(end.summary).toEqual({ reps: 3, shallow: 1, lean: 1, heel: 0, lockout: 1 })
    expect(end.faults).toEqual([['shallow', 'lockout'], [], ['lean']])
  })
  it('says it lost sight of the body', () => {
    const { out } = run([...rep(), ...Array(40).fill(null)])
    expect(out.at(-1)).toEqual({ kind: 'lost' })
  })
})
```

Run: `npx vitest run src/lib/squat/session.test.js` → Expected: FAIL

- [ ] **Step 2: `frontend/src/lib/squat/session.js`**

```js
/* One camera set of squats: frames in, what to say and show out. Ties the counter to the form
 * checks and decides the voice (spec §2, §5): the count on every rep, then at most one cue per rep
 * — a bottom fault right away, or "stand all the way up" when the next rep starts, if that rep had
 * no cue yet. Pure: components/RepCamera.jsx does the camera, the drawing and the speaking. */
import { createRepCounter } from './rep-counter.js'
import { bottomFaults, lockoutFault, summarize } from './form-rules.js'
import { frameMetrics } from './angles.js'

export function createSquatSession({ counter = {}, form = {}, metricsOf = frameMetrics } = {}) {
  const c = createRepCounter(counter)
  const faults = []          // faults[n - 1]: every fault of rep n
  const cued = new Set()     // reps that already got their one spoken cue

  function handle(events, say) {
    for (const ev of events) {
      if (ev.type === 'ready') say.push({ kind: 'ready' })
      else if (ev.type === 'lost') say.push({ kind: 'lost' })
      else if (ev.type === 'rep') {
        const f = bottomFaults(ev, form)
        faults[ev.n - 1] = f
        say.push({ kind: 'count', n: ev.n })
        if (f.length) { say.push({ kind: 'cue', fault: f[0] }); cued.add(ev.n) }
      } else if (ev.type === 'top') {
        const l = lockoutFault(ev, form)
        if (!l) continue
        ;(faults[ev.n - 1] ||= []).push(l)
        if (!cued.has(ev.n)) { say.push({ kind: 'cue', fault: l }); cued.add(ev.n) }
      }
    }
  }

  return {
    push(landmarks, t, aspect = 1) {
      const say = []
      handle(c.push(metricsOf(landmarks, aspect), t), say)
      return { say, count: c.count, phase: c.phase }
    },
    finish() {
      const say = []
      handle(c.finish(), say)
      const perRep = Array.from({ length: c.count }, (_, i) => faults[i] || [])
      return { say, count: c.count, summary: summarize(perRep), faults: perRep }
    },
  }
}
```

Run: `npx vitest run src/lib/squat/session.test.js` → Expected: 6 passed

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/squat/session.js frontend/src/lib/squat/session.test.js
git commit -m "camera reps: session tying the counter to form cues"
```

---

### Task 8: Ses (`speech.js`)

**Files:**
- Create: `frontend/src/lib/speech.js`, `frontend/src/lib/speech.test.js`
- Modify: `frontend/package.json` (bağımlılık)

**Interfaces:**
- Produces: `speechLang(lang) → BCP-47`, `createSpeaker({ lang?, native?, synth?, Utterance?, loadTts?, fallback? }) → { say(text, { interrupt? }) → Promise<void>, stop() }`

- [ ] **Step 1: Eklentiyi kur** (Capacitor 7 uyumlu son sürüm 6.x)

Run: `npm install @capacitor-community/text-to-speech@^6.1.0`

- [ ] **Step 2: Testler** — `frontend/src/lib/speech.test.js`

```js
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
```

Run: `npx vitest run src/lib/speech.test.js` → Expected: FAIL

- [ ] **Step 3: `frontend/src/lib/speech.js`**

```js
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

  async function say(text, { interrupt = false } = {}) {
    if (broken) return fallback()
    try {
      if (native) {
        tts ||= await loadTts()
        if (interrupt) await tts.stop().catch(() => {})
        // queueStrategy 1 = Add: a cue waits for the count before it instead of cutting it off.
        await tts.speak({ text, lang: voice, rate: 1.1, queueStrategy: 1 })
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
```

Run: `npx vitest run src/lib/speech.test.js` → Expected: 6 passed

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/speech.js frontend/src/lib/speech.test.js
git commit -m "camera reps: voice for counts and cues (browser + Android plugin)"
```

---

### Task 9: Asıl ekran (`RepCamera.jsx`), sete yazma ve metinler

**Files:**
- Create: `frontend/src/components/RepCamera.jsx`, `frontend/src/components/repcam.css`, `frontend/src/components/RepCamera.test.jsx`, `frontend/src/lib/squat/log-reps.js`, `frontend/src/lib/squat/log-reps.test.js`, `frontend/scripts/locale-keys/camera-screen.json`
- Modify: `frontend/src/views/Workout.jsx` (PoseProbe → RepCamera, `logCameraReps`), `frontend/src/locales/*.js` (script)
- Delete: `frontend/src/components/PoseProbe.jsx`

**Interfaces:**
- Consumes: `openCamera`, `stopStream` (T1), `createPose` (T1), `drawPose` (T2), `createSquatSession` (T7), `createSpeaker` (T8), `t`, `getLang` (`lib/i18n.js`), `Button` (`components/ui.jsx`), `isWarmupRow` (`lib/workout-model.js`)
- Produces: `RepCamera({ onSave(count), onCancel, deps? })`; `summaryLines(summary) → string[]`; `pickSetToLog(sets) → number` (−1 = yeni set gerekli)

- [ ] **Step 1: Sete yazma kuralının testi** — `frontend/src/lib/squat/log-reps.test.js`

```js
import { describe, it, expect } from 'vitest'
import { pickSetToLog } from './log-reps.js'

describe('pickSetToLog', () => {
  it('takes the first working set not done yet, past warm-ups', () => {
    expect(pickSetToLog([{ phase: 'warmup' }, { done: true }, { done: false }, { done: false }])).toBe(2)
  })
  it('says a new set is needed when every working set is done', () => {
    expect(pickSetToLog([{ phase: 'warmup', done: false }, { done: true }])).toBe(-1)
    expect(pickSetToLog([])).toBe(-1)
  })
})
```

Run: `npx vitest run src/lib/squat/log-reps.test.js` → Expected: FAIL

- [ ] **Step 2: `frontend/src/lib/squat/log-reps.js`**

```js
/* Which row a camera-counted set goes into (spec §2.5): the first working set not done yet.
 * -1 means every working set is done, so the caller adds one — the count is never dropped. */
import { isWarmupRow } from '../workout-model.js'

export function pickSetToLog(sets = []) {
  return sets.findIndex(s => !isWarmupRow(s) && !s.done)
}
```

Run: `npx vitest run src/lib/squat/log-reps.test.js` → Expected: 2 passed

- [ ] **Step 3: Metinler** — `frontend/scripts/locale-keys/camera-screen.json`

```json
{
  "Put the phone beside you at hip height, with your whole body in the picture.": { "tr": "Telefonu yanına, kalça hizasına koy; baştan ayağa görünmen lazım." },
  "I can't see you": { "tr": "Görünmüyorsun" },
  "Save to set": { "tr": "Sete yaz" },
  "Switch camera": { "tr": "Kamerayı değiştir" },
  "This device is slow, so the count may be off.": { "tr": "Bu cihaz yavaş; sayım hatalı olabilir." },
  "Camera access was denied. Allow it in Settings and try again.": { "tr": "Kamera izni verilmedi. Ayarlar’dan izin verip tekrar dene." },
  "No camera available.": { "tr": "Kamera bulunamadı." },
  "The pose model couldn't be loaded.": { "tr": "Vücut takip modeli yüklenemedi." },
  "Deeper": { "tr": "Daha derin" },
  "Chest up": { "tr": "Göğsünü kaldır" },
  "Stay on your heels": { "tr": "Topuklarına bas" },
  "Stand all the way up": { "tr": "Tam kalk" },
  "{0} reps": { "tr": "{0} tekrar" },
  "Not deep enough: {0}": { "tr": "Derinlik yetersiz: {0}" },
  "Leaning forward: {0}": { "tr": "Öne eğilme: {0}" },
  "Heels came up: {0}": { "tr": "Topuk kalktı: {0}" },
  "Not standing all the way up: {0}": { "tr": "Tam kalkmadı: {0}" }
}
```

("Ready", "Finish", "Discard" dil dosyalarında zaten var: Hazır / Bitir / Vazgeç.)

Run: `node scripts/add-locale-keys.mjs scripts/locale-keys/camera-screen.json && node scripts/check-locales.mjs`
Expected: `tr.js +17` (ve diğerleri), `… in sync.`

- [ ] **Step 4: Ekran testleri** — `frontend/src/components/RepCamera.test.jsx`

Projenin bileşen testleri Testing Library kullanmıyor; `createRoot` + `act` + happy-dom
(örnek: `src/components/BackupFolderRow.test.jsx`). Aynı stil:

```jsx
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
```

Run: `npx vitest run src/components/RepCamera.test.jsx` → Expected: FAIL (bileşen yok)

- [ ] **Step 5: `frontend/src/components/repcam.css`**

```css
.repcam { position: fixed; inset: 0; z-index: 1000; background: #000; color: #fff; display: flex; flex-direction: column; }
.repcam video, .repcam canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.repcam video.mirror, .repcam canvas.mirror { transform: scaleX(-1); }
.repcam-top { position: relative; padding: calc(env(safe-area-inset-top) + 16px) 16px 0; display: grid; gap: 8px; }
.repcam-hint, .repcam-warn { background: rgba(0, 0, 0, .6); border-radius: 12px; padding: 10px 14px; font-size: 17px; }
.repcam-warn { color: var(--yellow); }
.repcam-count { position: relative; margin: auto; font-size: 140px; font-weight: 800; line-height: 1; text-shadow: 0 2px 12px rgba(0, 0, 0, .7); }
.repcam-actions { position: relative; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; padding: 16px 16px calc(env(safe-area-inset-bottom) + 24px); }
.repcam-finish { min-width: 60%; font-size: 22px; padding: 18px; }
.repcam-summary { position: relative; margin-top: auto; background: var(--bg-2, #1c1c1e); border-radius: 20px 20px 0 0; padding: 24px 16px 0; display: grid; gap: 6px; text-align: center; }
.repcam-sum-head { font-size: 34px; font-weight: 800; }
```

(İskelet ön kamerada `drawPose(..., { mirror })` ile değil CSS ile aynalanır, böylece video ve çizim birlikte döner: `drawPose` `mirror: false` çağrılır, canvas'a da `mirror` sınıfı verilir.)

- [ ] **Step 6: `frontend/src/components/RepCamera.jsx`**

```jsx
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
        if (stopped) return
        const loop = () => {
          if (stopped) return
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
          <Button className="repcam-finish" onClick={finish}>{t('Finish')}</Button>
          <Button variant="tinted" icon="swap" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}>{t('Switch camera')}</Button>
          <Button variant="ghost" onClick={onCancel}>{t('Discard')}</Button>
        </div>
      </> : (
        <div className="repcam-summary">
          {summaryLines(summary).map((line, i) => <div key={i} className={i ? 'small' : 'repcam-sum-head'}>{line}</div>)}
          <div className="repcam-actions">
            <Button className="repcam-finish" disabled={!count} onClick={() => onSave(count)}>{t('Save to set')}</Button>
            <Button variant="ghost" onClick={onCancel}>{t('Discard')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

Run: `npx vitest run src/components/RepCamera.test.jsx` → Expected: 6 passed

- [ ] **Step 7: Workout.jsx'te PoseProbe → RepCamera ve sete yazma**

1. `const PoseProbe = lazy(() => import('../components/PoseProbe.jsx'))` satırını şununla değiştir:
```js
const RepCamera = lazy(() => import('../components/RepCamera.jsx'))
```
ve import'lara ekle: `import { pickSetToLog } from '../lib/squat/log-reps.js'`
2. `openCameraCount` tanımını şununla değiştir:
```js
  // Camera rep counter (docs/superpowers/specs/2026-10-07-squat-camera-design.md). Save writes the
  // count into the first working set not done yet — adding a set when all are done — and ticks it,
  // so the rest timer and the progression read it exactly like a hand-logged set.
  const logCameraReps = (idx, reps) => {
    let i = pickSetToLog(useStore.getState().S.active?.entries[idx]?.sets)
    if (i < 0) {
      addSet(idx)
      i = useStore.getState().S.active.entries[idx].sets.length - 1
    }
    setField(idx, i, 'r', reps)
    toggle(idx, i)
  }
  const openCameraCount = idx => {
    const sheet = useUI.getState().openSheet(close => (
      <Suspense fallback={null}>
        <RepCamera onCancel={close} onSave={reps => { close(); logCameraReps(idx, reps) }} />
      </Suspense>
    ), { locked: true })
    return sheet
  }
```
3. `git rm frontend/src/components/PoseProbe.jsx`

- [ ] **Step 8: Bütün testler ve kontroller**

Run: `npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL"`
Expected: yalnızca `scripts/check-mobile-bundle.test.mjs` içindeki bilinen 4 Windows hatası.
Run: `node scripts/check-locales.mjs && node scripts/check-source-strings.mjs && npm run build`
Expected: üçü de temiz.

- [ ] **Step 9: Elle kontrol (bilgisayar)**

`npm run dev` → squat içeren antrenman → "⋯" → **Kamerayla say**. Webcam'in karşısında, yandan, baştan ayağa görünür halde dur: 2 sn sonra "Hazır" sesi; 3 squat → "bir, iki, üç"; bir sığ tekrar → "Daha derin". **Bitir** → özet; **Sete yaz** → setin tekrar alanında sayı, set tamamlandı, dinlenme sayacı başladı. Tüm setler bitmişken tekrar dene → yeni set eklenip ona yazılmalı.

- [ ] **Step 10: Commit ve push (APK derlenir)**

```bash
git add -A frontend/src/components/RepCamera.jsx frontend/src/components/repcam.css frontend/src/components/RepCamera.test.jsx frontend/src/lib/squat/log-reps.js frontend/src/lib/squat/log-reps.test.js frontend/scripts/locale-keys/camera-screen.json frontend/src/views/Workout.jsx frontend/src/locales frontend/src/components/PoseProbe.jsx
git commit -m "camera reps: the counting screen, writing the count into the set"
git push origin kisisel
```

---

### Task 10: Videodan nokta çıkarma sayfası ve gerçek veri testi

**Files:**
- Create: `frontend/src/views/PoseExtract.jsx`, `frontend/src/lib/squat/fixtures/README.md`, `frontend/src/lib/squat/fixtures.test.js`
- Modify: `frontend/src/App.jsx` (yalnız DEV rotası)

**Interfaces:**
- Consumes: `createPose` (T1), `createSquatSession` (T7)
- Produces: fixture biçimi `{ "aspect": number, "frames": [{ "t": ms, "lm": [[x,y,visibility] × 33] | null }], "expected": { "reps": number, "faults": { "<n>": ["shallow"|"lean"|"heel"|"lockout", …] } } }`

- [ ] **Step 1: Fixture testi** — `frontend/src/lib/squat/fixtures.test.js`

```js
import { describe, it, expect } from 'vitest'
import { createSquatSession } from './session.js'

// Real sets, recorded by the user and reduced to landmark numbers on /#/dev/pose-extract (no video
// is ever stored). Each file carries what really happened: the rep count and the faulty reps.
const files = import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' })
const toLandmarks = lm => lm && lm.map(([x, y, visibility]) => ({ x, y, z: 0, visibility }))

describe.skipIf(Object.keys(files).length === 0)('squat fixtures', () => {
  for (const [name, fx] of Object.entries(files)) {
    it(`${name}: counts ${fx.expected.reps} reps and flags the faulty ones`, () => {
      const s = createSquatSession()
      for (const f of fx.frames) s.push(toLandmarks(f.lm), f.t, fx.aspect)
      const end = s.finish()
      expect(end.count).toBe(fx.expected.reps)
      const flagged = Object.fromEntries(end.faults.map((f, i) => [String(i + 1), f]).filter(([, f]) => f.length))
      expect(flagged).toEqual(fx.expected.faults)
    })
  }
})
```

Run: `npx vitest run src/lib/squat/fixtures.test.js` → Expected: suite skipped (henüz fixture yok)

- [ ] **Step 2: `frontend/src/views/PoseExtract.jsx`**

```jsx
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
```

- [ ] **Step 3: App.jsx'e yalnız geliştirmede rota**

Satır 1'deki `react` import'una `lazy, Suspense` ekle:
```js
import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
```
İmport'ların altına:
```js
// Development only: turns a squat video into a landmark fixture (lib/squat/fixtures.test.js).
const PoseExtract = import.meta.env.DEV ? lazy(() => import('./views/PoseExtract.jsx')) : null
```
`<Route path="/settings" …/>` satırından sonra:
```jsx
              {PoseExtract && <Route path="/dev/pose-extract" element={<Suspense fallback={null}><PoseExtract /></Suspense>} />}
```

Run: `npm run build && grep -l "Pose extract" dist/assets/*.js || echo "production'da yok — doğru"`
Expected: `production'da yok — doğru`

- [ ] **Step 4: `frontend/src/lib/squat/fixtures/README.md`**

```markdown
# Squat fixtures

Landmark recordings of real squat sets for `../fixtures.test.js`. No video belongs here.

1. Film a set from the side, phone at hip height, whole body in the picture.
2. `npm run dev`, open `/#/dev/pose-extract`, pick the video; a `.json` downloads.
3. In that file set `expected.reps` and, per faulty rep number, its faults:
   `"expected": { "reps": 8, "faults": { "3": ["shallow"], "7": ["lean"] } }`
4. Save it here and run `npx vitest run src/lib/squat/fixtures.test.js`.
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/PoseExtract.jsx frontend/src/lib/squat/fixtures.test.js frontend/src/lib/squat/fixtures/README.md frontend/src/App.jsx
git commit -m "camera reps: dev page turning a squat video into a landmark fixture"
```

---

### Task 11: Kalibrasyon ve salon testi (kullanıcıyla)

**Files:**
- Create: `frontend/src/lib/squat/fixtures/*.json` (kullanıcının setleri)
- Modify (gerekirse): `frontend/src/lib/squat/form-rules.js` `FORM_DEFAULTS`, `frontend/src/lib/squat/rep-counter.js` `COUNTER_DEFAULTS`

- [ ] **Step 1:** Kullanıcı 4–5 set çeker: en az bir temiz set, bir sığ tekrar içeren set, bir öne eğilen set. Videolar kullanıcının bilgisayarında kalır.
- [ ] **Step 2:** Her video için Task 10 Step 4'ü uygula; `expected` alanlarını **kullanıcının kendi değerlendirmesiyle** doldur.
- [ ] **Step 3:** Run: `npx vitest run src/lib/squat/fixtures.test.js`. Kırmızıysa hangi eşiğin (derinlik, gövde, topuk, tam kalkma, sayım) yanlış karar verdiğini çıktıdan bul. Eşiği **yalnızca** `FORM_DEFAULTS` / `COUNTER_DEFAULTS` içinde değiştir; değişikliğin sentetik testleri (Task 5–7) bozmadığını doğrula: `npx vitest run src/lib/squat`.
- [ ] **Step 4:** Başarı ölçütü (spec §9): fixture setlerinin ≥ %95'inde tekrar sayısı birebir doğru, uyarılar kullanıcının işaretledikleriyle örtüşüyor.
- [ ] **Step 5:** Commit + push → yeni APK → kullanıcı salonda dener, sonucu bildirir.

```bash
git add frontend/src/lib/squat
git commit -m "camera reps: thresholds tuned on real squat sets"
git push origin kisisel
```
