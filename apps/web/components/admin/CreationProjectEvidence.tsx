'use client'
import {useState} from 'react'
import {externalCapabilityNotice} from './studio/personal-actions'
import { displayBeijingTime } from '@/lib/creation-time'
import { RadarStatus } from '@/components/admin/RadarUI'
import type { CreationProjectData } from '@/lib/creation-types'

const platforms: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', wechat_channels: '视频号', bilibili: 'B站', kuaishou: '快手', wechat: '公众号', wechat_official: '公众号', x: 'X' }

export default function CreationProjectEvidence({ project }: { project: CreationProjectData }) {
  const [unavailable,setUnavailable]=useState(false)
  const opportunity = project.opportunity
  const sources = [...new Map([...(opportunity?.sourceItem ? [opportunity.sourceItem] : []), ...(opportunity?.eventCluster?.items.map((item) => item.sourceItem) || [])].map((source) => [source.id, source])).values()]
  return <aside className="space-y-5">
    <section className="radar-panel"><h2 className="font-medium">创作方向与来源</h2>
      {opportunity ? <><p className="mt-3 text-sm font-medium">{opportunity.title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{opportunity.angle}</p></> : <p className="mt-3 text-sm leading-6 text-muted-foreground">尚未关联创作机会。母稿事实仍须逐条选择可追溯来源。</p>}
      {opportunity?.eventCluster && <div className="mt-4 rounded-lg border border-border p-3"><p className="text-sm">事件组：{opportunity.eventCluster.title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ui-warning)]">冲突说明：{opportunity.eventCluster.conflictNotes || '尚未记录来源冲突说明'}</p></div>}
      <ul className="mt-4 space-y-4">{sources.map((source) => <li key={source.id} className="border-t border-border pt-3"><div className="flex flex-wrap gap-2"><RadarStatus status={source.status} /><span className="text-sm text-muted-foreground">#{source.id}</span></div><a href={source.url} target="_blank" rel="noreferrer" className="mt-2 block break-words py-2 text-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{source.title}</a><p className="text-sm text-muted-foreground">原始时间（北京时间）：{source.originalAt ? displayBeijingTime(source.originalAt) : '未提供'}</p>{source.evidenceNotes && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">证据：{source.evidenceNotes}</p>}</li>)}</ul>
    </section>
    <section className="radar-panel"><h2 className="font-medium">平台版本</h2>{project.variants.length ? <ul className="mt-3 space-y-3">{project.variants.map((variant) => <li key={variant.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{platforms[variant.platform] || variant.platform} · 来源 v{variant.sourceVersion}</span><RadarStatus status={variant.status} /></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-muted-foreground">母稿确认后，在发布工作台建立与编辑平台稿。</p>}<button type="button" className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>setUnavailable(true)}>前往发布工作台</button>{unavailable&&<p role="status">{externalCapabilityNotice}</p>}</section>
    <section className="radar-panel"><h2 className="font-medium">发布历史</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">每条记录保留当时的母稿版本与发布快照。</p>{project.publishRecords.length ? <ul className="mt-3 space-y-3">{project.publishRecords.map((record) => <li key={record.id} className="border-t border-border pt-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{platforms[record.platform] || record.platform} · {record.sourceVersion === null ? '旧记录未留版本' : `v${record.sourceVersion}`}</span><RadarStatus status={record.status} /></div><p className="mt-2 text-muted-foreground">{record.publishedAt ? displayBeijingTime(record.publishedAt) : '未记录发布时间'}</p>{record.externalUrl && <a className="mt-1 inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={record.externalUrl} target="_blank" rel="noreferrer">查看原作</a>}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">还没有发布记录。</p>}</section>
  </aside>
}

