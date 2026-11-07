import { studioMetricFollowupView } from './studio-metric-followup-view'
import { object, statusNames, text, type RecordData } from './studio-client'

const scheduleTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

/** Recheck delayed work at its due time, capped so external changes remain visible. */
export function studioTaskScheduledRefreshDelay(task: RecordData, now = Date.now()) {
  const due = typeof task.notBefore === 'string' ? Date.parse(task.notBefore) : NaN
  return task.status === 'queued' && Number.isFinite(due) && due > now ? Math.min(300000, due - now) : 0
}

export function studioTasksRefreshDelay(tasks: RecordData[], now = Date.now()) {
  const delays = tasks.filter(task => ['queued', 'running'].includes(text(task.status)))
    .map(task => studioTaskScheduledRefreshDelay(task, now) || 10000)
  return delays.length ? Math.min(...delays) : 0
}

/** Current material facts do not change the original task or its processing record. */
export function studioTaskTextStatus(task: RecordData) {
  const progress = object(task.collectionProgress)
  if (progress.textReady === true) return '正文已就绪'
  if (object(task.currentMaterial).textSaved === true) return '当前正文已就绪'
  if (progress.noSpeech === true) return '未识别到人声'
  if (['succeeded', 'failed', 'blocked', 'cancelled'].includes(text(task.status))) return '本任务未记录正文证据'
  return '正文待转写'
}

/** A delayed queue item is waiting for its scheduled time, not a stalled worker. */
export function studioTaskDisplay(task: RecordData, now = Date.now()) {
  const followup = studioMetricFollowupView(task, now)
  if (followup) return { status: followup.status, message: `${followup.schedule}；${followup.awaitingAuthorization || followup.planned ? followup.hint : text(task.error || task.phase, followup.hint)}` }
  const status = text(task.status), phase = text(task.error || task.phase, '任务进度已保存')
  const due = typeof task.notBefore === 'string' ? Date.parse(task.notBefore) : NaN
  if (['queued', 'running'].includes(status) && task.asrProcessing === true)
    return { status: '转写中', message: phase }
  if (['failed', 'blocked', 'cancelled', 'succeeded'].includes(status) &&
    ['import', 'transcribe', 'prepare_source'].includes(text(task.kind || task.type)) &&
    task.sourceDiscarded !== true && task.sourceDeliveryComplete === true && object(task.currentDelivery).complete === true)
    return { status: '内容已就绪', message: '当前作品已完成采集；历史任务与运行记录保留' }
  if (status === 'blocked' && task.phase === '等待派生任务确认' && task.attempt === 0)
    return { status: '待确认', message: phase }
  if (['failed', 'blocked', 'cancelled'].includes(status)) {
    const recovery = object(task.recovery)
    if (recovery.code === 'source_requote' && recovery.retry === true) return { status: '待确认', message: text(recovery.hint, phase) }
    if (recovery.code === 'receipt_required') return { status: '请求结果待核实', message: text(recovery.hint, phase) }
    if (recovery.code === 'resumable' && recovery.retry === true) return { status: '需恢复', message: text(recovery.hint, phase) }
  }
  if (status === 'queued' && Number.isFinite(due) && due > now) {
    const schedule = `计划于 ${scheduleTime.format(due)}（北京时间）执行`
    return { status: '等待计划时间', message: phase === '等待处理' || phase === '任务进度已保存' ? schedule : `${phase}；${schedule}` }
  }
  return { status: statusNames[status] || status, message: phase }
}


/** Leaving a historical task for its material must not pin the old error to the reader. */
export function studioTaskSelectionAfterNavigation(taskId: string, task: RecordData | null) {
  return task && ['succeeded', 'failed', 'blocked', 'cancelled'].includes(text(task.status)) ? '' : taskId
}
