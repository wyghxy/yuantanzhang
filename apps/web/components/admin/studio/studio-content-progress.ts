type Batch = Record<string, unknown>
export type StudioContentProgressView = { label: string; message: string; attention: boolean; resumable: boolean }
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null

function attentionMessage(batch: Batch) {
  const progress = batch.contentProgress && typeof batch.contentProgress === 'object' && !Array.isArray(batch.contentProgress)
    ? batch.contentProgress as Batch : {}
  const total = count(progress.total), completed = count(progress.completed), skipped = count(batch.skipped)
  const incomplete = count(batch.incompleteTasks), facts: string[] = []
  if (total !== null && completed !== null && completed <= total && total > 0) {
    facts.push(`采集任务已完成 ${completed} / ${total} 项`)
    if (completed < total) facts.push(`${total - completed} 项任务尚未完成`)
  }
  if (skipped !== null && skipped > 0) facts.push(`${skipped} 个账号已跳过`)
  if (incomplete !== null && incomplete > 0) facts.push(`${incomplete} 项存在内容或采集范围缺项`)
  if (batch.taskCoverageTruncated === true) facts.push('任务范围尚未核对完整')
  return facts.length ? `${facts.join('；')}。请查看本批详情。` : '本批有事项需核对，请查看详情。'
}

/** Public state, not the successful discovery task, decides whether full collection has finished. */
export function studioContentProgressView(batch: Batch): StudioContentProgressView | null {
  const state = batch.contentGrantState, code = batch.contentGrantCode
  if (!state || state === 'complete' || state === 'cancelled') return null
  if (state === 'needs_attention') return { label: '需处理', message: code === 'content_preflight_retry_exhausted'
    ? '本批媒体检查暂未通过，可重试；已有内容会保留。' : attentionMessage(batch), attention: true,
    resumable: batch.contentResumeAvailable === true }
  if (state === 'awaiting_listing') {
    if (code === 'content_waiting_slot') return { label: '等待处理名额',
      message: '前面的任务完成后自动继续。', attention: false, resumable: false }
    if (code === 'content_waiting_capacity') return { label: '等待存储空间',
      message: '正在处理的任务暂占存储空间，释放后自动继续。', attention: false, resumable: false }
    if (code === 'content_waiting_inventory') return { label: '核对存储用量',
      message: '历史视频用量核对完成后自动继续。', attention: false, resumable: false }
    if (code === 'content_storage_full') return { label: '存储空间不足',
      message: '释放空间或扩容后自动继续。', attention: true, resumable: false }
    const retryAt = typeof batch.contentRetryAt === 'string' ? Date.parse(batch.contentRetryAt) : NaN
    return { label: Number.isFinite(retryAt) ? '等待自动重试' : '完整采集中',
      message: Number.isFinite(retryAt) ? '媒体检查暂缓，系统会自动重试。' : '正在检查新作品并准备正文与视频。', attention: false, resumable: false }
  }
  return state === 'queued' ? { label: '正在补全内容', message: '正在获取原视频、逐字稿或图文正文。', attention: false, resumable: false } : null
}
