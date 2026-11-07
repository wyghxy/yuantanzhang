import { studioRequest } from './studio-request'
import { studioCachedRead, invalidateStudioQueries } from './studio-query-cache'
import { studioMaterialContentType, type StudioReference } from '@ytz/contracts/studio-radar'
import type { StudioRenderCard } from './studio-render-browser'
import { transcriptParagraphs, transcriptText } from './StudioMaterialHelpers'
import { studioSourceBody } from '@ytz/contracts/studio-source-tools'

export type WritingRecord = Record<string, unknown>
/** 原文可读的素材：公众号文章、图文帖、纯文字。它们没有可播放的原视频，
 * 右栏应直接显示正文而不是一个报「没有可用的原视频」的播放器。 */
export function writingArticle(material: WritingRecord | null) {
  if (!material) return false
  const kind = studioMaterialContentType(material)
  return kind === 'article' || kind === 'image' || material.platform === 'wechat_official' && kind !== 'video'
}
export const writingObject = (value: unknown): WritingRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as WritingRecord : {}
export const writingText = (value: unknown) => typeof value === 'string' ? value : ''
export type WritingDraft = WritingRecord & { id: string; version: number; title: string; body: string; config?: WritingRecord; templateKey?: string; status?: string }
export type WritingInput = { title: string; body: string; templateKey: string; config: WritingRecord; references?: StudioReference[] }
export const writingInput = (draft: WritingDraft): WritingInput => ({ title: draft.title || '', body: draft.body || '', templateKey: draft.templateKey || 'tutorial_save_loop', config: writingObject(draft.config), references: Array.isArray(draft.references) ? draft.references as StudioReference[] : typeof draft.materialId === 'string' && draft.materialId ? [{ materialId: draft.materialId }] : [] })
export const writingTemplates = [
  { key: 'tutorial_save_loop', title: '教程型收藏闭环', hint: '强承诺 / 清单 / 实操' },
  { key: 'judgment_first', title: '判断先于界面', hint: '认知反转 / 录屏证明' },
  { key: 'tool_demo', title: '工具实战演示', hint: '成品先行 / 输入动作结果' },
  { key: 'short_fast', title: '极速短视频（35–65s）', hint: '单点爆发 / 保存卡片' },
] as const

/** Reference text must come from the acquired transcript, including confirmed shared material. */
export function writingSourceMaterial(material: WritingRecord | null): WritingRecord | null {
  if (!material) return null
  const shared = writingObject(material.sharedReference)
  // Older read-only responses can contain shared text without its primary ID.
  // Preserve that text, but never invent the source ID needed for a mutation.
  return Object.keys(shared).length ? { ...shared, id: writingText(shared.primaryMaterialId) } : material
}
export function writingReference(material: WritingRecord | null) {
  const source = writingObject(material), shared = writingObject(source.sharedReference)
  const resolved = writingSourceMaterial(material) || {}
  const transcript = writingObject(resolved.transcript)
  const body = transcriptText(transcript) || studioSourceBody(resolved)
  const paragraphs = transcriptParagraphs(transcript).map(paragraph => ({ text: paragraph.body, seconds: paragraph.seconds }))
  const analysis = writingObject(source.analysis)
  // A shared transcript is not evidence of this publication's title or tags.
  const original = source
  return { body, paragraphs, recognition: resolved.recognition || transcript.recognition || transcript, originalPublication: original.originalPublication, sourceRef: original.sourceRef,
    anchorBody: typeof transcript.corrected === 'string' ? transcript.corrected : writingText(transcript.raw), transcriptVersion: Number(transcript.version), source: writingText(transcript.source), corrected: typeof transcript.corrected === 'string', analysis: Object.keys(analysis).length ? analysis : writingObject(shared.analysis) }
}

