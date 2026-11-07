'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { RadarStatus } from '@/components/admin/RadarUI'
import { opportunitySources } from '@/lib/intelligence-opportunities'
import type { CreationOpportunity } from './CreationDeskTypes'

export default function CreationDeskOpportunityCard({ opportunity, busy, edit, create, changeStatus }: { opportunity: CreationOpportunity; busy: boolean; edit: () => void; create: () => void; changeStatus: (status: string, reason?: string) => Promise<boolean> }) {
  const [rejecting, setRejecting] = useState(false)
  const sources = opportunitySources(opportunity)
  const canCreate = sources.length > 0 && sources.every((source) => source.status === 'verified') && !['expired', 'archived'].includes(opportunity.eventCluster?.status ?? '')
  const accepted = ['accepted', 'selected'].includes(opportunity.status)
  async function reject(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (await changeStatus('rejected', String(new FormData(event.currentTarget).get('reason')))) setRejecting(false) }
  return <article className="rounded-xl border border-border p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><RadarStatus status={opportunity.status} /><span className="text-sm text-muted-foreground">{opportunity.ranking.totalScore === null ? '未评分' : `排序分 ${opportunity.ranking.totalScore.toFixed(1)}`}</span></div>
    <h3 className="mt-3 text-lg font-medium leading-7">{opportunity.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{opportunity.angle}</p>
    {opportunity.audienceValue && <p className="mt-2 text-sm leading-6 text-muted-foreground">受众价值：{opportunity.audienceValue}</p>}
    {opportunity.reason && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">决策记录：{opportunity.reason}</p>}
    <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>人工基础分：{opportunity.ranking.baseScore?.toFixed(1) ?? '未评分'} · 已填 {opportunity.ranking.scoreCount}/5 维 · 策略调整 {opportunity.ranking.strategyBonus > 0 ? '+' : ''}{opportunity.ranking.strategyBonus}</p>{opportunity.ranking.matchedRules.length ? <ul className="space-y-1">{opportunity.ranking.matchedRules.map((rule) => <li key={rule.id}>匹配策略 #{rule.id}「{rule.title}」：{rule.priority > 0 ? '+' : ''}{rule.priority}</li>)}</ul> : <p>没有匹配的已确认且启用策略。</p>}</div>
    <details className="mt-3 rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">来源与不确定性 · {sources.length} 条</summary><div className="mt-3 space-y-3">{sources.length ? sources.map((source) => <div key={source.id} className="flex flex-wrap items-center gap-2"><RadarStatus status={source.status} /><a className="min-w-0 break-words text-primary underline underline-offset-4" href={source.url} rel="noreferrer" target="_blank">{source.title}</a></div>) : <p className="text-muted-foreground">尚未关联来源，暂不能建立事实型项目。</p>}{opportunity.eventCluster && <p className="whitespace-pre-wrap text-muted-foreground">事件「{opportunity.eventCluster.title}」 · 冲突说明：{opportunity.eventCluster.conflictNotes || '尚未填写，不能据此认定没有争议'}</p>}</div></details>
    {accepted && !canCreate && !opportunity.projects.length && <p className="mt-3 text-sm leading-6 text-[var(--ui-warning)]">请先到情报页核实全部来源，并复核已过期或归档事件。</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="radar-ghost-button" onClick={edit} disabled={busy}>编辑机会</button>
      {!accepted && <button className="radar-primary-button" disabled={busy} onClick={() => void changeStatus('accepted')}>接受机会</button>}
      {!opportunity.projects.length && opportunity.status !== 'rejected' && <button className="radar-ghost-button" disabled={busy} onClick={() => setRejecting(true)}>拒绝并记录理由</button>}
      {opportunity.status === 'rejected' && <button className="radar-ghost-button" disabled={busy} onClick={() => void changeStatus('proposed')}>重新提出</button>}
      {accepted && !opportunity.projects.length && <button className="radar-primary-button" disabled={busy || !canCreate} onClick={create}>建立内容项目</button>}
      {opportunity.projects.map((project) => <Link key={project.id} className="radar-primary-button" href={`/workspace/creation/${project.id}`}>继续项目：{project.title}</Link>)}
    </div>
    {rejecting && <form onSubmit={reject} className="mt-4 space-y-3"><label className="radar-field"><span>拒绝理由</span><textarea autoFocus name="reason" required maxLength={4000} rows={3} defaultValue={opportunity.reason ?? ''} disabled={busy} /></label><div className="flex gap-2"><button type="submit" disabled={busy} className="radar-primary-button">保存拒绝</button><button type="button" disabled={busy} onClick={() => setRejecting(false)} className="radar-ghost-button">取消</button></div></form>}
  </article>
}
