'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { creationRequest, type CreationOpportunity } from './CreationDeskTypes'

export default function CreationDeskProjectForm({ opportunity, cancel }: { opportunity: CreationOpportunity; cancel: () => void }) {
  const router = useRouter(), pending = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const body = { ...Object.fromEntries(new FormData(event.currentTarget)), opportunityId: opportunity.id, facts: [], inferences: [], disputes: [] }
      const result = await creationRequest<{ project: { id: number } }>('/api/workspace/content-projects', 'POST', body)
      router.push(`/workspace/creation/${result.project.id}`); router.refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : '创建失败'); pending.current = false; setBusy(false) }
  }
  return <form className="radar-panel space-y-4" onSubmit={submit} aria-busy={busy}>
    <div><h2 className="text-base font-semibold">建立内容项目</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">机会：{opportunity.title}。先保存未确认母稿，再到项目详情补充事实来源、推断和争议并人工确认。</p></div>
    <fieldset disabled={busy} className="space-y-4">
      <label className="radar-field"><span>项目与首稿标题</span><input name="title" maxLength={240} required defaultValue={opportunity.title} /></label>
      <label className="radar-field"><span>母稿正文（至少 50 字）</span><textarea name="scriptBody" required minLength={50} maxLength={20000} rows={10} /></label>
      <label className="radar-field"><span>时效风险与复核说明</span><textarea name="timelinessRisk" maxLength={2000} rows={2} /></label>
      <div className="flex flex-wrap gap-3"><button className="radar-primary-button" type="submit">{busy ? '建立中…' : '建立项目并编辑母稿'}</button><button type="button" className="radar-ghost-button" onClick={cancel}>取消</button></div>
    </fieldset><p role="status" aria-live="polite" className="text-sm text-[var(--ui-danger)]">{error}</p>
  </form>
}
