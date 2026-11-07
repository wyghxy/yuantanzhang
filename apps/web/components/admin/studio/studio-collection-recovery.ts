import { apiFresh, object, text, type RecordItem } from './studio-client'
import { studioCollectionState } from './studio-collection-state'

/** All collection entry points use the same server recovery decision. */
export function collectionRecoveryAction(item: RecordItem) {
  const state = studioCollectionState(item), recovery = object(state.task.recovery)
  if (state.active) return { kind: 'waiting' as const, label: state.label, hint: state.message }
  if (object(item.bodySourceError).code)
    return { kind: 'blocked' as const, label: '查看处理方法', hint: state.message }
  // An old task can be succeeded while its own source bundle is incomplete.
  // Prepare the current source; retrying the succeeded task cannot repair it.
  if (state.deliveryIncomplete && state.status === 'succeeded')
    return recovery.retry === false
      ? { kind: 'blocked' as const, label: '查看处理方法', hint: text(recovery.hint) || state.message }
      : { kind: 'repair' as const, label: '补齐视频与逐字稿', hint: state.message }
  // Saved text does not prove that this task delivered its video and original audio.
  if (state.needsAttention) {
    if (state.status === 'not_started' && !state.task.taskId && recovery.retry !== false)
      return { kind: 'start' as const, label: '开始采集', hint: state.message }
    if (state.task.taskId && recovery.retry !== false && (recovery.retry === true || state.task.canRetry === true))
      return { kind: 'retry' as const, label: recovery.code === 'source_requote' ? '继续采集' : '继续采集',
        hint: text(recovery.hint) || state.message, taskId: text(state.task.taskId) }
    return { kind: 'blocked' as const, label: '查看处理方法', hint: text(recovery.hint) || state.message }
  }
  if (state.ready || state.label === '未识别到人声') return null
  if (recovery.retry === false || state.task.taskId)
    return { kind: 'blocked' as const, label: '查看处理方法', hint: text(recovery.hint) || state.message }
  return { kind: 'start' as const, label: '开始采集', hint: '获取作品正文；视频作品同时保存原视频并提取逐字稿。' }
}

/** A settled retry is not proof of a changed source. Only the current quote may
 * select repair; its identity hint is never a fee authorization or POST input.
 */
export async function currentCollectionRecoveryAction(item: RecordItem, signal?: AbortSignal, readQuote = apiFresh) {
  signal?.throwIfAborted()
  const action = collectionRecoveryAction(item), task = studioCollectionState(item).task
  const recovery = object(task.recovery)
  if (action?.kind !== 'retry' || !['import', 'transcribe', 'prepare_source'].includes(String(task.kind)) ||
      recovery.code !== 'source_requote' || recovery.retry !== true) return action
  const quote = await readQuote('materials/' + encodeURIComponent(item.id) + '/prepare?quote=1', signal)
  signal?.throwIfAborted()
  const repair = object(quote.currentSourceRepair)
  return quote.requiresAuthorization === true && repair.materialId === item.id && repair.previousTaskId === action.taskId
    ? { kind: 'repair' as const, label: '重新采集', hint: '读取作品的采集状态。' }
    : action
}
