'use client'

import { useRef, useState, type FormEvent } from 'react'
import CreationScriptStatements from '@/components/admin/CreationScriptStatements'
import { CreationRequestError, creationJson, creationRequest } from '@/lib/creation-client'
import { displayStatements, type CreationMasterScript, type CreationSource } from '@/lib/creation-types'

export default function CreationScriptEditor({ projectId, title, script, sources, onSaved, onReload }: {
  projectId: number; title: string; script: CreationMasterScript | null; sources: CreationSource[]
  onSaved: (script: CreationMasterScript, invalidated: number) => void; onReload: () => void
}) {
  const initial = { title: script?.title || title, body: script?.body || '', facts: displayStatements(script?.facts), inferences: displayStatements(script?.inferences), disputes: displayStatements(script?.disputes), timelinessRisk: script?.timelinessRisk || '' }
  const [content, setContent] = useState(initial)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const dirty = JSON.stringify(initial) !== JSON.stringify(content)
  const legacyFacts = Array.isArray(script?.facts) && script.facts.length > initial.facts.length
  async function commit(action: 'save' | 'confirm') {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setConflict(false)
    try {
      const data = await creationRequest<{ masterScript: CreationMasterScript; invalidatedVariants: number }>(`/api/workspace/content-projects/${projectId}/master-script`, creationJson({ ...(action === 'save' ? content : {}), action, expectedVersion: script?.version ?? 0 }))
      onSaved(data.masterScript, data.invalidatedVariants)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败')
      setConflict(caught instanceof CreationRequestError && caught.status === 409)
    } finally { pending.current = false; setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void commit('save') }
  return <form onSubmit={submit} className="radar-panel">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">权威母稿 <span className="text-sm text-muted-foreground">v{script?.version ?? 0}</span></h2><span className={`rounded-full border px-3 py-1 text-sm ${script?.confirmedAt ? 'border-[var(--ui-success)] text-[var(--ui-success)]' : 'border-[var(--ui-warning)] text-[var(--ui-warning)]'}`}>{script?.confirmedAt ? '已人工确认' : '待人工确认'}</span></div>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">在此核对事实与来源，并确认当前台词。保存修改会形成新版本，相关平台稿需要重新复核，已发布记录保留原快照。</p>
    {legacyFacts && <p role="status" className="mt-3 text-sm leading-6 text-[var(--ui-warning)]">此稿含旧版来源记录，请在下方补成具体事实并关联来源，再保存与确认。</p>}
    <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
      <label className="radar-field"><span>母稿标题</span><input required maxLength={240} value={content.title} onChange={(event) => setContent({ ...content, title: event.target.value })} /></label>
      <label className="radar-field"><span>完整脚本正文</span><textarea required minLength={50} maxLength={20000} rows={16} value={content.body} onChange={(event) => setContent({ ...content, body: event.target.value })} /><span className="text-sm text-muted-foreground">{content.body.length} / 20000 字；至少 50 字。</span></label>
      <CreationScriptStatements title="事实" description="可验证的陈述与数据。每条都必须关联当前已核实的原始来源。" facts value={content.facts} sources={sources} onChange={(facts) => setContent({ ...content, facts })} />
      <CreationScriptStatements title="推断" description="你的解释、预测与判断。参考来源可选，正文中应明确标为推断。" value={content.inferences} sources={sources} onChange={(inferences) => setContent({ ...content, inferences })} />
      <CreationScriptStatements title="争议" description="来源冲突、证据缺口与尚无定论的问题，保留不确定性。" value={content.disputes} sources={sources} onChange={(disputes) => setContent({ ...content, disputes })} />
      <label className="radar-field"><span>时效风险与发布前复核点</span><textarea rows={3} maxLength={3000} value={content.timelinessRisk} onChange={(event) => setContent({ ...content, timelinessRisk: event.target.value })} placeholder="例如：价格、模型版本或产品开放范围可能变化。" /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="radar-primary-button min-h-11" disabled={!!script && !dirty}>{busy ? '提交中…' : script ? '保存为下一版本' : '保存第一版母稿'}</button>
        <button type="button" onClick={() => void commit('confirm')} disabled={!script || dirty || !!script.confirmedAt || content.facts.length === 0} className="min-h-11 rounded-lg border border-[var(--ui-success)] px-4 text-sm text-[var(--ui-success)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">我已核对事实，确认当前母稿</button>
      </div>
      {dirty && <p className="text-sm text-[var(--ui-warning)]">有未保存的修改；保存后再确认新版本。</p>}
      {!content.facts.length && <p className="text-sm text-muted-foreground">草稿可以暂不填写事实，人工确认前至少需要一条有来源的事实。</p>}
    </fieldset>
    {error && <p role="alert" aria-live="polite" className="mt-4 text-sm leading-6 text-[var(--ui-danger)]">{error}</p>}
    {conflict && <div className="mt-3 text-sm text-muted-foreground"><p>当前输入仍保留。可先复制未保存内容，再读取最新母稿进行合并。</p><button type="button" className="mt-2 min-h-11 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={onReload}>读取最新版本（替换当前输入）</button></div>}
  </form>
}
