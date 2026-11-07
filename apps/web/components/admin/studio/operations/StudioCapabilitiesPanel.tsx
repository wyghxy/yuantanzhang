'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { list, object, text, type RecordData } from '../studio-client'
import { studioDateTime, studioTaskNames } from '../studio-operations-utils'
import { capabilityEvidenceTime, workspaceCapabilitySummary } from './studio-capability-presentation'
import styles from './StudioCapabilities.module.css'

const services = [
  ['model', '写作模型'], ['asr', '语音转写'],
  ['storage', '素材存储'], ['media', '媒体处理'],
] as const
const capabilityLabels: Record<string, string> = {
  model: '写作模型', ai: '写作模型', asr: '语音转写', storage: '素材存储', media: '媒体处理',
  douyin: '抖音', bili: 'B站', bilibili: 'B站', xiaohongshu: '小红书', youtube: 'YouTube', tiktok: 'TikTok', wechat_official: '公众号',
}
const operationLabels: Record<string, string> = { ...studioTaskNames, work: '作品采集', profile: '博主资料', subscription: '订阅更新' }

export function StudioCapabilitiesPanel({ data }: { data: RecordData | null }) {
  const receipts = list(data?.businessReceipts)
  const row = (entry: RecordData, key: string, label: string) => {
    const summary = workspaceCapabilitySummary(entry)
    const observedAt = capabilityEvidenceTime(entry)
    return <details className={styles.row} key={key} name="capability-detail">
      <summary>
        <span className={styles.name}>{label}</span>
        <span className={styles.status} data-tone={summary.tone}>{summary.label}</span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </summary>
      <div className={styles.detail}>
        <p>{summary.reason}</p>
        <p className={styles.hint}>{summary.next}</p>
        <div className={styles.detailFoot}>
          <span className={styles.hint}>{observedAt ? `最近记录 ${studioDateTime(observedAt)}` : '暂无任务记录'}</span>

        </div>
      </div>
    </details>
  }
  return <div className={styles.content}>
    <div className={styles.statusPanel}>
      <section aria-labelledby="capability-services-title" className={styles.group}>
        <h3 id="capability-services-title">基础服务</h3>
        <div className={styles.rows}>
          {services.map(([key, label]) => row(object(data?.[key]), key, label))}
        </div>
      </section>
      <section aria-labelledby="capability-platforms-title" className={styles.group}>
        <h3 id="capability-platforms-title">内容平台</h3>
        <div className={styles.rows}>
          {list(data?.platforms).map(entry => row(entry, text(entry.platform), capabilityLabels[text(entry.platform)] || '内容平台'))}
          {data && !list(data.platforms).length && <p className={styles.empty}>暂无平台状态</p>}
        </div>
      </section>
    </div>
    <details className={styles.records}>
      <summary>任务记录<ChevronDown className={styles.chevron} size={16} aria-hidden="true" /></summary>
      <div className={styles.recordBody}>
        <h3>已验证的功能</h3>
        {receipts.length ? <ul>{receipts.map((entry, index) => <li key={`${text(entry.capability)}:${text(entry.operation)}:${index}`}>
          <strong>{capabilityLabels[text(entry.capability).replace(/^platform:/, '')] || '服务'} · {operationLabels[text(entry.operation)] || '业务任务'}</strong>
          <span>{studioDateTime(entry.verifiedAt)}</span>
          {text(entry.taskId) && <Link href={`/workspace/viral?view=tasks&task=${encodeURIComponent(text(entry.taskId))}`}>查看任务</Link>}
        </li>)}</ul> : <p className={styles.hint}>暂无任务验证记录</p>}
        {data?.businessReceiptStale === true && <p className={styles.hint}>服务已更新，历史记录仅供参考。</p>}
      </div>
    </details>
  </div>
}
