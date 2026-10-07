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
