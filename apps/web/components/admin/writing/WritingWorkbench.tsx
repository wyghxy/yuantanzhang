'use client'

import { useUsageOperation } from '@/lib/use-usage-operation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Columns3, FileText, History, Lightbulb, PanelLeftClose, PenLine } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { JOB_LABELS } from '@/lib/writing-domain'
import { useAdminShell } from '../AdminShell'
import WritingMaterials from './WritingMaterials'
import WritingReference from './WritingReference'
import WritingSettings from './WritingSettings'
import WritingDraftEditor from './WritingDraftEditor'
import { PLATFORM_LABELS, type WritingAction, type WritingState } from './WritingTypes'

type StudioTab = 'transcript' | 'analysis' | 'draft' | 'master' | 'history'
export default function WritingWorkbench({ projectId, masterEditor, onMasterChanged }: { projectId: number; masterEditor: ReactNode; onMasterChanged: () => void }) {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view'), requestedMaterial = Number(searchParams.get('materialId'))
  const [data, setData] = useState<WritingState | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), pending = useRef(false), refreshSequence = useRef(0)
  const [materialId, setMaterialId] = useState<number | null>(Number.isSafeInteger(requestedMaterial) && requestedMaterial > 0 ? requestedMaterial : null), [draftId, setDraftId] = useState<number | null>(null)
  const [tab, setTab] = useState<StudioTab>(requestedView === 'analysis' || requestedView === 'draft' || requestedView === 'master' ? requestedView : 'transcript')
  const [mobilePanel, setMobilePanel] = useState('editor'), [focus, setFocus] = useState(false), [angle, setAngle] = useState('')
  const [historyId, setHistoryId] = useState<number | null>(null)
  const usage = useUsageOperation(JSON.stringify([projectId, materialId, draftId, tab]))
  const { setImmersive } = useAdminShell()
  useEffect(() => { setImmersive(tab === 'analysis' || tab === 'draft'); return () => setImmersive(false) }, [tab, setImmersive])
  const base = `/api/workspace/content-projects/${projectId}/writing`
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current
    const response = await fetch(base, { signal, cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || '写作工作台读取失败')
    if (!signal?.aborted && sequence === refreshSequence.current) setData(payload as WritingState)
  }, [base])
  useEffect(() => {
    const abort = new AbortController()
    void load(abort.signal).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : '读取失败') })
    const timer = setInterval(() => { if (!pending.current) void load(abort.signal).catch(() => {}) }, 4000)
    return () => { abort.abort(); clearInterval(timer) }
  }, [load])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && (tab === 'analysis' || tab === 'draft' || focus)) { setTab('transcript'); setFocus(false); setMobilePanel('editor') } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [tab, focus])
  const action: WritingAction = async (path, method, body) => {
    if (pending.current) throw new Error('请等待当前保存完成')
    pending.current = true; setBusy(true); setError(''); setNotice('')
    const signal = path === 'jobs' && method === 'POST' ? usage.begin() : undefined
    try {
      if (path === 'jobs' && method === 'POST') throw new Error('当前版本未接入此项外部处理能力。')
      signal?.throwIfAborted()
      const response = await fetch(`${base}/${path}`, { method, signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '操作失败')
      setNotice(path === 'jobs' ? '任务已加入队列，结果会自动显示。' : '已保存')
      await load()
      if (path === 'materials' && payload.material) { setMaterialId(payload.material.id); setTab('transcript'); setMobilePanel('editor') }
      return payload as Record<string, unknown>
    } catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败'); throw failure }
    finally { pending.current = false; setBusy(false) }
  }
  async function upload(form: FormData) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`${base}/materials`, { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '上传失败')
      setMaterialId(payload.material.id); setTab('transcript'); setMobilePanel('editor'); setNotice('素材已上传，可提取／转写获取全文。'); await load()
    } catch (failure) { setError(failure instanceof Error ? failure.message : '上传失败') }
    finally { pending.current = false; setBusy(false) }
  }
  if (!data) return <section className="radar-panel"><p role={error ? 'alert' : 'status'}>{error || '正在打开文案工作台…'}</p>{error && <button type="button" className="radar-ghost-button mt-3" onClick={() => { void load().catch(() => {}) }}>重新读取</button>}</section>
  const material = data.materials.find((item) => item.id === materialId) ?? data.materials[0] ?? null
  const draft = data.drafts.find((item) => item.id === draftId) ?? data.drafts[0] ?? null
  const historical = data.history.find((item) => item.id === historyId) ?? data.history[0]
  const immersive = tab === 'analysis' || tab === 'draft'
  const activeJobs = data.jobs.filter((job) => ['running', 'queued'].includes(job.status))
  return <section className={`writing-workbench ${focus ? 'writing-focused' : ''}`} data-step={tab}>
    <nav className="writing-mobile-nav" aria-label="工作面板">{[['materials', '素材'], ['editor', '写稿'], ['settings', '设置']].map(([key, label]) => <button type="button" key={key} aria-pressed={mobilePanel === key} onClick={() => { setMobilePanel(key); if (key === 'settings') setTab('draft'); if (key === 'materials') setTab('transcript') }}>{label}</button>)}</nav>
    <div className="writing-layout" data-mobile-panel={mobilePanel}>
      <div className="writing-left"><WritingMaterials materials={data.materials} selectedId={material?.id ?? null} select={(id) => { setMaterialId(id); setTab('transcript'); setMobilePanel('editor') }} action={action} upload={upload} busy={busy} /></div>
      <div className="writing-center">
        <header className="writing-header"><div className="writing-heading-text"><div className="writing-meta"><span className="writing-badge">{tab === 'master' ? '内容项目母稿' : material ? PLATFORM_LABELS[material.platform] : '创作素材'}</span><strong>{tab === 'master' ? '元探长' : material?.author || '元探长'}</strong><span>·</span><span>{tab === 'master' ? data.master ? `母稿 v${data.master.version}` : '尚未保存母稿' : material ? `原文 v${material.revision}` : '请选择作品'}</span></div><h2>{tab === 'master' ? data.master?.title || '撰写项目母稿' : material?.title || '从左侧选择一条素材开始研读'}</h2></div><div className="writing-toolbar-actions">{tab === 'draft' && data.drafts.length > 0 && <label className="writing-candidate-picker"><span>候选稿</span><select aria-label="选择候选稿" value={draft?.id ?? ''} onChange={(event) => setDraftId(Number(event.target.value))}>{data.drafts.map((item) => <option key={item.id} value={item.id}>#{item.id} {item.job?.kind === 'rewrite' ? '修改建议' : item.job?.kind === 'storyboard' ? '导演分镜' : '初稿'} · {item.document.title}</option>)}</select></label>}{material?.url && <a className="radar-ghost-button" href={material.url} target="_blank" rel="noreferrer">原链接 ↗</a>}<button type="button" className="radar-ghost-button" aria-pressed={focus} onClick={() => setFocus(!focus)}>{focus ? <Columns3 size={13} /> : <PanelLeftClose size={13} />}{focus ? '展开素材' : '专注阅读'}</button></div></header>
        <div className="writing-tabs-row"><nav className="writing-tabbar writing-main-tabs" aria-label="写作步骤">{([['transcript', '逐字稿正文', FileText], ['analysis', 'AI 爆款拆解', Lightbulb], ['draft', '二创工作台', PenLine]] as const).map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setMobilePanel('editor') }}><Icon size={14} />{label}</button>)}</nav><div className="writing-aux-tabs">{immersive && <button type="button" className="writing-text-button" onClick={() => { setTab('transcript'); setFocus(false) }}><ArrowLeft size={12} />返回素材</button>}<button type="button" className="writing-text-button" aria-pressed={tab === 'master'} onClick={() => setTab('master')}>母稿确认</button><button type="button" className="writing-text-button" aria-label="历史版本" aria-pressed={tab === 'history'} onClick={() => setTab('history')}><History size={14} /></button></div></div>
        {(error || notice) && <div aria-live="polite" role={error ? 'alert' : 'status'} className={`writing-notice ${error ? 'writing-notice-error' : ''}`}>{error || notice}<button type="button" aria-label="关闭提示" onClick={() => { setError(''); setNotice('') }}>×</button></div>}
        <div className="writing-canvas">
          <div className="writing-reference-view" hidden={tab !== 'transcript' && tab !== 'analysis'}>{data.materials.map((item) => <div key={item.id} hidden={material?.id !== item.id}><WritingReference material={item} active={material?.id === item.id && tab === 'transcript'} analysis={tab === 'analysis'} action={action} busy={busy} onAngle={(value) => { setAngle(value); setTab('draft'); setMobilePanel('settings') }} /></div>)}{!material && <div className="writing-empty"><FileText size={23} /><h3>从左侧选择素材，开始研读</h3><p>支持抖音、B站、小红书、YouTube 视频，以及逐字稿和音视频文件。</p><button type="button" className="radar-ghost-button writing-mobile-add" onClick={() => setMobilePanel('materials')}>添加素材</button></div>}</div>
          <div className="writing-creation-grid" hidden={tab !== 'draft'}>
            <div className="writing-right"><WritingSettings state={data} action={action} busy={busy} materialId={material?.id ?? null} suggestedAngle={angle} onGenerated={() => { setTab('draft'); setMobilePanel('editor'); setDraftId(null) }} /></div>
            <div className="writing-draft-pane">{data.drafts.map((item) => <div className="writing-draft-instance" key={item.id} hidden={draft?.id !== item.id}><WritingDraftEditor draft={item} state={data} action={action} busy={busy} projectId={projectId} onAdopt={() => { onMasterChanged(); setTab('master') }} /></div>)}{!draft && <><div className="writing-output-tabs">{['导演分镜', 'script.md', '提词器文本', '截图贴图包'].map((label, index) => <span className={index === 0 ? 'is-active' : ''} key={label}>{label}</span>)}</div><div className="writing-empty writing-draft-empty"><PenLine size={22} /><h3>你的新作品，从这里开始</h3><p>选择左侧模板，补充自己的观点与案例，生成后在这里编辑导演口播脚本。</p><button type="button" className="radar-ghost-button" onClick={() => setTab('master')}>直接撰写母稿</button></div><div className="writing-editor-foot"><span>尚未生成稿件</span><span>0 字</span></div></>}</div>
          </div>
          <div className="writing-master-pane" hidden={tab !== 'master'}>{masterEditor}<section className="writing-analysis-card"><h3>确认台词后生成拍摄分镜</h3><p>分镜保留已确认母稿的台词。后续更改母稿，需要重新生成。</p><button type="button" className="radar-primary-button" disabled={busy || !data.master?.confirmedAt || !data.capabilities.model} onClick={() => { void action('jobs', 'POST', { kind: 'storyboard', requestId: crypto.randomUUID() }).then(() => { setTab('draft'); setDraftId(null) }).catch(() => {}) }}>生成导演分镜</button></section></div>
          <div className="writing-history-pane" hidden={tab !== 'history'}><div className="writing-section-heading"><h2>母稿版本对比</h2><p>保留每次保存的文本与发布快照。</p></div>{historical ? <><label className="radar-field"><span>历史版本</span><select value={historical.id} onChange={(event) => setHistoryId(Number(event.target.value))}>{data.history.map((item) => <option value={item.id} key={item.id}>v{item.version} · {new Date(item.createdAt).toLocaleString('zh-CN')}</option>)}</select></label><div className="writing-history-grid"><article className="writing-history"><h3>历史 v{historical.version} · {historical.snapshot.title}</h3><p>{historical.snapshot.body}</p></article><article className="writing-history"><h3>当前 v{data.master?.version ?? 0} · {data.master?.title}</h3><p>{data.master?.body || '尚未保存母稿'}</p></article></div></> : <div className="writing-empty"><p>保存母稿后，版本记录会显示在这里。</p></div>}</div>
        </div>
      </div>
    </div>
    <details className="writing-jobs"><summary><span className={activeJobs.length ? 'writing-live-dot' : 'writing-idle-dot'} />运行日志<span>{activeJobs.length ? `${activeJobs.length} 个任务进行中` : '当前无运行任务'}</span></summary><div className="writing-job-list">{data.jobs.map((job) => <article key={job.id}><div className="writing-job-heading"><div><p>#{job.id} · {JOB_LABELS[job.kind]} · {job.stage}</p><span>尝试 {job.attempts} 次{job.model ? ` · ${job.model}` : ''}{job.status === 'queued' ? ' · 排队中' : ''}</span></div>{['queued', 'running'].includes(job.status) ? <button className="radar-ghost-button" type="button" disabled={busy} onClick={() => { void action(`jobs/${job.id}`, 'POST', { action: 'cancel' }).catch(() => {}) }}>停止任务</button> : ['failed', 'blocked', 'cancelled'].includes(job.status) && <button type="button" className="radar-ghost-button" disabled={busy} onClick={() => { void action(`jobs/${job.id}`, 'POST', { action: 'retry' }).catch(() => {}) }}>重试</button>}</div>{job.error && <p className="writing-warning">{job.error}</p>}{job.events?.length > 0 && <details><summary>查看详情</summary>{job.events.map((event, index) => <p key={index}>{new Date(event.at).toLocaleTimeString('zh-CN')} · {event.text}</p>)}</details>}</article>)}{!data.jobs.length && <p className="writing-caption">尚未运行 AI 或转写任务。</p>}</div></details>
  </section>
}
