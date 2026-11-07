import { writingObject as obj, writingText as text, type WritingRecord } from '../studio-writing-model'

export const breakdownRows = (value: unknown): WritingRecord[] => Array.isArray(value) ? value.map(obj) : []
export const breakdownIds = (row: WritingRecord): number[] => Array.isArray(row.paragraphIds)
  ? row.paragraphIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0) : []
export const breakdownEvidence = (row: WritingRecord) => {
  const ids = breakdownIds(row)
  return ids.length ? `原文第 ${ids.join('、')} 段` : ''
}
export const breakdownRoles: Record<string, string> = {
  hook: '开头钩子', problem: '提出问题', concept: '解释概念', solution: '解决方案',
  proof: '论据案例', bonus: '补充价值', cta: '行动引导', other: '内容推进',
}
export const breakdownHooks: Record<string, string> = {
  pain: '痛点切入', contrarian: '反常识', tutorial_promise: '教程承诺', assertion: '观点先行',
  resource: '资源吸引', first_person: '亲身经历', other: '其他开头', unknown: '未分类',
}

/** Preserve the saved evidence's own paragraph IDs; never relabel a partial match as an exact quote. */
export function breakdownExcerpt(row: WritingRecord, lines: WritingRecord[], sourceLines: WritingRecord[] = []): WritingRecord | null {
  const wanted = breakdownIds(row)
  if (wanted.length && wanted.every(id => sourceLines.some(line => breakdownIds(line)[0] === id))) {
    return { paragraphIds: wanted, sentence: wanted.map(id => text(sourceLines.find(line => breakdownIds(line)[0] === id)?.sentence)).join('\n') }
  }
  const candidates = lines.filter(line => text(line.sentence) && breakdownIds(line).some(id => wanted.includes(id)))
  return candidates.find(line => breakdownIds(line).every(id => wanted.includes(id))) || candidates[0] || null
}

/** Old results remain readable without scheduling another model call. */
export function breakdownView(analysis: WritingRecord) {
  const detail = Object.keys(obj(analysis.breakdown)).length ? obj(analysis.breakdown) : analysis
  const points = breakdownRows(analysis.points), lines = breakdownRows(detail.lineByLine)
  const evidence = obj(detail.sourceEvidence)
  const sourceLines = evidence.version === 1 ? breakdownRows(evidence.paragraphs)
    .filter(row => Number.isSafeInteger(row.id) && Number(row.id) > 0 && text(row.text))
    .map(row => ({ paragraphIds: [Number(row.id)], sentence: text(row.text) })) : []
  const totalParagraphs = evidence.version === 1 && Number.isSafeInteger(evidence.totalParagraphs) && Number(evidence.totalParagraphs) >= sourceLines.length
    ? Number(evidence.totalParagraphs) : undefined
  const point = (label: string) => points.find(item => text(item.label) === label)
  const savedDrivers = breakdownRows(detail.drivers).filter(row => text(row.title) && text(row.reason) && breakdownIds(row).length)
  const drivers = savedDrivers.length ? savedDrivers.slice(0, 3) : [
    ['内容承诺', '看点与承诺'], ['结构节奏', '推进与节奏'], ['论据案例', '证据与信任'],
  ].flatMap(([label, title]) => {
    const row = point(label)
    return row && text(row.text) ? [{ ...row, title, reason: text(row.text) }] : []
  })
  const hook = obj(detail.hook), hookPoint = point('开头钩子')
  return {
    detail, points, lines, sourceLines, totalParagraphs, drivers,
    hook: text(hook.reason) && text(hook.type) !== 'unknown' ? hook : hookPoint ? { ...hookPoint, reason: text(hookPoint.text) } : hook,
    beats: breakdownRows(obj(detail.structureProgression).beats), golden: breakdownRows(detail.goldenSentences),
  }
}
