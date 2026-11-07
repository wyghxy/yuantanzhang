'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { RadarStatus } from '@/components/admin/RadarUI'
import { opportunitySources } from '@/lib/intelligence-opportunities'
import CreationDeskOpportunityCard from './CreationDeskOpportunityCard'
import type { CreationOpportunity } from './CreationDeskTypes'

export default function CreationListOpportunity({ opportunity, busy, edit, create, changeStatus }: { opportunity: CreationOpportunity; busy: boolean; edit: () => void; create: () => void; changeStatus: (status: string, reason?: string) => Promise<boolean> }) {
  const [expanded, setExpanded] = useState(false)
  const sources = opportunitySources(opportunity)
  const accepted = ['accepted', 'selected'].includes(opportunity.status)
  const canCreate = accepted && sources.length > 0 && sources.every((source) => source.status === 'verified') && !['expired', 'archived'].includes(opportunity.eventCluster?.status ?? '')
  const project = opportunity.projects[0]
  return <article className={`creation-list-topic${expanded ? ' is-expanded' : ''}`}>
    <div className="creation-list-row">
      <span className="creation-list-file-icon" aria-hidden="true"><Lightbulb size={16} /></span>
      <div className="creation-list-row-main"><button type="button" className="creation-list-title" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`topic-details-${opportunity.id}`} title={opportunity.title}>{opportunity.title}</button><div className="creation-list-meta"><span title={sources.map((source) => source.title).join(' / ')}>{sources.length ? `${sources.length} 条参考来源` : '自主选题'}</span><span>{opportunity.ranking.totalScore === null ? '未评分' : `排序分 ${opportunity.ranking.totalScore.toFixed(1)}`}</span><span className="creation-list-angle" title={opportunity.angle}>{opportunity.angle}</span></div></div>
      <RadarStatus status={opportunity.status} />
      <div className="creation-list-row-actions">
        <button type="button" className="radar-ghost-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`topic-details-${opportunity.id}`}>{expanded ? '收起' : '详情'}<ChevronDown size={12} /></button>
        {project ? <Link className="radar-primary-button" href={`/workspace/creation/${project.id}`}>去二创</Link> : canCreate ? <button type="button" className="radar-primary-button" disabled={busy} onClick={create}>去二创</button> : <button type="button" className="radar-ghost-button" disabled={busy} onClick={edit}>编辑选题</button>}
      </div>
    </div>
    <div id={`topic-details-${opportunity.id}`} className="creation-list-topic-details" hidden={!expanded}><CreationDeskOpportunityCard opportunity={opportunity} busy={busy} edit={edit} create={create} changeStatus={changeStatus} /></div>
  </article>
}
