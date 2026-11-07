import { articleBlocks } from '@ytz/contracts/studio-material-notes'

type RecordValue = Record<string, unknown>
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
export const BREAKDOWN_LOCATE_EVENT = 'studio-breakdown-locate-source'
export const BREAKDOWN_REVEAL_EVENT = 'studio-breakdown-reveal-original'
export type BreakdownSourceBinding = {
  materialId: string; version: number; sha256: string; paragraphs: Array<{ id: number; text: string }>; quote?: string
}
export type BreakdownLocateRequest = { binding: BreakdownSourceBinding; trigger: HTMLElement; receive: (result: Promise<string>) => void }

/** Only the server-frozen original paragraphs may authorize a source location. */
export function breakdownSourceBinding(analysis: RecordValue, source: { materialId: string; version: number } | undefined, row: RecordValue): BreakdownSourceBinding {
  const detail = Object.keys(object(analysis.breakdown)).length ? object(analysis.breakdown) : analysis
  const evidence = object(detail.sourceEvidence)
  const ids = row.paragraphIds
  if (!source?.materialId || !Number.isSafeInteger(source.version) || source.version < 1 || evidence.version !== 1 ||
      typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256) || !Array.isArray(ids) || !ids.length || ids.length > 500 ||
      ids.some(id => !Number.isSafeInteger(id) || id < 1) || !Array.isArray(evidence.paragraphs))
    throw new Error('这份拆解没有可核对的原文定位信息；已保留冻结引用。')
  const paragraphs = [...new Set(ids as number[])].sort((a, b) => a - b).map(id => {
    const matches = (evidence.paragraphs as unknown[]).map(object).filter(value => value.id === id)
    if (matches.length !== 1 || typeof matches[0].text !== 'string' || !matches[0].text.trim())
      throw new Error('原文段落证据不完整；已保留冻结引用，未跳转到其他段落。')
    return { id, text: matches[0].text }
  })
  const quote = row.quote
  if (quote !== undefined && (typeof quote !== 'string' || !quote.trim() || !paragraphs.some(value => value.text.includes(quote))))
    throw new Error('这句话无法与冻结原文核对；已保留引用，未跳转。')
  return { materialId: source.materialId, version: source.version, sha256: evidence.sha256, paragraphs,
    ...(typeof quote === 'string' ? { quote } : {}) }
}

export async function verifyBreakdownSource(binding: BreakdownSourceBinding, current: { materialId: string; version: number; body: string }) {
  if (binding.materialId !== current.materialId || binding.version !== current.version)
    throw new Error('参考作品或版本已变化；已保留拆解中的冻结原文，请核对后再定位。')
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(current.body)))].map(value => value.toString(16).padStart(2, '0')).join('')
  const paragraphs = current.body.split(/\n+/).map(value => value.trim()).filter(Boolean)
  if (digest !== binding.sha256 || binding.paragraphs.some(value => paragraphs[value.id - 1] !== value.text) ||
      binding.quote !== undefined && !binding.paragraphs.some(value => value.text.includes(binding.quote!)))
    throw new Error('当前原文与这份拆解的依据不同；已保留冻结引用，不会按旧段号跳转。')
  return paragraphs
}

export async function requestBreakdownSource(binding: BreakdownSourceBinding, trigger: HTMLElement) {
  let result: Promise<string> | undefined
  window.dispatchEvent(new CustomEvent<BreakdownLocateRequest>(BREAKDOWN_LOCATE_EVENT, { detail: {
    binding, trigger, receive: value => { result ??= value },
  } }))
  return result ?? '当前没有可定位的原文阅读区；已保留冻结引用。'
}

/** Formatting is presentation only; the complete saved body/hash is checked first. */
const displayText = (value: string) => (articleBlocks(value)[0]?.text || value).replace(/^\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d+)?\]\s*/, '').trim()
export function breakdownDomTargets(root: HTMLElement, binding: BreakdownSourceBinding, paragraphs: string[]) {
  const spans = Array.from(root.querySelectorAll<HTMLElement>('[data-note-text]'))
  const compact = (value: string) => value.replace(/\s+/gu, '')
  if (compact(spans.map(span => (span.textContent || '').trim()).join('\n')) !== compact(paragraphs.map(displayText).join('\n')))
    throw new Error('阅读区正文尚未与当前版本一致；已保留冻结引用，请重新读取后再定位。')
  const byOrder = spans.length === paragraphs.length && spans.every((span, index) => (span.textContent || '').trim() === displayText(paragraphs[index]))
  return binding.paragraphs.filter(value => !binding.quote || value.text.includes(binding.quote)).map(value => {
    const needle = displayText(binding.quote || value.text)
    const matches = byOrder ? [spans[value.id - 1]] : spans.filter(span => (span.textContent || '').includes(needle))
    if (matches.length !== 1 || !matches[0] || !needle || !matches[0].textContent?.includes(needle))
      throw new Error('已核对原文，但当前排版无法唯一定位这句话；请查看保留的原文引用。')
    const element = matches[0], start = element.textContent!.indexOf(needle)
    if (element.textContent!.indexOf(needle, start + 1) !== -1)
      throw new Error('原文存在多处相同句子，暂不猜测位置；请查看冻结引用。')
    return { element, start, end: start + needle.length }
  })
}

/** Match offsets across annotation spans without changing the browser selection or note anchors. */
export function breakdownTextRange({ element, start, end }: ReturnType<typeof breakdownDomTargets>[number]) {
  const walker = element.ownerDocument.createTreeWalker(element, 4)
  const range = element.ownerDocument.createRange()
  let offset = 0, began = false, ended = false
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length || 0
    if (!began && start < offset + length) { range.setStart(node, start - offset); began = true }
    if (began && end <= offset + length) { range.setEnd(node, end - offset); ended = true; break }
    offset += length
  }
  if (!began || !ended || range.toString() !== element.textContent?.slice(start, end)) throw new Error('原文排版已变化，请重新定位。')
  return range
}
