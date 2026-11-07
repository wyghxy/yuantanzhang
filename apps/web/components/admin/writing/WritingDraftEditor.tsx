'use client'

import { useEffect, useState } from 'react'
import { Clapperboard, ClipboardList, FileText, Image as ImageIcon, PencilLine } from 'lucide-react'
import { estimatedSeconds, exportWriting, narration } from '@/lib/writing-domain'
import type { DraftView, WritingAction, WritingState } from './WritingTypes'

export default function WritingDraftEditor({ draft, state, action, busy, onAdopt }: { draft: DraftView; state: WritingState; action: WritingAction; busy: boolean; projectId: number; onAdopt: () => void }) {
  const [document, setDocument] = useState(draft.document), [savedDocument, setSavedDocument] = useState(JSON.stringify(draft.document)), [baseRevision, setBaseRevision] = useState(draft.revision)
  const [view, setView] = useState<'director' | 'markdown' | 'teleprompter' | 'cards'>('director'), [editing, setEditing] = useState(false), [segmentId, setSegmentId] = useState(''), [instruction, setInstruction] = useState(''), [acceptStale, setAcceptStale] = useState(false), [copyStatus, setCopyStatus] = useState('')
  const dirty = JSON.stringify(document) !== savedDocument, source = draft.inputSnapshot
  const currentMaterial = state.materials.find((material) => material.id === source.material?.id)
  const stale = (state.master?.version ?? 0) !== source.masterVersion || source.profileRevision !== state.profile.revision || source.settingsRevision !== state.settings.revision || (source.material && source.material.revision !== currentMaterial?.revision) || (source.draft && source.draft.revision !== state.drafts.find((item) => item.id === source.draft?.id)?.revision)
  const outdatedStoryboard = draft.job?.kind === 'storyboard' && (state.master?.body !== narration(document) || state.master.version !== source.masterVersion || !state.master.confirmedAt)
  if (!dirty && baseRevision !== draft.revision) {
    setDocument(draft.document); setSavedDocument(JSON.stringify(draft.document)); setBaseRevision(draft.revision)
  }
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  async function save() { const result = await action(`drafts/${draft.id}`, 'PATCH', { document, expectedRevision: baseRevision }); const next = result.draft as DraftView; setDocument(next.document); setSavedDocument(JSON.stringify(next.document)); setBaseRevision(next.revision) }
  async function rewrite(prompt: string) {
    if (dirty) await save()
    await action('jobs', 'POST', { kind: 'rewrite', draftId: draft.id, materialId: source.material?.id, instruction: prompt, segmentId: segmentId || undefined, requestId: crypto.randomUUID() })
  }
  async function adopt() { await action(`drafts/${draft.id}/adopt`, 'POST', { expectedRevision: baseRevision, expectedVersion: state.master?.version ?? 0, acceptStale }); onAdopt() }
  const patchSegment = (id: string, value: string) => { setCopyStatus(''); setDocument({ ...document, segments: document.segments.map((segment) => segment.id === id ? { ...segment, narration: value, visualNotes: '' } : segment) }) }
  function downloadMarkdown() {
    const url = URL.createObjectURL(new Blob([exportWriting(document, 'markdown')], { type: 'text/markdown;charset=utf-8' }))
    const link = window.document.createElement('a'); link.href = url; link.download = 'script.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="writing-draft-editor">
    <nav className="writing-output-tabs" aria-label="文案输出视图">{([['director', '导演分镜', Clapperboard], ['markdown', 'script.md', FileText], ['teleprompter', '提词器文本', ClipboardList], ['cards', '截图贴图包', ImageIcon]] as const).map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}><Icon size={13} />{label}</button>)}</nav>
    <div className="writing-draft-title-row"><input aria-label="稿件标题" maxLength={240} value={document.title} onChange={(event) => setDocument({ ...document, title: event.target.value })} /><button type="button" className="radar-ghost-button" aria-pressed={editing} onClick={() => { setEditing(!editing); setView('director') }}><PencilLine size={13} />{editing ? '预览' : '编辑'}</button></div>
    <div className="writing-draft-scroll">
      <div className="writing-draft-meta"><span>#{draft.id} · v{baseRevision} · 约 {estimatedSeconds(narration(document))} 秒</span><span>{draft.adoptedVersion ? `已采用为母稿 v${draft.adoptedVersion}` : '待采用'}</span></div>
      {stale && <div className="writing-warning">输入版本已变化，采用前请核对素材、要求与母稿。<label className="writing-check"><input type="checkbox" checked={acceptStale} onChange={(event) => setAcceptStale(event.target.checked)} />我已核对，允许采用旧输入产生的候选稿</label></div>}
      {outdatedStoryboard && <p className="writing-warning">母稿或确认状态已变化，此分镜仅供历史参考。请定稿后重新生成。</p>}
      {baseRevision !== draft.revision && <div className="writing-warning">另一窗口已修改此稿，当前输入仍保留。<button type="button" className="writing-text-button" onClick={() => { setDocument(draft.document); setSavedDocument(JSON.stringify(draft.document)); setBaseRevision(draft.revision) }}>读取最新版本并替换输入</button></div>}
      {view === 'director' ? <>
        <details className="writing-draft-alternatives"><summary>标题与开场候选</summary>{document.titles.map((title, index) => <button type="button" key={`title-${index}`} className="writing-angle" onClick={() => setDocument({ ...document, title })}><span>{title}</span><span className="writing-accent">采用标题</span></button>)}{document.hooks.map((hook, index) => <button type="button" key={`hook-${index}`} className="writing-angle" disabled={!document.segments.length} onClick={() => patchSegment(document.segments[0].id, hook)}><span>{hook}</span><span className="writing-accent">替换开场</span></button>)}</details>
        <div className="writing-scenes">{document.segments.map((segment) => <article className="writing-scene" key={segment.id}><header><span>{segment.id}</span><h3>{segment.role}</h3><span className="writing-scene-duration">{segment.seconds} 秒</span><button type="button" className="writing-text-button" aria-pressed={segmentId === segment.id} onClick={() => setSegmentId(segment.id)}>选中改写</button></header><div className="writing-scene-content"><span className="writing-scene-label">口播台词</span>{editing ? <textarea aria-label={`${segment.id} 口播台词`} disabled={busy} rows={Math.max(3, Math.min(10, Math.ceil(segment.narration.length / 40)))} maxLength={10000} value={segment.narration} onChange={(event) => patchSegment(segment.id, event.target.value)} /> : <p>{segment.narration}</p>}<div className="writing-scene-visual"><span className="writing-scene-label">画面建议</span><p>{segment.visualNotes || '台词已修改或尚未生成分镜，定稿后重新生成。'}</p></div></div></article>)}</div>
      </> : view === 'cards' ? <div className="writing-poster-list"><p className="writing-caption">由当前稿件生成的文字卡片，可直接截图使用。</p>{document.segments.map((segment) => <article className="writing-poster" key={segment.id}><div><span>元探长 · {segment.role}</span><span>{segment.id}</span></div><h3>{document.title}</h3><p>{segment.narration}</p><footer>元探长 · 创作工作台</footer></article>)}</div> : <pre className={view === 'teleprompter' ? 'writing-teleprompter' : 'writing-markdown'}>{exportWriting(document, view === 'markdown' ? 'markdown' : 'teleprompter')}</pre>}
      {document.missing.length > 0 && <details className="writing-warning"><summary>定稿前待补充 · {document.missing.length} 项</summary><ul>{document.missing.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
      <details className="writing-rewrite" open={Boolean(segmentId)}><summary>继续打磨{segmentId && ` · ${segmentId}`}</summary><div className="writing-rewrite-fields"><label className="radar-field"><span>修改范围</span><select value={segmentId} onChange={(event) => setSegmentId(event.target.value)}><option value="">整份候选稿</option>{document.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.id} · {segment.role}</option>)}</select></label><label className="radar-field"><span>修改要求</span><input value={instruction} maxLength={5000} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：用上班族的例子解释" /></label></div><div className="writing-rewrite-actions">{['更口语化', '压缩篇幅', '补充解释', '替换开头'].map((label) => <button className="radar-ghost-button" type="button" key={label} disabled={busy || !state.capabilities.model} onClick={() => { void rewrite(label).catch(() => {}) }}>{label}</button>)}<button type="button" className="radar-primary-button" disabled={busy || !instruction.trim() || !state.capabilities.model} onClick={() => { void rewrite(instruction).catch(() => {}) }}>生成修改建议</button></div><p className="writing-caption">修改建议作为新候选稿保存，采用后更新母稿。</p></details>
    </div>
    <div className="writing-editor-foot"><span role="status">{copyStatus || (dirty ? '未保存修改' : '已保存')} · {narration(document).length} 字</span><div><button type="button" className="radar-ghost-button" onClick={() => { void navigator.clipboard.writeText(exportWriting(document, 'teleprompter')).then(() => setCopyStatus('提词器已复制')).catch(() => setCopyStatus('复制失败，请重试')) }}>复制提词器</button><button type="button" className="radar-ghost-button" onClick={downloadMarkdown}>导出 script.md</button><button type="button" className="radar-primary-button" disabled={busy || !dirty} onClick={() => { void save().catch(() => {}) }}>保存草稿</button><button type="button" className="radar-ghost-button" disabled={busy || dirty || (stale && !acceptStale) || outdatedStoryboard} onClick={() => { void adopt().catch(() => {}) }}>采用母稿</button></div></div>
  </div>
}

