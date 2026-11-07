import { list, object, text, type RecordData } from './studio-client'
import { studioCollectionTaskGroups } from './studio-metric-followup-view'
import { studioContentProgressView } from './studio-content-progress'

/** A saved task can already be blocked. Creation counts are not queue receipts. */
export function studioCollectionSubmissionFeedback(collection: RecordData) {
  const fullContent = studioContentProgressView(collection)
  const { content } = studioCollectionTaskGroups(list(collection.tasks))
  const items = list(collection.items)
  const queued = content.filter(task => task.status === 'queued').length
  const running = content.filter(task => task.status === 'running').length
  const unresolved = content.filter(task => task.deliveryResolved !== true && ['blocked', 'failed'].includes(text(task.status)))
  const blocked = unresolved.filter(task => task.status === 'blocked').length
  const failed = unresolved.length - blocked
  const skipped = items.filter(item => item.status === 'skipped').length
  const reasons = [...new Set([
    ...unresolved.map(task => text(task.error).trim()),
    ...items.filter(item => ['skipped', 'blocked', 'failed', 'missing'].includes(text(item.status)) && object(item.task).deliveryResolved !== true)
      .map(item => text(item.reason).trim() || text(object(item.task).error).trim()),
  ].filter(Boolean))]
  const parts = [
    fullContent ? fullContent.message : '',
    queued ? `${queued} 个采集任务已入队` : '',
    running ? `${running} 个采集任务正在处理` : '',
    blocked ? `${blocked} 个任务受阻` : '',
    failed ? `${failed} 个任务失败` : '',
    skipped ? `${skipped} 个账号已跳过` : '',
  ].filter(Boolean)
  if (!fullContent && !queued && !running && !blocked && !failed) {
    parts.unshift(!Number(collection.tasksCreated) && !content.length ? '本批未创建任务'
      : content.length && content.every(task => task.status === 'succeeded' || task.deliveryResolved === true)
        ? '本批任务已结束' : '批次已保存，暂无执行中的采集任务')
  }
  parts.push(...reasons.slice(0, 2))
  const needsReview = unresolved.length > 0 || skipped > 0 || reasons.length > 0 || !queued && !running
  return { message: parts.join('；') + (needsReview ? '。请在采集任务中查看逐项结果。' : '。可在采集任务中查看进度。'),
    error: fullContent?.attention === true || unresolved.length > 0 || items.some(item => ['failed', 'blocked', 'missing'].includes(text(item.status)) && object(item.task).deliveryResolved !== true) }
}
