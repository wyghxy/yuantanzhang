/** Interaction counts belong to the selected publication, never its shared body. */
export function collectionMetricValue(value: unknown): string {
  const count = typeof value === 'string' && /^\d{1,16}$/.test(value.trim()) ? Number(value.trim()) : value
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
    ? new Intl.NumberFormat('zh-CN').format(count) : '—'
}

const fields = [
  ['views', '播放 / 阅读'], ['likes', '点赞'], ['comments', '评论'], ['saves', '收藏'], ['shares', '分享'],
] as const

export function collectionMetricFacts(material: { platform?: unknown; metrics?: unknown; metricsObservedAt?: unknown; metricsObservedTimes?: unknown }) {
  const metrics = material.metrics && typeof material.metrics === 'object' && !Array.isArray(material.metrics)
    ? material.metrics as Record<string, unknown> : {}
  const times = material.metricsObservedTimes && typeof material.metricsObservedTimes === 'object' && !Array.isArray(material.metricsObservedTimes)
    ? material.metricsObservedTimes as Record<string, unknown> : {}
  const wechatFields = [['recommendations', '在看'], ['stars', '星标 / 喜欢'], ['electedComments', '精选评论']] as const
  const selected = material.platform === 'wechat_official'
    ? [...fields, ...wechatFields.filter(([key]) => collectionMetricValue(metrics[key]) !== '—')] : fields
  return selected.map(([key, label]) => {
    const value = collectionMetricValue(key === 'saves' ? metrics.saves ?? metrics.favorites : metrics[key])
    return { key, label, value, observedLabel: value === '—' ? '' : collectionMetricsObservedLabel(times[key] || material.metricsObservedAt) }
  })
}

export function collectionMetricsObservedLabel(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }) : ''
}
