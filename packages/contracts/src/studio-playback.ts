/** Provider times are milliseconds. Never infer word times from sentence length. */
export type PlaybackToken = { text: string; startMs: number; endMs: number }
export type PlaybackParagraph = PlaybackToken & { id: string; tokens: PlaybackToken[] }
export type PlaybackTranscript = {
  precision: 'word' | 'sentence' | 'none'
  paragraphs: PlaybackParagraph[]
  text: string
  untimedText?: string[]
}
export type PreparationTask = { id: string; status: string; phase: string; error: string | null }
export type SourcePlaybackFormat = { version: 1; mime: string; sourceSha256: string; videoWidth?: number; videoHeight?: number }
export type PlaybackFailureReport = {
  version: 1; fingerprint: string; sourceSha256: string; mime: string
  transportStatus: 200 | 206; mimeUnsupported: true
} & ({ errorCode: 3 | 4; videoTrackMissing?: never } | {
  errorCode: null; videoTrackMissing: true; readyState: 2 | 3 | 4; videoWidth: 0; videoHeight: 0
})
/** A network error, autoplay denial or stalled video is not evidence for conversion. */
export function playbackFailureReport(format: SourcePlaybackFormat | undefined, fingerprint: string,
  errorCode: number | undefined, transportStatus: number, canPlayType: string,
  video?: { readyState: number; videoWidth: number; videoHeight: number }): PlaybackFailureReport | null {
  if (!format || format.version !== 1 || !/^[a-f0-9]{64}$/.test(format.sourceSha256) ||
      !fingerprint ||
      (transportStatus !== 200 && transportStatus !== 206) || canPlayType !== '') return null
  const base = { version: 1 as const, fingerprint, sourceSha256: format.sourceSha256, mime: format.mime,
    transportStatus: transportStatus as 200 | 206, mimeUnsupported: true as const }
  if (errorCode === 3 || errorCode === 4) return { ...base, errorCode }
  // Some browsers silently discard an unsupported video track and play audio.
  // Ready media with no decoded video, backed by a verified source video track,
  // is distinct from loading, stalling, permissions and transport failures.
  if (errorCode === undefined && Number.isSafeInteger(format.videoWidth) && Number(format.videoWidth) > 0 &&
    Number.isSafeInteger(format.videoHeight) && Number(format.videoHeight) > 0 && video &&
    [2, 3, 4].includes(video.readyState) && video.videoWidth === 0 && video.videoHeight === 0)
    return { ...base, errorCode: null, videoTrackMissing: true, readyState: video.readyState as 2 | 3 | 4,
      videoWidth: 0, videoHeight: 0 }
  return null
}
export type MaterialPreparation = {
  sourceId: string
  fingerprint: string
  state: 'ready' | 'idle' | 'loading' | 'failed' | 'unavailable'
  message: string
  task: PreparationTask | null
  dependency: boolean
  transcript?: PlaybackTranscript
  mediaUrl?: string
  sourceFormat?: SourcePlaybackFormat
  recognition?: { status: 'succeeded' | 'no_speech'; source: 'original_audio_asr' }
  recovery?: { retry: boolean; code: string; label: string; hint: string }
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const time = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const punctuation = (text: string) => !/[\p{L}\p{N}]/u.test(text)

export function playbackTranscript(recognition: unknown): PlaybackTranscript {
  const saved = object(recognition), raw = object(saved.raw)
  const utterances = object(raw.result).utterances
  const items = Array.isArray(utterances) ? utterances : Array.isArray(saved.segments) ? saved.segments : []
  const paragraphs: PlaybackParagraph[] = []
  const untimedText: string[] = [], fullText: string[] = []
  let allWords = true, priorStart = -1
  for (const item of items.slice(0, 30000)) {
    const u = object(item), startMs = time(u.start_time ?? u.startMs), endMs = time(u.end_time ?? u.endMs)
    if (typeof u.text !== 'string' || !u.text.trim()) continue
    fullText.push(u.text)
    if (startMs === null || endMs === null || endMs <= startMs || startMs < priorStart) { untimedText.push(u.text); allWords = false; continue }
    priorStart = startMs
    const tokens: PlaybackToken[] = []
    let cursor = 0, lastTime = startMs, valid = Array.isArray(u.words) && u.words.length > 0
    for (const entry of Array.isArray(u.words) ? u.words : []) {
      const word = object(entry), text = word.text ?? word.word
      const start = time(word.start_time), end = time(word.end_time)
      // Providers may include untimed spaces or punctuation; reconcile them from the sentence below.
      if (typeof text === 'string' && text && punctuation(text) && (start === null || end === null || end <= start)) continue
      if (typeof text !== 'string' || !text || start === null || end === null || start < lastTime || end <= start || start < startMs || end > endMs) { valid = false; break }
      const at = u.text.indexOf(text, cursor)
      if (at < cursor || !punctuation(u.text.slice(cursor, at))) { valid = false; break }
      if (at > cursor) {
        const gap = u.text.slice(cursor, at)
        if (tokens.length) tokens[tokens.length - 1].text += gap
        else tokens.push({ text: gap, startMs: start, endMs: end })
      }
      tokens.push({ text, startMs: start, endMs: end })
      cursor = at + text.length
      lastTime = start
    }
    if (!punctuation(u.text.slice(cursor))) valid = false
    if (valid && tokens.length) tokens[tokens.length - 1].text += u.text.slice(cursor)
    else { tokens.length = 0; allWords = false }
    paragraphs.push({ id: String(paragraphs.length + 1), text: u.text, startMs, endMs, tokens })
  }
  return { precision: !paragraphs.length ? 'none' : allWords ? 'word' : 'sentence', paragraphs, text: fullText.join('\n'), ...(untimedText.length ? { untimedText } : {}) }
}

/** Binary search avoids scanning a long transcript every playback frame. Gaps have no active text. */
export function activePlaybackIndex(items: PlaybackToken[], atMs: number) {
  let low = 0, high = items.length - 1, found = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (items[mid].startMs <= atMs) { found = mid; low = mid + 1 } else high = mid - 1
  }
  return found >= 0 && atMs < items[found].endMs ? found : -1
}
