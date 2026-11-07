'use client'

import { useEffect, useState } from 'react'
import { Copy, PencilLine, Search, Sparkles } from 'lucide-react'
import { paragraphs } from '@/lib/writing-domain'
import type { MaterialView, WritingAction } from './WritingTypes'
import StudioKnowledgeCapture from '../studio/StudioKnowledgeCapture'

export default function WritingReference({ material, active = true, analysis, action, busy, onAngle }: { material: MaterialView; active?: boolean; analysis: boolean; action: WritingAction; busy: boolean; onAngle: (angle: string) => void }) {
  const initialText = material.correctedTranscript || material.rawTranscript
  const [value, setValue] = useState(initialText), [savedValue, setSavedValue] = useState(initialText), [baseRevision, setBaseRevision] = useState(material.revision)
  const [query, setQuery] = useState(''), [raw, setRaw] = useState(false), [notes, setNotes] = useState(''), [editing, setEditing] = useState(false), [copied, setCopied] = useState(false)
  const dirty = value !== savedValue, stale = material.revision !== baseRevision
  if (!dirty && material.revision !== baseRevision) {
    const next = material.correctedTranscript || material.rawTranscript
    setValue(next); setSavedValue(next); setBaseRevision(material.revision)
  }
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const points = paragraphs(raw ? material.rawTranscript : value).filter((p) => !query || p.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  async function save() {
    const result = await action(`materials/${material.id}`, 'PATCH', { correctedTranscript: value, expectedRevision: baseRevision })
    const next = result.material as MaterialView
    setValue(next.correctedTranscript); setSavedValue(next.correctedTranscript); setBaseRevision(next.revision); setEditing(false)
  }
  const sourceLabel = material.transcriptSource === 'manual' ? '人工输入' : material.transcriptSource === 'asr' ? '语音转写 · 待校正' : material.transcriptSource ? '平台字幕 · 待核对' : '等待获取全文'
  if (analysis) return <div className="writing-insight">
    <div className="writing-reader-toolbar"><span className="writing-badge">原文结构分析</span><button type="button" className="radar-ghost-button" disabled={busy || !material.correctedTranscript || dirty} onClick={() => { void action('jobs', 'POST', { kind: 'analyze', materialId: material.id, requestId: crypto.randomUUID() }).catch(() => {}) }}><Sparkles size={13} />{material.analysis ? '重新运行拆解' : '拆解当前原文'}</button></div>
    {dirty && <p className="writing-warning">原文校正尚未保存，请先保存后拆解。</p>}
    {material.analysis && material.analysisRevision !== material.revision && <p className="writing-warning">原文已更新，这份拆解来自旧版本，请重新拆解后生成文案。</p>}
    {material.analysis ? <>
      <section className="writing-analysis-card"><h3>内容概要</h3><p className="writing-insight-summary">{material.analysis.summary}</p></section>
      {material.analysis.points.map((point, i) => <article key={i} className="writing-analysis-card"><h3>{point.label}</h3><p>{point.text}</p><span>依据：原文段落 {point.paragraphIds.join('、')}</span></article>)}
      <section className="writing-analysis-card"><h3>可复用机制与避坑清单</h3><div className="writing-insight-columns"><div className="writing-insight-do"><h4>✓ 推荐借鉴的核心机制</h4><ul>{material.analysis.reusable.map((text, i) => <li key={i}>{text}</li>)}</ul></div><div className="writing-insight-dont"><h4>× 不能照搬的专属内容</h4><ul>{material.analysis.forbidden.map((text, i) => <li key={i}>{text}</li>)}</ul></div></div></section>
      <section className="writing-analysis-card"><h3>适合元探长的切入点</h3><div className="writing-angle-list">{material.analysis.angles.map((angle, i) => <button type="button" className="writing-angle" key={i} onClick={() => onAngle(angle)}><span>{angle}</span><span className="writing-accent">采用角度 →</span></button>)}</div></section>
      <p className="writing-caption">分析范围：{material.analysis.limitations.join('；')}</p>
    </> : <div className="writing-empty"><h3>AI 爆款拆解</h3><p>{material.correctedTranscript ? '点击“拆解当前原文”，查看钩子、内容结构与可复用机制。' : '取得完整逐字稿后，在这里查看原文拆解。'}</p></div>}
  </div>
  return <div className="writing-reader">
    {active && <StudioKnowledgeCapture sourceType="writing_material" material={{ id: String(material.id), version: material.revision }}
      blockedReason={busy || dirty ? '请先保存当前原文后再沉淀。' : ''} className="radar-ghost-button" />}
    <div className="writing-reader-toolbar"><span className="writing-caption">{sourceLabel} · {(raw ? material.rawTranscript : value).length.toLocaleString()} 字{dirty ? ' · 未保存' : ''}</span><div className="writing-toolbar-actions"><button type="button" className="writing-text-button" aria-pressed={editing} onClick={() => { setEditing(!editing); setRaw(false) }}><PencilLine size={13} />{editing ? '阅读正文' : '校正'}</button><button type="button" className="writing-text-button" onClick={() => { void navigator.clipboard.writeText(raw ? material.rawTranscript : value).then(() => setCopied(true)).catch(() => setCopied(false)) }}><Copy size={13} />{copied ? '已复制' : '复制'}</button><details className="writing-reader-more"><summary>更多阅读工具</summary><div><div className="writing-reader-search"><label><Search size={13} /><input aria-label="检索原文" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索原文…" /></label></div><div className="writing-toolbar-actions"><button type="button" className="radar-ghost-button" aria-pressed={raw} onClick={() => { setRaw(!raw); setEditing(false) }}>{raw ? '查看校正版' : '原始转写'}</button><button type="button" className="radar-ghost-button" disabled={busy} onClick={() => { void action('jobs', 'POST', { kind: 'transcribe', materialId: material.id, requestId: crypto.randomUUID() }).catch(() => {}) }}>提取／转写</button><button type="button" className="radar-ghost-button" disabled={busy || dirty} title="重新识别音频；旧识别结果与人工校正版会保留" onClick={() => { void action('jobs', 'POST', { kind: 'transcribe', forceAsr: true, materialId: material.id, requestId: crypto.randomUUID() }).catch(() => {}) }}>重新语音转写</button></div></div></details></div></div>
    {material.lastError && <p className="writing-warning">{material.lastError}</p>}
    {(query || raw) && <p className="writing-caption">{raw ? '正在阅读原始转写' : `检索结果：${query}`} <button type="button" className="writing-text-button" onClick={() => { setQuery(''); setRaw(false) }}>返回完整校正版</button></p>}
    {stale && <div className="writing-warning">服务器原文版本已变化，当前输入仍保留。<button type="button" className="writing-text-button" onClick={() => { const next = material.correctedTranscript || material.rawTranscript; setValue(next); setSavedValue(next); setBaseRevision(material.revision) }}>读取最新版本并替换当前输入</button></div>}
    {editing && !raw && !query ? <div className="writing-transcript-edit"><textarea aria-label="校正逐字稿" rows={18} value={value} maxLength={100000} onChange={(e) => { setValue(e.target.value); setCopied(false) }} placeholder="粘贴或校正逐字稿，保存后继续拆解。" /><div className="writing-editor-foot"><span>{dirty ? '有未保存的校正' : '原始转写保留'}</span><button type="button" className="radar-primary-button" disabled={busy || value.length < 20 || !dirty} onClick={() => { void save().catch(() => {}) }}>保存校正版</button></div></div> : <article className="writing-transcript">{points.map((point) => <p key={point.id}><span className="writing-paragraph-number" title={`原文段落 ${point.id}`}>{String(point.id).padStart(2, '0')}</span>{point.text}</p>)}{!points.length && <div className="writing-empty"><p>{query ? '没有匹配的原文段落。' : '当前还没有完整逐字稿，可提取视频字幕，或点击“校正原文”粘贴正文。'}</p></div>}</article>}
    {dirty && !editing && <div className="writing-editor-foot"><span>当前显示尚未保存的校正版</span><button type="button" className="radar-primary-button" disabled={busy || value.length < 20} onClick={() => { void save().catch(() => {}) }}>保存校正版</button></div>}
    <details className="writing-evidence"><summary>事实核实 · {material.sourceItem?.status === 'verified' ? '已核实' : '待核实'}</summary><label className="radar-field"><span>核实说明（原视频、数据或本人案例）</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button type="button" className="radar-ghost-button" disabled={busy || dirty || notes.trim().length < 5} onClick={() => { void action(`materials/${material.id}/verify`, 'POST', { expectedRevision: baseRevision, evidenceNotes: notes }).catch(() => {}) }}>我已核实当前素材</button></details>
  </div>
}
