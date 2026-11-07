import { object, text, type RecordItem } from './studio-client'
import { transcriptText } from './StudioMaterialHelpers'

export function studioCollectionState(item: RecordItem) {
  const task = object(item.collection), status = text(task.status)
  const delivery = object(item.delivery)
  const deliveryKnown = typeof delivery.complete === 'boolean'
  const shared = object(item.sharedReference)
  const transcript = Object.keys(shared).length ? shared.transcript : item.transcript
  const sourceError = object(item.bodySourceError)
  const ready = !sourceError.code && (item.summaryOnly === true ? item.hasTranscript === true : !!transcriptText(transcript).trim())
  const active = ['queued', 'running'].includes(status)
  const startFailed = status === 'not_started' && !!text(task.error)
  const deliveryIncomplete = deliveryKnown ? delivery.complete === false : task.deliveryRequired === true && task.deliveryComplete === false
  const delivered = !sourceError.code && (deliveryKnown ? delivery.complete === true : task.deliveryRequired === true && task.deliveryComplete === true)
  const taskNeedsAttention = !delivered && (startFailed || ['failed', 'blocked', 'cancelled'].includes(status))
  const needsAttention = taskNeedsAttention || deliveryIncomplete
  const receiptPending = needsAttention && object(task.recovery).code === 'receipt_required'
  const recovery = object(task.recovery)
  const authorizationPending = taskNeedsAttention && recovery.code === 'source_requote' && recovery.retry === true
  const recoveryPending = taskNeedsAttention && recovery.code === 'resumable' && recovery.retry === true
  const failed = taskNeedsAttention && (status === 'failed' || startFailed) && !receiptPending && !authorizationPending && !recoveryPending
  const noSpeech = delivery.outcome === 'no_speech' || task.noSpeech === true || object(object(transcript).recognition).status === 'no_speech'
  const labels: Record<string, string> = {
    queued: '排队中', running: '正在处理', failed: '采集失败', blocked: '采集受阻', cancelled: '采集已停止', not_started: '采集未能启动',
  }
  const activeLabel = task.textExtracted === true ? '正在保存正文'
    : task.transcribing === true ? '正在转写' : task.contentFetched === true ? '内容已抓取 · 待提取正文' : labels[status]
  const missingFacts = deliveryKnown ? delivery : task
  const missing = [missingFacts.missingVideo === true ? '原视频' : '', missingFacts.missingOriginalTranscript === true ? '原音逐字稿' : ''].filter(Boolean).join('与') || '正文'
  const label = sourceError.code ? '正文来源待核对' : active || needsAttention ? `${ready ? '正文保留 · ' : ''}${active ? activeLabel : receiptPending ? '采集结果待核实' : authorizationPending ? '待确认' : recoveryPending ? '需恢复' : taskNeedsAttention ? labels[status] : missing + '待补齐'}`
    : ready ? '正文已就绪' : noSpeech ? '未识别到人声' : delivered ? '采集完成' : status === 'succeeded' ? '正文未就绪' : '待获取正文'
  return { task, status, ready, active, failed, needsAttention, receiptPending, authorizationPending, recoveryPending, deliveryIncomplete, label,
    message: text(sourceError.message) || (authorizationPending || recoveryPending ? text(recovery.hint) : '') || (!delivered ? text(task.error) : '') || (active ? text(task.phase, '任务正在执行，正文就绪后会自动显示。')
      : deliveryIncomplete ? `这条来源的${missing}尚未保存完整。已有正文仍可阅读；继续采集会先核对状态，再补齐缺项。`
        : ready ? '' : noSpeech ? '原音频识别已完成，未识别到人声。视频仍可在播放器查看，不会自动再次转写。' : delivered ? '原始内容已保存，保留你对正文的编辑。' : status === 'succeeded' ? '采集任务已结束，但这条作品还没有可用正文。可补充素材，或查看采集日志核对结果。'
        : '已保存作品信息，尚未获取正文，当前没有正文任务排队。也可手工补充原文。'),
  }
}

// Feed and library report the same body state; task failure must not hide saved text.
export function studioCollectionBodyState(item: RecordItem) {
  const state = studioCollectionState(item)
  const complete = !state.active && !state.needsAttention && !object(item.bodySourceError).code && (object(item.delivery).complete === true || state.ready || state.label === '未识别到人声')
  return state.ready && complete ? { ready: true, complete, label: '正文就绪', hint: '可以打开正文继续阅读。' }
    : { ready: state.ready, complete, label: state.failed && !state.ready ? '正文处理失败' : state.label, hint: state.message }
}

/** Display completed collection metadata while ASR is pending, without mutating the material/version. */
export function studioCollectedMetadata(item: RecordItem) {
  const summary = object(object(item.collection).mediaSummary)
  return {
    title: text(item.title).trim() || text(summary.title).trim(),
    author: text(item.author).trim() || text(summary.author).trim(),
  }
}

/** Only refresh server content when it cannot discard an unsaved correction. */
export function mergeStudioCollectionRefresh(current: RecordItem | null, incoming: RecordItem, dirty: boolean) {
  return dirty && current?.id === incoming.id ? { ...current, collection: incoming.collection } : incoming
}
