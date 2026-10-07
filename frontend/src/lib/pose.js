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
