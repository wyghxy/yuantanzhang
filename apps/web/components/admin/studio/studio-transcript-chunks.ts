/** Bound layout work even when an ASR provider returns a megabyte without line breaks. */
export function transcriptChunks(text: string, maximum = 4000): string[] {
  if (!Number.isInteger(maximum) || maximum < 8) throw new RangeError('maximum must be an integer >= 8')
  const chunks: string[] = []
  let start = 0
  while (text.length - start > maximum) {
    let end = start + maximum
    const window = text.slice(start + Math.floor(maximum * .7), end)
    const boundaries = [...window.matchAll(/[。！？；.!?;\s]/gu)]
    if (boundaries.length) end = start + Math.floor(maximum * .7) + boundaries[boundaries.length - 1].index! + 1
    // Never cut a UTF-16 surrogate pair in half.
    if (/^[\uDC00-\uDFFF]$/.test(text[end]) && /^[\uD800-\uDBFF]$/.test(text[end - 1])) end--
    chunks.push(text.slice(start, end)); start = end
  }
  if (start < text.length) chunks.push(text.slice(start))
  return chunks
}
