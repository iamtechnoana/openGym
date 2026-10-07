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
