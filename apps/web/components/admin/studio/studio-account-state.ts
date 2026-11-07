import { object, text, type RecordData, type RecordItem } from './studio-client'

export function studioAccountCaptureTask(account: RecordItem, local?: RecordData): RecordData {
  const saved = object(account.collection)
  if (!local) return saved
  const savedTime = Date.parse(text(saved.updatedAt)) || 0
  const localTime = Date.parse(text(local.updatedAt)) || 0
  if (text(saved.taskId) === text(local.id)) {
    // A completed list-fetch task cannot overwrite its live body/fee projection.
    if (saved.completion && saved.taskStatus === local.status) return { ...local, ...saved }
    return savedTime >= localTime ? { ...local, ...saved } : { ...local }
  }
  return savedTime > localTime ? saved : local
}

export function studioAccountCaptureNotice(task: RecordData) {
  const completion = object(task.completion)
  if (task.kind === 'collect_creator' && completion.state) {
    const listing = completedKnownListing(task)
    if (completion.state === 'complete' && completion.total === 0 && listing)
      return listing.selectedCount === listing.requestedCount
        ? `已检查最新 ${listing.selectedCount} 条，其中 ${listing.alreadySavedCount} 条已收录，无需重复采集。`
        : `已检查最新 ${listing.requestedCount} 条范围，本次返回 ${listing.selectedCount} 条且均已收录，无需重复采集。`
    const total = typeof completion.total === 'number' ? completion.total : null
    const ready = Number(completion.ready || 0), noSpeech = Number(completion.noSpeech || 0)
    const progress = total === null ? '正在核实本次正文完成情况' : total === 0
      ? completion.state === 'complete' ? '本次未发现需收录的新作品' : '正在获取作品列表'
      : `${task.sourceOnly === true ? '内容已收录' : '正文已就绪'} ${ready}/${total}${noSpeech ? `，${noSpeech} 条未识别到人声` : ''}`
    if (task.receiptPending) return `${progress}；原请求结果待核实，请查看采集任务`
    if (completion.state === 'processing') return `${progress}；正在处理`
    if (completion.state === 'needs_attention') return `${progress}；${Number(completion.pending) > 0 ? `${completion.pending} 条正文未完成` : '采集仍有未完成项'}，请查看采集任务`
    return `${progress}；采集完成`
  }
  if (task.status === 'queued') return '任务已入队，等待采集'
  if (task.status === 'running') return task.kind === 'resolve_creator' ? '正在获取账号资料' : '正在采集最新作品'
  if (task.status === 'succeeded') return task.kind === 'resolve_creator' ? '资料获取任务已完成' : '作品列表已获取，正在核对正文完成情况'
  if (task.status === 'cancelled') return '采集已停止，已保存的作品会保留'
  return text(task.error) || text(object(task.error).message) || '采集未完成，请查看任务记录'
}

function completedKnownListing(task: RecordData) {
  if (task.receiptPending === true) return null
  const listing = object(task.listing)
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100
  if (!valid(listing.requestedCount) || !valid(listing.selectedCount) || !valid(listing.alreadySavedCount) ||
      listing.selectedCount < 1 || listing.selectedCount > listing.requestedCount ||
      listing.alreadySavedCount !== listing.selectedCount || listing.returnedCount !== 0) return null
  return { requestedCount: listing.requestedCount, selectedCount: listing.selectedCount, alreadySavedCount: listing.alreadySavedCount }
}

type AccountAttentionTask = {
  taskId: string; materialId: string | null; label: string; reason: string
}

export function studioAccountAttention(task: RecordData) {
  const parentId = text(task.taskId || task.id)
  const parentSucceeded = text(task.taskStatus || task.status) === 'succeeded'
  const raw = Array.isArray(task.attentionTasks) ? task.attentionTasks : []
  const tasks: AccountAttentionTask[] = []
  const seen = new Set<string>()
  for (const value of raw.slice(0, 20)) {
    const item = object(value), taskId = typeof item.taskId === 'string' ? item.taskId : ''
    const verifiedParentReceipt = item.reason === 'receipt_pending' && task.diagnosticTaskId === taskId
      && task.attentionTaskCount === 1 && raw.length === 1 && task.attentionTasksTruncated !== true
    if (!taskId || !['receipt_pending', 'task_failed', 'delivery_incomplete'].includes(text(item.reason))
      || seen.has(taskId) || (parentSucceeded && taskId === parentId && !verifiedParentReceipt)) continue
    seen.add(taskId)
    const label = item.reason === 'receipt_pending' ? '原请求待核实'
      : item.reason === 'task_failed' ? '任务失败或中断' : '视频或正文尚未完整交付'
    tasks.push({ taskId, materialId: typeof item.materialId === 'string' ? item.materialId || null : null, label, reason: text(item.reason) })
  }
  const declaredCount = typeof task.attentionTaskCount === 'number' && Number.isSafeInteger(task.attentionTaskCount)
    && task.attentionTaskCount >= 0 ? task.attentionTaskCount : tasks.length
  const count = Math.max(declaredCount, tasks.length)
  const truncated = task.attentionTasksTruncated === true || raw.length > 20 || count > tasks.length
  const materialIds = Array.isArray(task.incompleteMaterialIds)
    ? [...new Set(task.incompleteMaterialIds.filter((id): id is string => typeof id === 'string' && !!id))].slice(0, 20) : []
  const visible = tasks.length > 0 || materialIds.length > 0 || !!text(task.incompleteReason)
    || ['failed', 'blocked', 'cancelled'].includes(text(task.status)) || task.receiptPending === true
    || object(task.completion).state === 'needs_attention'
  const incompleteReason = text(task.incompleteReason)
    || (visible && !tasks.length ? '采集尚未完整交付，当前没有可定位的任务记录，请查看已采集作品。' : '')
  // The parent ID describes the batch. Only a validated diagnostic target may open a log.
  const diagnosticTaskId = count === 1 && tasks.length === 1 && !truncated
    && task.diagnosticTaskId === tasks[0].taskId ? tasks[0].taskId : ''
  return { visible, tasks, count, truncated, diagnosticTaskId, incompleteReason, materialIds }
}

