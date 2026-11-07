'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, FileText, Plus, X } from 'lucide-react'
import { studioReferenceIds } from '@ytz/contracts/studio-radar'
import { api, errorText, list, object, text, type RecordItem, type RecordData } from '../studio-client'
import { Busy, Empty, Modal, Platform } from '../StudioUI'
import { useStudioPrivacy } from '../StudioPrivacy'
import s from './StudioTopicsView.module.css'

const statuses = [
  ['idea', '待创作'], ['adopted', '已采纳'], ['writing', '整理中'],
  ['published', '已完成'], ['archived', '已归档'],
  ['pending', '待创作'], ['draft', '整理中'], ['done', '已完成'],
]
const statusLabel = (value: unknown) => statuses.find(([key]) => key === value)?.[1] || '待创作'

export function StudioTopicsView({ items, total, selected, onSelect, loading, tools, onSaved, onMaterial, onWrite, onDelete, busy }: {
  items: RecordItem[]; total: number; selected: RecordItem | null; loading: boolean
  tools: ReactNode; busy: boolean
  onSelect: (item: RecordItem) => void; onSaved: (item: RecordItem) => void
  onMaterial: (id: string) => void; onWrite: (item: RecordItem) => void
  onDelete: (item: RecordItem) => void
}) {
  const [dirty, setDirty] = useState(false)
  const choose = (item: RecordItem) => {
    if (item.id === selected?.id) return
    if (dirty && !window.confirm('当前选题尚未保存，确认切换？')) return
    onSelect(item)
  }
  return <div className={s.workbench}>
    <div className={s.toolbar}>{tools}</div>
    <div className={s.columns}>
      <section className={s.list} aria-label="选题清单">
        <header><h3>选题清单</h3><span>{total} 个选题</span></header>
        {loading ? <Busy /> : items.length ? items.map((item, index) => <button key={item.id}
          className={s.row} aria-pressed={selected?.id === item.id} onClick={() => choose(item)}>
          <span className={s.ordinal}>{String(index + 1).padStart(2, '0')}</span>
          <span className={s.rowCopy}><strong>{text(item.title, '未命名选题')}</strong>
            <span>{statusLabel(item.status)} · {studioReferenceIds(item).length} 条参考资料</span></span>
          <ChevronRight size={18} />
        </button>) : <Empty title="还没有选题"><p>新建一个想法，或从采集仓库采纳内容。</p></Empty>}
      </section>
      {selected ? <TopicEditor key={selected.id} item={selected} onDirty={setDirty} onSaved={onSaved}
        onMaterial={onMaterial} onWrite={onWrite} onDelete={onDelete} externalBusy={busy} />
        : <div className={s.empty}><FileText size={28} /><p>选择一个选题，整理想法与参考资料</p></div>}
    </div>
  </div>
}

