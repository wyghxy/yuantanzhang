/** Timecodes remain in the saved source format, outside the editable projection. */
export type ManuscriptTime = { offset: number; label: string; token: string }

/** Decorate a complete, unchanged source copy with verified paragraph times only. */
export function sourceManuscriptTimeline(body: string, source: { text: string; paragraphs: { text: string; startMs: number }[] } | undefined) {
  if (!source || body !== source.text || manuscriptProjection(body).anchors.length) return body
  const insertions: { offset: number; time: number }[] = []
  let cursor = 0
  for (const paragraph of source.paragraphs) {
    if (!paragraph.text || !Number.isFinite(paragraph.startMs) || paragraph.startMs < 0) continue
    const offset = body.indexOf(paragraph.text, cursor)
    if (offset < 0) continue
    insertions.push({ offset, time: paragraph.startMs }); cursor = offset + paragraph.text.length
  }
  let result = body
  for (const { offset, time } of insertions.reverse()) {
    const label = `${Math.floor(time / 60000).toString().padStart(2, '0')}:${Math.floor(time / 1000 % 60).toString().padStart(2, '0')}`
    result = result.slice(0, offset) + (offset && body[offset - 1] !== '\n' ? '\n' : '') + '[' + label + '] ' + result.slice(offset)
  }
  return result
}
export function manuscriptProjection(body: string) {
  const anchors: ManuscriptTime[] = []
  let removed = 0
  const text = body.replace(/\r\n?/g, '\n').replace(/^(\[(?:\d{1,2}:)?\d{2,3}:[0-5]\d(?:[.,]\d{1,3})?\])[ \t]*/gm,
    (token: string, label: string, offset: number) => {
      anchors.push({ offset: offset - removed, label: label.slice(1, -1), token })
      removed += token.length
      return ''
    })
  return { text, anchors }
}

/** Move existing paragraph anchors with a text edit; never invent times for new paragraphs. */
export function editManuscript(body: string, next: string) {
  const previous = manuscriptProjection(body)
  if (previous.text === next) return body
  if (!previous.anchors.length || !next.trim()) return next
  let start = 0, oldEnd = previous.text.length, newEnd = next.length
  while (start < oldEnd && start < newEnd && previous.text[start] === next[start]) start++
  while (oldEnd > start && newEnd > start && previous.text[oldEnd - 1] === next[newEnd - 1]) { oldEnd--; newEnd-- }
  const delta = newEnd - oldEnd, retained = new Map<number, ManuscriptTime>()
  for (const anchor of previous.anchors) {
    // The first anchor of the edited paragraph survives. Replaced paragraphs do not.
    if (anchor.offset > start && anchor.offset < oldEnd) continue
    let offset = anchor.offset >= oldEnd && anchor.offset > start ? anchor.offset + delta : anchor.offset
    // At a paragraph boundary, inserted lines precede the original timed paragraph.
    if (anchor.offset === start && oldEnd === start && next.slice(start, newEnd).includes('\n')) offset += delta
    offset = offset > 0 ? next.lastIndexOf('\n', offset - 1) + 1 : 0
    const existing = retained.get(offset)
    if (!existing || (anchor.offset >= oldEnd && existing.offset >= start)) retained.set(offset, anchor)
  }
  let result = next
  for (const [offset, anchor] of [...retained].sort((a, b) => b[0] - a[0])) result = result.slice(0, offset) + anchor.token + result.slice(offset)
  return result
}
