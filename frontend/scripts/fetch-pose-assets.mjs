#!/usr/bin/env node
/* Puts what the camera rep counter needs into public/mediapipe/ (gitignored): MediaPipe's WASM
 * runtime, copied from node_modules, and the pose model, downloaded once. Both ship inside the
 * web build and the APK, so counting works offline. Run by predev, prebuild and build:mobile. */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'mediapipe')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const model = join(out, 'pose_landmarker_lite.task')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
// The model a build ships is pinned: a changed or damaged download stops the build instead of
// shipping something the thresholds were never tuned on. A local copy that differs is fetched again.
const MODEL_SHA256 = '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'
const sha256 = buf => createHash('sha256').update(buf).digest('hex')

if (!existsSync(wasmSrc)) {
  console.error('fetch-pose-assets: @mediapipe/tasks-vision is not installed — run npm install')
  process.exit(1)
}
mkdirSync(out, { recursive: true })
cpSync(wasmSrc, join(out, 'wasm'), { recursive: true })
if (!existsSync(model) || sha256(readFileSync(model)) !== MODEL_SHA256) {
  const res = await fetch(MODEL_URL)
  if (!res.ok) { console.error(`fetch-pose-assets: model download failed (${res.status})`); process.exit(1) }
  const buf = Buffer.from(await res.arrayBuffer())
  const got = sha256(buf)
  if (got !== MODEL_SHA256) { console.error(`fetch-pose-assets: model checksum ${got} is not the pinned ${MODEL_SHA256}`); process.exit(1) }
  writeFileSync(model, buf)
}
console.log('fetch-pose-assets: ok')
