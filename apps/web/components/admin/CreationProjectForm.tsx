'use client'

import { useRef, useState, type FormEvent } from 'react'
import { creationJson, creationRequest } from '@/lib/creation-client'
import { beijingDateInput, beijingInputToIso } from '@/lib/creation-time'
import type { CreationProjectData } from '@/lib/creation-types'

const statuses = [ ['opportunity', '选题准备'], ['master_script', '母稿编辑'], ['producing', '制作中'], ['ready_to_publish', '待发布'], ['archived', '已归档'], ['abandoned', '已放弃'] ]

export default function CreationProjectForm({ project, onSaved }: { project: CreationProjectData; onSaved: (project: Partial<CreationProjectData>) => void }) {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    const form = new FormData(event.currentTarget)
    const dueAt = String(form.get('dueAt') || '')
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await creationRequest<{ project: Partial<CreationProjectData> }>(`/api/workspace/content-projects/${project.id}`, creationJson({
        title: form.get('title'), status: form.get('status'), notes: form.get('notes'), finalVideoUrl: form.get('finalVideoUrl'), dueAt: beijingInputToIso(dueAt),
      }))
      onSaved(data.project); setMessage('项目资料已保存。')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '保存失败') } finally { pending.current = false; setBusy(false) }
  }
  return <form className="radar-panel" onSubmit={submit}>
    <h2 className="text-lg font-medium">制作资料</h2>
    <fieldset disabled={busy} className="mt-4 space-y-4 disabled:opacity-60">
      <label className="radar-field"><span>项目标题</span><input name="title" defaultValue={project.title} maxLength={240} required /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="radar-field"><span>制作状态</span><select name="status" defaultValue={project.status}>{!statuses.some(([value]) => value === project.status) && <option value={project.status}>{project.status === 'published' ? '已发布' : project.status === 'reviewed' ? '已复盘' : project.status}</option>}{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="radar-field"><span>截止日期与时间（北京时间 +08:00）</span><input name="dueAt" type="datetime-local" defaultValue={beijingDateInput(project.dueAt)} /></label>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">待发布需要当前母稿与所有平台稿均已确认；已发布、已复盘必须有对应的真实发布记录和已确认复盘。</p>
      <label className="radar-field"><span>素材、附件链接与制作说明</span><textarea name="notes" rows={5} maxLength={20000} defaultValue={project.notes || ''} placeholder="记录素材出处、授权说明、封面需求、拍摄与剪辑待办。" /></label>
      <label className="radar-field"><span>成片视频链接</span><input name="finalVideoUrl" type="url" maxLength={2048} defaultValue={project.finalVideoUrl || ''} placeholder="https://…" /></label>
      <button type="submit" className="radar-primary-button min-h-11">{busy ? '保存中…' : '保存制作资料'}</button>
    </fieldset>
    <p role={error ? 'alert' : 'status'} aria-live="polite" className={`mt-3 text-sm ${error ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}`}>{error || message}</p>
  </form>
}