export type WritingSegment = { id: string; role: string; narration: string; visualNotes: string; seconds: number }
export function writingCardSection(body: string) {
  const heading = /^##[ \t]+(?:截图贴图包|贴图卡片)[ \t]*\r?$/m.exec(body)
  if (!heading) return { body, cards: [] as StudioRenderCard[], hasSection: false }
  const tail = body.slice(heading.index + heading[0].length), next = /\n##[ \t]+/.exec(tail)
  const section = next ? tail.slice(0, next.index) : tail
  const pattern = /###\s+(C\d{1,3})[ \t]*[：:]([^\r\n]+)\r?\n[ \t]*```text[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/g
  const matches = [...section.matchAll(pattern)]
  if (!matches.length || section.replace(pattern, '').trim()) throw new Error('贴图章节格式无法识别，请在 script.md 中检查 C01：标题及 text 代码围栏')
  return { body: body.slice(0, heading.index) + (next ? tail.slice(next.index) : ''), cards: matches.map(m => ({ id: m[1], title: m[2].trim(), content: m[3], type: '人工文字卡' })), hasSection: true }
}
export function writingReplaceCards(body: string, cards: StudioRenderCard[]) {
  const main = writingCardSection(body).body.trimEnd()
  if (!cards.length) return main
  if (cards.some(c => !/^C\d{1,3}$/.test(c.id) || !c.title.trim() || /[\r\n]/.test(c.title) || !c.content.trim() || c.content.includes('```'))) throw new Error('每张贴图需要单行标题和正文，正文不能包含三个连续反引号')
  return main + '\n\n## 截图贴图包\n\n' + cards.map(c => ['### ' + c.id + '：' + c.title.trim(), '```text', c.content, '```'].join('\n')).join('\n\n') + '\n'
}
export function writingSegments(body: string): WritingSegment[] {
  const main = writingCardSection(body).body
  const sections = [...main.matchAll(/^###\s+(S\d+)\s*(?:·\s*)?【([^】]+)】[^\n]*\n([\s\S]*?)(?=^###?\s|$(?![\s\S]))/gm)]
  if (sections.length) {
    let consumed = 0
    for (const [index, section] of sections.entries()) {
      let outside = main.slice(consumed, section.index)
      if (index === 0) outside = outside.replace(/^\s*# [^\n]*(?:\n|$)/, '')
      if (outside.replace(/^\s*---\s*$/gm, '').trim()) throw new Error('口播段落之外还有文字，请在 script.md 中归入相应段落，避免遗漏')
      consumed = section.index! + section[0].length
    }
    if (main.slice(consumed).replace(/^\s*---\s*$/gm, '').trim()) throw new Error('正文末尾还有未归类文字，请在 script.md 中检查')
    return sections.map(m => {
    const speech = m[3].match(/^>[ \t]*\*\*口播\*\*[ \t]*[：:][ \t]*([^\n]*(?:\n>[ \t]?[^\n]*)*)/m)
    if (!speech) throw new Error(`${m[1]} 缺少口播标记，请先在 script.md 中补齐`)
    const remainder = m[3].replace(speech[0], '').split('\n').filter(line => line.trim() && !/^(?:【画面[：:][\s\S]*】|预计\s*\d+(?:\.\d+)?\s*秒[^\n]*|---)\s*$/.test(line.trim()))
    if (remainder.length) throw new Error(`${m[1]} 有口播标记之外的未归类文字，请在 script.md 中检查`)
    const narration = speech[1].replace(/\n>[ \t]?/g, '\n').trimEnd()
    return { id: m[1], role: m[2], narration, visualNotes: m[3].match(/【画面[：:]([^\n]*?)】/)?.[1] || '', seconds: Math.ceil(narration.replace(/\s/g, '').length / 260 * 60) }
    })
  }
  if (/^\s*(?:#{1,6}\s|>\s|```|【画面[：:])/m.test(main)) throw new Error('请在 script.md 中使用完整导演稿，或改为不含标题标记的纯台词后查看分镜')
  return main.split(/\n\n/).filter(p => p.trim()).map((narration, i) => ({ id: `S${String(i + 1).padStart(2, '0')}`, role: '正文', narration, visualNotes: '', seconds: Math.ceil(narration.replace(/\s/g, '').length / 260 * 60) }))
}
/** Match the website's saved-body teleprompter projection; never use an older generated payload. */
export function writingSpeech(body: string) {
  const explicit = /(?:\*\*)?口播(?:\*\*)?[：:]/.test(body)
  let collecting = !explicit, fenced = false, cards = false
  const lines: string[] = []
  for (let row of body.split('\n')) {
    row = row.trim()
    if (row.startsWith('```')) { fenced = !fenced; continue }
    if (fenced) continue
    if (/^##/.test(row)) { collecting = !explicit; cards = /截图|贴图|卡片|Cards/i.test(row); continue }
    if (cards) continue
    const marked = row.match(/^(?:>\s*)?(?:\*\*)?口播(?:\*\*)?[：:]\s*(.*)/)
    if (marked) { collecting = true; row = marked[1] }
    else if (explicit && /^(?:#|---|【|- \*\*|预计\s*\d+(?:\.\d+)?\s*秒)/.test(row)) collecting = false
    if (!collecting || !row || /^(?:#|\||<!--|---)/.test(row) || /^(?:\*\*)?(?:画面|拍摄|镜头|节奏|时长|模板|贴图|导演|来源|备注)[：:]/.test(row)) continue
    row = row.replace(/【(?:画面|镜头|节奏|拍摄)[：:][^】]*】/g, '').replace(/^(?:[-*>]\s*)?(?:S\d+\s*[｜|:：]\s*)?/, '').replace(/\*\*|__/g, '')
    if (row) lines.push(row)
  }
  return lines.join('\n\n')
}
export const writingError = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试'
export class WritingApiError extends Error { constructor(message: string, public status: number, public code: string, public current?: unknown) { super(message) } }
export async function writingRequest<T = WritingRecord>(url: string, init: RequestInit = {}): Promise<T> {
  if ((init.method || 'GET').toUpperCase() === 'GET') return studioCachedRead(url, signal => writingRawRequest<T>(url, { ...init, signal }), init.signal)
  const result = await writingRawRequest<T>(url, init)
  invalidateStudioQueries(url)
  return result
}
/** A cross-window revision check must not reuse this tab's earlier cached GET. */
export const writingFreshRequest = <T,>(url: string, init: RequestInit = {}) => writingRawRequest<T>(url, init)
async function writingRawRequest<T>(url: string, init: RequestInit): Promise<T> {
  return studioRequest(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers: { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers } }, async response => {
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new WritingApiError(result.error || `请求未完成（${response.status}）`, response.status, result.code || '', result.current)
    return result as T
  })
}
