'use client'

import { FormEvent, useRef, useState } from 'react'
import { opportunityScoreFields, opportunityScoreLabels } from '@/lib/intelligence-opportunities'
import { creationRequest, type CreationCluster, type CreationOpportunity, type CreationSource } from './CreationDeskTypes'

export default function CreationDeskOpportunityForm({ opportunity, sources, clusters, saved, cancel }: { opportunity: CreationOpportunity | null; sources: CreationSource[]; clusters: CreationCluster[]; saved: () => void; cancel: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    const values = new FormData(event.currentTarget)
    const scores = Object.fromEntries(opportunityScoreFields.map((field) => [field, values.get(field) === '' ? null : Number(values.get(field))]))
    const body = { ...Object.fromEntries(values), ...scores, hookIdeas: String(values.get('hookIdeas') || '').split('\n').map((line) => line.trim()).filter(Boolean) }
    try { await creationRequest(`/api/workspace/content-opportunities${opportunity ? `/${opportunity.id}` : ''}`, opportunity ? 'PATCH' : 'POST', body); saved() }
    catch (failure) { setError(failure instanceof Error ? failure.message : '保存机会失败') }
    finally { pending.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="radar-panel space-y-4" aria-busy={busy}>
    <div><h2 className="text-base font-semibold">{opportunity ? '编辑机会' : '提出创作机会'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">记录创作判断，可先不关联来源。转为事实型项目之前，必须核实全部关联来源。</p></div>
    <fieldset disabled={busy} className="space-y-4">
      <label className="radar-field"><span>标题</span><input name="title" required maxLength={240} defaultValue={opportunity?.title} /></label>
      <label className="radar-field"><span>创作角度</span><textarea name="angle" required maxLength={2000} rows={3} defaultValue={opportunity?.angle} /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="radar-field"><span>原始情报</span><select name="sourceItemId" defaultValue={opportunity?.sourceItemId ?? ''} disabled={Boolean(opportunity?.projects.length)}><option value="">暂不关联</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.status === 'verified' ? '已核实' : '待复核'} · {source.title}</option>)}</select>{Boolean(opportunity?.projects.length) && <input type="hidden" name="sourceItemId" value={opportunity?.sourceItemId ?? ''} />}</label>
        <label className="radar-field"><span>多来源事件</span><select name="eventClusterId" defaultValue={opportunity?.eventClusterId ?? ''} disabled={Boolean(opportunity?.projects.length)}><option value="">暂不关联</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.title} · {cluster.items.length} 条来源</option>)}</select>{Boolean(opportunity?.projects.length) && <input type="hidden" name="eventClusterId" value={opportunity?.eventClusterId ?? ''} />}</label>
      </div>
      <label className="radar-field"><span>受众价值</span><textarea name="audienceValue" rows={2} maxLength={2000} defaultValue={opportunity?.audienceValue ?? ''} /></label>
      <label className="radar-field"><span>判断与决策理由</span><textarea name="reason" rows={3} maxLength={4000} defaultValue={opportunity?.reason ?? ''} placeholder="为什么值得做、证据局限与拒绝理由" /></label>
      <label className="radar-field"><span>开头候选（每行一条，最多 20 条）</span><textarea name="hookIdeas" rows={3} defaultValue={Array.isArray(opportunity?.hookIdeas) ? opportunity.hookIdeas.filter((item): item is string => typeof item === 'string').join('\n') : ''} /></label>
      <div><p className="mb-3 text-sm text-muted-foreground">人工评分 · 0–100，可留空；基础分为已填写维度平均值</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{opportunityScoreFields.map((field, index) => <label key={field} className="radar-field"><span>{opportunityScoreLabels[index]}</span><input type="number" name={field} min={0} max={100} step={1} defaultValue={opportunity?.[field] ?? ''} placeholder="未评分" /></label>)}</div></div>
      <div className="flex flex-wrap gap-3"><button className="radar-primary-button" type="submit">{busy ? '保存中…' : '保存机会'}</button><button className="radar-ghost-button" type="button" onClick={cancel}>取消</button></div>
    </fieldset>
    <p role="status" aria-live="polite" className="text-sm text-[var(--ui-danger)]">{error}</p>
  </form>
}