export function studioAccountState(account: RecordItem) {
  const task = object(account.collection), status = text(task.status)
  const active = ['queued', 'running'].includes(status)
  const scheduled = status === 'queued' && Date.parse(text(task.notBefore)) > Date.now()
  const spinning = active && !scheduled && task.receiptPending !== true
  const failed = ['failed', 'blocked', 'cancelled'].includes(status)
  const verified = account.metadataVerified === true
  const profile = task.kind === 'resolve_creator'
  const receiptPending = task.receiptPending === true
  const quota = object(task.collectionQuota)
  const captureCountLimit = quota.member === false ? 1 : 100
  const dailyBlocked = quota.member === false && ['used', 'processing'].includes(text(quota.state))
  const dailyHint = text(quota.hint)
  const access = object(task.captureAccess)
  const captureBlocked = ['receipt_required', 'configuration_required'].includes(text(access.state))
    || access.state !== 'ready' && receiptPending
  const captureTaskId = captureBlocked ? ['receipt_required', 'configuration_required'].includes(text(access.state))
    ? text(access.taskId) : studioAccountAttention(task).diagnosticTaskId : ''
  const recaptureTaskId = captureBlocked && text(access.recaptureTaskId) === captureTaskId ? captureTaskId : ''
  const captureHint = text(access.hint) || (captureBlocked ? '原请求结果尚未核实，请查看对应采集任务；不会重复发起。' : '')
  const completion = object(task.completion)
  const checkedKnown = completion.state === 'complete' && completion.total === 0 ? completedKnownListing(task) : null
  const label = receiptPending ? '采集结果待核实' : active ? (status === 'queued' ? '等待采集' : profile ? '正在获取资料' : '正在采集作品')
    : failed ? (profile ? '资料获取失败' : '作品采集未完成')
      : completion.state === 'complete' ? '作品采集完成'
      : verified ? '资料已获取' : status === 'succeeded' ? '资料待补全' : '已保存 · 未获取资料'
  const message = completion.state ? studioAccountCaptureNotice(task)
    : receiptPending ? '原请求的结果仍待核实，暂不重复提交，已保存的作品和运行记录会保留。'
    : text(task.error) || text(object(task.error).message) || (active ? text(task.phase, '任务已排队，完成后自动更新。')
    : verified ? '' : '尚未取得平台资料，可点击“获取资料”开始；平台未提供的字段会保留为空。')
  const total = typeof completion.total === 'number' && Number.isSafeInteger(completion.total) && completion.total >= 0 ? completion.total : null
  const ready = typeof completion.ready === 'number' && Number.isSafeInteger(completion.ready) && completion.ready >= 0 ? completion.ready : 0
  const progress = total !== null && total > 0 ? `${task.sourceOnly === true ? '内容已收录' : '正文已就绪'} ${Math.min(ready, total)}/${total}${task.sourceOnly === true ? ' · 未AI转写' : ''}` : ''
  const compactLabel = [receiptPending ? recaptureTaskId ? '抓取未完成' : '结果待核实' : scheduled ? '等待计划时间' : active ? status === 'queued' ? '排队中' : profile ? '正在获取资料' : '采集中'
    : failed ? '采集已暂停' : checkedKnown ? `已检查 ${checkedKnown.selectedCount} 条 · 均已收录` : completion.state === 'complete' ? '采集完成' : label, progress].filter(Boolean).join(' · ')
  return { task, active, scheduled, spinning, failed, verified, receiptPending, captureBlocked, captureTaskId, recaptureTaskId, captureHint, captureCountLimit, dailyBlocked, dailyHint,
    label, compactLabel, message, attention: studioAccountAttention(task) }
}

export function studioSavedCollectionNotice(kind: string, result: Record<string, unknown>) {
  const prefix = kind === 'accounts' ? '对标已保存' : '素材已保存'
  if (result.taskError) return `${prefix}，未能开始采集：${text(result.taskError)}`
  const task = object(result.task), state = text(task.status)
  if (['queued', 'running'].includes(state)) return `${prefix}，${kind === 'accounts' ? '资料获取' : '正文获取'}任务已入队`
  if (task.id && ['failed', 'blocked', 'cancelled'].includes(state)) return `${prefix}，上次采集未完成，请查看记录中的原因`
  if (result.duplicate) return '已定位已有记录'
  if (object(result.item).status === 'ready') return `${prefix}，正文已就绪`
  return `${prefix}，尚未开始采集`
}
