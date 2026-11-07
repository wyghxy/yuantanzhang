type Data = Record<string, unknown>
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}
const text = (value: unknown) => typeof value === 'string' ? value : ''

/** An intentionally cleared correction must not silently show the immutable raw text. */
export function transcriptText(value: unknown, original = false): string {
  const transcript = object(value)
  return original ? text(transcript.raw) : typeof transcript.corrected === 'string' ? transcript.corrected : text(transcript.raw)
}

export function transcriptParagraphs(value: unknown, original = false) {
  const transcript = object(value), body = transcriptText(transcript, original)
  const segments = Array.isArray(transcript.segments) ? transcript.segments.map(object) : []
  const same = (value: string) => value.replace(/\s+/g, '')
  if (segments.length && same(segments.map(segment => text(segment.text)).join('')) === same(body)) {
    return segments.map((segment, index) => {
      const seconds = typeof segment.startMs === 'number' ? segment.startMs / 1000 : typeof segment.start === 'number' ? segment.start : typeof segment.startSeconds === 'number' ? segment.startSeconds : null
      return { body: text(segment.text), index: index + 1, seconds: seconds !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null }
    })
  }
  return body.split(/\n+/).map(line => line.trim()).filter(Boolean).map((line, index) => ({ body: line, index: index + 1, seconds: null as number | null }))
}

export function resolvedStudioLink(value: unknown): Data {
  const result = object(value), link = Object.keys(object(result.link)).length ? object(result.link) : result
  const kind = link.detectedKind === 'accounts' || link.kind === 'creator' || link.kind === 'account' ? 'accounts' : link.detectedKind === 'materials' || ['video', 'article', 'note', 'text', 'material'].includes(text(link.kind)) ? 'materials' : 'unknown'
  return { ...link, detectedKind: kind, requiresResolution: kind === 'unknown' }
}

export function observedMetric(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('zh-CN') : '—'
}

/** 情报状态只有开启／关闭两种；公众号订阅源等细节放在资料面板，不挤进状态胶囊。 */
export function accountTrackingLabel(account: Data): string {
  return account.enabled === false ? '情报关闭' : '情报开启'
}

export function uploadedMaterialNotice(value: unknown): string {
  const result = object(value)
  if (typeof result.taskError === 'string' && result.taskError) return result.taskError
  if (Object.keys(object(result.task)).length) return '文件已保存，转写任务已入队；请在任务栏查看实际结果'
  if (result.needsTranscription === true) return '音视频已保存，可以在播放器打开，也可补充文字。'
  if (result.assetKey) return '原视频已保存，可复用已有正文和播放信息'
  return '原文文件已保存，来源标为人工输入'
}

export function groupStudioWorks<T extends Data>(items: T[], now = Date.now()) {
  const buckets: Record<string, T[]> = { '今天': [], '昨天': [], '近7天': [], '更早': [], '日期未知': [] }
  const day = (time: number) => Math.floor((time + 8 * 3600000) / 86400000)
  for (const item of items) {
    const published = typeof item.publishedAt === 'string' ? Date.parse(item.publishedAt) : NaN
    const age = day(now) - day(published)
    const key = !Number.isFinite(published) || published > now ? '日期未知' : age === 0 ? '今天' : age === 1 ? '昨天' : age < 7 ? '近7天' : '更早'
    buckets[key].push(item)
  }
  return Object.entries(buckets).filter(([, rows]) => rows.length).map(([title, rows]) => ({ title, items: rows }))
}
