import { object, text, type RecordData } from './studio-client'

export const studioTaskNames: Record<string, string> = {
  cover: '补齐作品封面',
  prepare_source: '提取文字逐字稿', prepare_player: '准备视频播放', comments: '采集评论', assistant: '创作助手', video_edit: '视频剪辑',
  classify: '识别链接', resolve_creator: '读取博主资料', collect_creator: '采集对标作品', import: '导入作品',
  transcribe: '语音转写', analyze: '内容拆解', draft: '生成初稿', rewrite: '修改文案', storyboard: '生成分镜',
  metrics: '读取指标', report: '生成报告', export: '导出稿件', connection_check: '连接检查', verify_model: '验证旗舰模型参数', cleanup_audio: '清理临时音频',
}
export const studioCapabilityStates: Record<string, string> = {
  article_unverified: '文章导入待验收', not_configured: '尚未配置', configured_unverified: '已配置，待验证', invalid_configuration: '配置有误',
  read_only_connected: '只读连接成功', ready: '已准备', source_checked: '网络检查已完成',
  connection_failed: '连接失败', connection_expired: '验证记录已过期，当前状态待更新（不代表欠费或连接失败）', business_verified: '真实业务验收通过',
  real_task_passed: '真实任务通过', business_partial: '部分真实任务通过', configuration_changed: '配置已变更，需重新检查',
}
export const studioTerminalStates = ['succeeded', 'failed', 'blocked', 'cancelled']
export const studioNetworkStates: Record<string, string> = {
  not_checked: '网络尚未验证', reachable: '公开首页可达', empty_response: '站点返回空响应',
  configuration_error: '网络配置有误', restricted: '平台限制访问', http_error: '平台返回错误',
  timeout: '连接超时', dns_policy_blocked: '域名解析地址被安全规则拦截', connection_failed: '网络连接失败',
}
export function studioCapabilityBadge(value: unknown) {
  const row = object(value), state = text(row.state)
  const labels: Record<string, string> = {
    real_task_passed: '已验证', business_verified: '已验证', business_partial: '部分通过',
    configuration_changed: '需重检', connection_expired: '待更新', connection_failed: '连接失败', invalid_configuration: '配置有误',
    not_configured: '待配置', read_only_connected: row.platform ? '网络可达' : '连接通过', source_checked: '网络可达', article_unverified: '待验收',
  }
  return labels[state] || (row.connected ? '待验收' : '待检查')
}
export const studioPlatforms = [
  { key: 'douyin', label: '抖音', symbol: '抖', icon: 'dy-icon' },
  { key: 'bili', label: 'B站', symbol: 'B', icon: 'bili-icon' },
  { key: 'xiaohongshu', label: '小红书', symbol: '红', icon: 'xhs-icon' },
  { key: 'tiktok', label: 'TikTok', symbol: 'TK', icon: '' },
  { key: 'youtube', label: 'YouTube', symbol: 'YT', icon: 'yt-icon' },
  { key: 'wechat_official', label: '公众号', symbol: '公', icon: 'wechat-icon' },
  { key: 'wechat_channels', label: '视频号', symbol: '视', icon: '' },
  { key: 'kuaishou', label: '快手', symbol: '快', icon: '' },
] as const

/** A reconnect can replay events. Keep the real sequence order and the latest bounded log window. */
export function mergeStudioEvents(previous: RecordData[], incoming: RecordData[], limit = 500): RecordData[] {
  const bySequence = new Map<number, RecordData>()
  for (const event of [...previous, ...incoming]) {
    const seq = Number(event.seq)
    if (Number.isSafeInteger(seq) && seq > 0) bySequence.set(seq, event)
  }
  return [...bySequence.entries()].sort(([a], [b]) => a - b).slice(-limit).map(([, event]) => event)
}
export function studioEventCursor(events: RecordData[]) {
  return events.reduce((cursor, event) => Number.isSafeInteger(Number(event.seq)) && Number(event.seq) > cursor ? Number(event.seq) : cursor, 0)
}
export function studioTaskLabel(task: RecordData) {
  const input = object(task.input), day = Number(task.followupDays ?? input.followupDays)
  return text(task.kind) === 'metrics' && [3, 7].includes(day) ? `T+${day} 指标回访` : studioTaskNames[text(task.kind)] || text(task.kind, '任务')
}
/** Discovery is one step; its success does not prove video/transcript delivery. */
export function studioDiscoveryCompletion(task: RecordData) {
  if (task.status !== 'succeeded') return null
  const kind = text(task.kind)
  if (kind === 'classify') return { label: '链接识别完成', hint: '仅完成链接识别，素材正文与视频另行采集。' }
  if (kind === 'resolve_creator') return { label: '博主资料已读取', hint: '仅完成博主资料读取，作品正文与视频另行采集。' }
  if (kind === 'collect_creator') {
    const result = task.discovery ? object(task.discovery) : object(task.result), coverage = object(result.coverage)
    const count = coverage.returnedCount
    const observed = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 &&
      typeof coverage.scannedCount === 'number' && Number.isSafeInteger(coverage.scannedCount) && coverage.scannedCount >= count
    const label = observed && count > 0 ? `发现 ${count} 条作品`
      : observed && count === 0 && result.complete === true && result.hasMore !== true && !result.nextCursor &&
        coverage.unknownDates === 0 && coverage.omittedCount === 0
        ? '已检查，无新作品' : '作品列表已读取'
    return { label, hint: '新作品按本批设置继续获取正文与视频；本批交付状态请在对标账号查看。' }
  }
  return null
}
export function studioKnownNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
export function studioCount(value: unknown) { const number = studioKnownNumber(value); return number === null ? '—' : number.toLocaleString('zh-CN') }
export function studioDateTime(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '时间未知'
}
export function studioSafeUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  if (/^\/api\/(admin|workspace)\/studio\/assets\/covers\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value)) return value.replace('/api/admin/', '/api/workspace/')
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
