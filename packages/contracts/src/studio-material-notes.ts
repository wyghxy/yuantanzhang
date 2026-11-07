import { playbackTranscript } from './studio-playback'
import { validMaterialNoteDocument, type MaterialNoteDocument } from './studio-note-document'
/** Reading annotations are independent of the source transcript and its timing. */
export type MaterialNoteAnchor = { blockId: string; blockText: string; start: number; end: number; quote: string; time?: string }
export type MaterialNoteAnnotation = { id: string; materialId: string; sourceMaterialId: string; sourceVersion: number; createdAt: string; anchors: MaterialNoteAnchor[]; thought: string; thoughtDocument?: MaterialNoteDocument }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const bounded = (value: unknown, max: number) => typeof value === 'string' && value.length <= max

/** Bound the complete document, not just each field; no HTML or inferred time is interpreted. */
export function validMaterialAnnotations(value: unknown, materialId?: string): value is MaterialNoteAnnotation[] {
  if (!Array.isArray(value) || value.length > 100) return false
  try { if (JSON.stringify(value).length > 240000) return false } catch { return false }
  const ids = new Set<string>()
  return value.every(entry => {
    const note = record(entry)
    if (typeof note.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(note.id) || ids.has(note.id)) return false
    ids.add(note.id)
    if (typeof note.materialId !== 'string' || !note.materialId || note.materialId.length > 200 || materialId !== undefined && note.materialId !== materialId) return false
    if (typeof note.sourceMaterialId !== 'string' || !note.sourceMaterialId || note.sourceMaterialId.length > 200) return false
    if (!Number.isSafeInteger(note.sourceVersion) || Number(note.sourceVersion) < 1 || typeof note.createdAt !== 'string' || note.createdAt.length > 32 || !Number.isFinite(Date.parse(note.createdAt))) return false
    if (!bounded(note.thought, 12000) || !Array.isArray(note.anchors) || !note.anchors.length || note.anchors.length > 32) return false
    if (note.thoughtDocument !== undefined && !validMaterialNoteDocument(note.thoughtDocument, String(note.thought))) return false
    return note.anchors.every(value => {
      const anchor = record(value)
      return typeof anchor.blockId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(anchor.blockId)
        && typeof anchor.blockText === 'string' && anchor.blockText.length > 0 && anchor.blockText.length <= 30000
        && Number.isSafeInteger(anchor.start) && Number.isSafeInteger(anchor.end) && Number(anchor.start) >= 0
        && Number(anchor.end) > Number(anchor.start) && Number(anchor.end) <= anchor.blockText.length
        && typeof anchor.quote === 'string' && !!anchor.quote.trim() && anchor.quote === anchor.blockText.slice(Number(anchor.start), Number(anchor.end))
        && (anchor.time === undefined || typeof anchor.time === 'string' && /^\d{2,4}:\d{2}$/.test(anchor.time))
    })
  })
}
export type ArticleBlock = { kind: 'paragraph' | 'heading' | 'list' | 'quote'; text: string; level?: number }
/** Only explicit structure is interpreted; shared by readers and source validation. */
export function articleBlocks(body: string): ArticleBlock[] {
  return body.replace(/\r\n?/g, '\n').split(/\n+/).flatMap(line => {
    const value = line.trim()
    if (!value) return []
    const heading = /^(#{1,6})\s+(.+)$/.exec(value)
    if (heading) return [{ kind: 'heading', level: heading[1].length, text: heading[2] } as ArticleBlock]
    if (/^(?:[-*+] |\d+[.)] )(.+)$/.test(value)) return [{ kind: 'list', text: value } as ArticleBlock]
    if (value.startsWith('> ')) return [{ kind: 'quote', text: value.slice(2) } as ArticleBlock]
    return [{ kind: 'paragraph', text: value } as ArticleBlock]
  })
}
export const materialNoteTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`
/** Same saved timing projection as the player; never manufacture word or paragraph times. */
export function materialNotePlayback(transcriptValue: unknown) {
  const transcript = record(transcriptValue), recognized = playbackTranscript(transcript.recognition)
  if (recognized.paragraphs.length) return recognized
  const subtitles = playbackTranscript({ segments: transcript.segments })
  if (subtitles.paragraphs.length) return subtitles
  const text = String(typeof transcript.corrected === 'string' ? transcript.corrected : transcript.raw || '').trim()
  return recognized.text ? recognized : { precision: 'none' as const, paragraphs: [], text, untimedText: text ? [text] : [] }
}
export function materialReadingBlocks(transcript: unknown, body: string, article = false) {
  if (article) return articleBlocks(body).map((block, i) => ({ id: 'article-' + i, text: block.text, time: undefined as string | undefined }))
  const playback = materialNotePlayback(transcript)
  if (body.trim() === playback.text.trim()) return [
    ...playback.paragraphs.map(block => ({ id: block.id, text: block.text, time: materialNoteTime(block.startMs) })),
    ...(playback.untimedText || []).map((text, i) => ({ id: 'untimed-' + i, text, time: undefined as string | undefined })),
  ]
  return body.split(/\n+/).filter(Boolean).map((text, i) => ({ id: 'text-' + i, text, time: undefined as string | undefined }))
}
export function materialAnnotations(value: unknown, materialId?: string): MaterialNoteAnnotation[] {
  return validMaterialAnnotations(value, materialId) ? value : []
}
export function matchingNoteAnchors(notes: MaterialNoteAnnotation[], blockId: string, blockText: string) {
  return notes.flatMap(note => note.anchors.filter(anchor => anchor.blockId === blockId && anchor.blockText === blockText).map(anchor => ({ note, anchor })))
}
