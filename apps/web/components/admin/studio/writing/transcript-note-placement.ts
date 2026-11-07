/** Reserve the source's checkbox column even when the floating panel must shift
 * at a narrow viewport edge. Coordinates are CSS pixels, never device pixels. */
export function checkboxNotePlacement(root: { left: number; right: number }, target: { right: number },
  viewport: { width: number; height: number }) {
  const left = Math.max(12, root.left, target.right + 10)
  const right = Math.min(root.right, viewport.width - 12)
  if (right <= left) return null
  return { width: Math.min(360, right - left),
    boundary: { x: left, y: 12, width: right - left, height: Math.max(1, viewport.height - 24) } }
}
