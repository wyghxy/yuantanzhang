import { studioMetricFollowupView } from './studio-metric-followup-view'
import { object, text, type RecordData } from './studio-client'

export type TaskControl = 'discard' | 'cancel' | 'retry' | 'recapture' | 'resume-config' | 'dismiss' | 'restore-attention'
export function taskRecovery(row: RecordData) {
  const input = object(row.input), target = object(input.target), kind = text(row.kind), error = text(row.error)
  const receiptPending = row.requestReceiptPending === true || object(row.recovery).code === 'receipt_required'
  const materialId = text(row.sourceMaterialId || input.materialId || input.requestedMaterialId || (target.kind === 'materials' ? target.id : '') ||
    (input.entityKind === 'materials' ? input.entityId || object(input.entitySnapshot).id : '') || object(input.materialSnapshot).id)
  if (row.sourceDiscarded === true) return { materialId, configuration: false, retry: false, resumeConfig: false,
    label: '已删除', hint: '待收录素材已删除，旧任务不能恢复；已提交请求与运行记录保留。',
    title: text(row.capturedTitle || input.title, '已删除的待收录素材') }
  if (materialId && ['import', 'transcribe', 'prepare_source', 'prepare_player'].includes(kind) &&
      object(row.currentDelivery).complete === true) {
    return { materialId, configuration: false, retry: false, resumeConfig: false,
      label: `内容已就绪`,
      hint: `作品内容已经保存，可以打开作品；原任务记录保留，无需重新采集。`,
      title: text(row.capturedTitle || input.title, '未命名作品') }
  }
  // Historical player jobs retain their records, but no user recovery action may
  // submit another duplicate capture or transcription for playback.
  if (kind === 'prepare_player') return { materialId, configuration: false, retry: false, resumeConfig: false,
    ...(object(row.currentMaterial).videoSaved === true ? {
      label: `视频已保存`,
      hint: `播放器只读取已保存视频，可以打开作品播放；原任务的失败记录保留。`,
    } : { hint: /不确定|不明|未确认|核实|原请求/.test(error) || receiptPending
      ? '历史播放请求的结果仍待核实，回执和已完成步骤保留；播放器只读取已保存视频。'
      : `播放器只读取已保存视频，不再重试补抓或转写；视频缺失时仍可打开作品阅读已有文字。` }),
    title: text(row.capturedTitle || input.title, materialId ? '未命名作品' : '历史播放任务') }
  const followup = studioMetricFollowupView(row)
  if (followup?.awaitingAuthorization) return { materialId, configuration: false, resumeConfig: false,
    retry: object(row.recovery).retry !== false, label: followup.status,
    hint: text(object(row.recovery).hint) && object(row.recovery).retry === false ? text(object(row.recovery).hint) : followup.hint,
    title: text(row.capturedTitle || input.title, '作品指标回访') }
  const configuration = /配置|未开通|授权|Key|cookie|登录|连接记录/i.test(error) || kind === 'connection_check'
  const source = /下载|字幕|音频|视频|素材|正文|封面/.test(error)
  const uncertain = /不确定|不明|未确认|核实|原请求/.test(error)
  const obsolete = /已删除|已变化|不存在|迁移保留|旧采集/.test(error)
  const refreshCover = kind === 'cover' && /封面已失效/.test(error)
  const recovery = object(row.recovery)
  const blocked = recovery.retry === false
  const sourceAccount = text(input.accountId || (target.kind === 'accounts' ? target.id : ''))
  const hint = obsolete ? '原事项已变化，这条旧提醒可以移出；运行记录会保留。'
    : uncertain ? '原请求结果尚未确认，请先查看日志核对回执；不要重复发起相同操作。'
      : refreshCover ? '打开作品，点击“补充素材”上传原视频，再回到这里重试提取画面。'
      : configuration ? '先在设置与连接中修正配置，再继续此任务。'
        : kind === 'cover' ? '重试取得平台原封面；也可打开作品，在“补充素材”上传原视频后重试提取画面。'
        : source ? '可重试获取；若来源持续不可用，打开作品补充原文，或重新上传素材。'
          : '可从上次完成的位置重试；不再需要时可移出待处理。'
  return { materialId, configuration: configuration && !blocked,
    hint: `${text(recovery.hint) || hint}`,
    label: text(recovery.label), retry: !obsolete && !blocked && (recovery.retry === true || !uncertain),
    account: ['collect_creator', 'resolve_creator'].includes(kind) ? !!sourceAccount : kind === 'metrics' && blocked,
    resumeConfig: !blocked && configuration && !uncertain && ['import', 'transcribe'].includes(kind),
    title: text(row.capturedTitle || input.title || (['collect_creator', 'resolve_creator'].includes(kind)
      ? object(input.creator).name || object(input.entitySnapshot).name : undefined), materialId ? '未命名作品' : kind === 'connection_check' ? '工作台连接检查' : '未命名任务') }
}