function TopicEditor({ item, onDirty, onSaved, onMaterial, onWrite, onDelete, externalBusy }: {
  item: RecordItem; onDirty: (dirty: boolean) => void; onSaved: (item: RecordItem) => void
  onMaterial: (id: string) => void; onWrite: (item: RecordItem) => void
  onDelete: (item: RecordItem) => void; externalBusy: boolean
}) {
  const { materialTitle } = useStudioPrivacy()
  const [base, setBase] = useState(item)
  const [title, setTitle] = useState(text(item.title)), [status, setStatus] = useState(text(item.status, 'idea'))
  const [notes, setNotes] = useState(text(item.notes)), [outline, setOutline] = useState(text(item.outline))
  const [references, setReferences] = useState<RecordData[]>(() => Array.isArray(item.references) ? item.references.map(object)
    : studioReferenceIds(item).map(materialId => ({ materialId })))
  const [materials, setMaterials] = useState<RecordItem[]>([]), [lookupError, setLookupError] = useState('')
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [picker, setPicker] = useState(false)
  const [search, setSearch] = useState(''), [results, setResults] = useState<RecordItem[]>([]), [searching, setSearching] = useState(false)
  const payload = { title, status, notes, outline, references }
  const baseReferences = Array.isArray(base.references) ? base.references : studioReferenceIds(base).map(materialId => ({ materialId }))
  const dirty = JSON.stringify(payload) !== JSON.stringify({ title: text(base.title), status: text(base.status, 'idea'), notes: text(base.notes), outline: text(base.outline), references: baseReferences })
  const ids = references.map(ref => text(ref.materialId)), referenceKey = ids.join(',')
  const busy = saving || externalBusy
  useEffect(() => {
    onDirty(dirty)
    window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: dirty }))
    const leave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [dirty, onDirty])
  useEffect(() => () => {
    onDirty(false)
    window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: false }))
  }, [onDirty])
  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled(referenceKey.split(',').filter(Boolean).map(id => api(`materials/${encodeURIComponent(id)}`, 'GET', undefined, controller.signal)))
      .then(results => {
        if (controller.signal.aborted) return
        setMaterials(results.flatMap(result => result.status === 'fulfilled' ? [result.value.item as RecordItem] : []))
        setLookupError(results.some(result => result.status === 'rejected') ? '部分参考资料暂时无法读取，关联仍保留。' : '')
      })
    return () => controller.abort()
  }, [referenceKey])
  useEffect(() => {
    if (!picker) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      void api(`materials?limit=30&sample=all&q=${encodeURIComponent(search)}`, 'GET', undefined, controller.signal)
        .then(data => { if (!controller.signal.aborted) setResults(list(data.items)) })
        .catch(reason => { if (!controller.signal.aborted) setError(errorText(reason)) })
        .finally(() => { if (!controller.signal.aborted) setSearching(false) })
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [picker, search])
  async function save(write = false) {
    if (busy) return
    setSaving(true); setError('')
    try {
      const saved = dirty ? (await api(`topics/${base.id}`, 'PATCH', { expectedVersion: base.version, ...payload })).item as RecordItem : base
      setBase(saved)
      onDirty(false)
      window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: false }))
      onSaved(saved)
      if (write) onWrite(saved)
    } catch (reason) { setError(errorText(reason)) }
    finally { setSaving(false) }
  }
  return <section className={s.editor} aria-label="选题工作区">
    <div className={s.editorHeading}><span>选题工作区</span><span role="status">{saving ? '正在保存…' : dirty ? '尚未保存' : '已保存'}</span></div>
    <label className={s.title}><span className={s.srOnly}>选题标题</span><textarea aria-label="选题标题" value={title} rows={2} maxLength={300} onChange={event => setTitle(event.target.value)} /></label>
    <label className={s.status}>创作状态<select value={status} onChange={event => setStatus(event.target.value)} aria-label="创作状态">
      {statuses.filter(([key], index) => index < 5 || key === status).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label className={s.field}>想法与切入点<textarea value={notes} rows={4} maxLength={12000} placeholder="想对谁说？希望解决什么问题？" onChange={event => setNotes(event.target.value)} /></label>
    <div className={s.referenceHeading}><h4>参考资料 <span>{references.length}</span></h4><button className="btn ghost" disabled={busy || references.length >= 10} onClick={() => setPicker(true)}><Plus size={16} /> 添加资料</button></div>
    {lookupError && <p role="status">{lookupError}</p>}
    <div className={s.references}>{references.length ? references.map(ref => {
      const id = text(ref.materialId), material = materials.find(row => row.id === id)
      return <div key={id}><button onClick={() => onMaterial(id)}><FileText size={18} /><span>{material ? materialTitle(material.title) : '参考资料'}<small>{material && <Platform value={material.platform} />}{ref.anchor ? ' · 已选取片段' : ''}</small></span><ChevronRight size={16} /></button>
        <button aria-label={`移除参考资料：${materialTitle(material?.title, id)}`} disabled={busy} onClick={() => setReferences(current => current.filter(value => value.materialId !== id))}><X size={16} /></button></div>
    }) : <p>添加已采集的内容，作为这次创作的依据。</p>}</div>
    <label className={s.field}>创作提纲<textarea value={outline} rows={5} maxLength={20000} placeholder="整理开场、核心观点与结尾" onChange={event => setOutline(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <footer className={s.actions}><button className="btn ghost" disabled={busy || !dirty || !title.trim()} onClick={() => void save()}>保存选题</button><button className="btn primary" disabled={busy || !title.trim()} onClick={() => void save(true)}>开始写稿</button>
      <button className="btn ghost" disabled={busy || dirty} onClick={() => onDelete(base)}>删除选题</button></footer>
    {picker && <Modal title="添加参考资料" close={() => setPicker(false)}><div className={s.picker}>
      <input aria-label="搜索参考资料" placeholder="搜索已采集内容" value={search} onChange={event => setSearch(event.target.value)} />
      {searching ? <Busy /> : results.length ? results.map(row => <button key={row.id} disabled={ids.includes(row.id) || references.length >= 10} onClick={() => { setReferences(current => [...current, { materialId: row.id }]); setPicker(false) }}><FileText size={18} /><span>{materialTitle(row.title)}</span><span>{ids.includes(row.id) ? '已添加' : '添加'}</span></button>) : <p>没有匹配的已采集内容。</p>}
    </div></Modal>}
  </section>
}
