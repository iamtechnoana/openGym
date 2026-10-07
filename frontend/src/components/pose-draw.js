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
