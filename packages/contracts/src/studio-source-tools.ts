import { playbackTranscript } from './studio-playback'

export type StudioSourceOperation = 'opening' | 'visual-plan'
export const studioSourcePromptVersion = 'source-tools-20260928-v3'

/** Only original content affects source analysis; notes and counters do not. */
export function studioSourceBody(value: Record<string, unknown>): string {
  const transcript = sourceObject(value.transcript)
  if (typeof transcript.corrected === 'string') return transcript.corrected.trim()
  if (typeof value.correctedTranscript === 'string') return value.correctedTranscript.trim()
  for (const key of ['raw']) {
    if (typeof transcript[key] === 'string' && transcript[key].trim()) return transcript[key].trim()
  }
  for (const key of ['rawTranscript', 'transcript', 'body']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim()
  }
  return ''
}

export function studioSourceOperation(value: unknown): StudioSourceOperation | null {
  return value === 'opening' || value === 'visual-plan' ? value : null
}

export const sourceObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function sourceOpeningEvidence(material: Record<string, unknown>) {
  const transcript = sourceObject(material.transcript)
  const timed = playbackTranscript(material.recognition ?? transcript.recognition)
  const corrected = typeof transcript.corrected === 'string' ? transcript.corrected.trim() : ''
  const raw = typeof transcript.raw === 'string' ? transcript.raw.trim() : ''
  const correctedChanged = !!corrected && !!raw && corrected !== raw
  const original = raw || (typeof material.rawTranscript === 'string' ? material.rawTranscript : '') ||
    (typeof material.transcript === 'string' ? material.transcript : '') || (!corrected ? studioSourceBody(material) : '')
  // Imported raw transcripts include display-only timestamps at the start of each line.
  // Keep exact spoken text comparison; timing still comes only from recognition evidence.
  const normalize = (value: string) => value
    .replace(/^[\t ]*\[\d{1,2}:\d{2}(?::\d{2})?\][\t ]*/gmu, '')
    .replace(/\s/gu, '')
  const timingMismatch = timed.precision !== 'none' && (!original || normalize(original) !== normalize(timed.text))
  const coveredUntilMs = timed.paragraphs.reduce((end, line) => Math.max(end, line.endMs), 0)
  return [2, 5].map(seconds => {
    let overlaps = false
    const lines = timed.paragraphs.filter(line => line.startMs < seconds * 1000)
    const quote = (timingMismatch ? [] : lines).map(line => {
      if (!line.tokens.length) {
        overlaps ||= line.endMs > seconds * 1000
        return line.text
      }
      const tokens = line.tokens.filter(token => token.startMs < seconds * 1000)
      overlaps ||= tokens.some(token => token.endMs > seconds * 1000)
      return tokens.map(token => token.text).join('')
    }).join('\n')
    const insufficientCoverage = coveredUntilMs < seconds * 1000
    const limitations = ['只依据转写时间，不包含画面、语气或真实留存数据。']
    if (timingMismatch) limitations.push('时间证据与原始正文不一致，不能将这些时间用于当前作品的开场。')
    else if (timed.precision === 'none') limitations.push('没有有效时间戳，不能断言前几秒的内容。')
    else if (insufficientCoverage) limitations.push(`已知转写仅覆盖到 ${(coveredUntilMs / 1000).toFixed(2)} 秒，不能推断其后内容。`)
    if (!timingMismatch && timed.precision !== 'none') limitations.push(timed.precision === 'word' ? '依据原始逐词转写时间。' : '依据原始句级转写时间。')
    if (timed.untimedText?.length) limitations.push('部分正文缺少有效时间，不能确认该时段文字完整。')
    if (overlaps) limitations.push('仅有跨越边界的完整词句，不是精确截取。')
    if (correctedChanged) limitations.push('时间证据引用原始转写，校正正文尚未重新对齐时间；不代表校正后的精确片段。')
    return { seconds, quote, precision: timingMismatch ? 'none' as const : timed.precision, timingMismatch, overlaps, correctedChanged, coveredUntilMs, insufficientCoverage,
      incomplete: !!timed.untimedText?.length, limitation: limitations.join(' ') }
  })
}
