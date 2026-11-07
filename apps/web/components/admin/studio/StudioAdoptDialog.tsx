'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { studioReferenceIds } from '@ytz/contracts/studio-radar'
import { api, apiRequest, errorText, list, object, text, type RecordItem } from './studio-client'
import { studioCollectedMetadata } from './studio-collection-state'
import { useStudioPrivacy } from './StudioPrivacy'
import { useStudioResource, useStudioSearch } from './StudioQueryProvider'

export default function StudioAdoptDialog({ material, close, onSaved, defaultTopic }: {
  material: RecordItem; close: () => void; onSaved: (topic: RecordItem) => void | Promise<void>; defaultTopic?: RecordItem
}) {
  const { materialTitle } = useStudioPrivacy()
  const [selected, setSelected] = useState(defaultTopic?.id || ''), [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<RecordItem | undefined>(defaultTopic)
  const [page, setPage] = useState({ query: '', offset: 0 })
  const search = useStudioSearch(query), offset = page.query === search ? page.offset : 0
  const result = useStudioResource('topics?' + new URLSearchParams({ projection: 'summary', limit: '30', offset: String(offset), sample: 'all', q: search }))
  const topics = list(result.data?.items), loading = result.isPending
  const options = chosen && !topics.some(topic => topic.id === chosen.id) ? [chosen, ...topics] : topics
  const [title, setTitle] = useState(studioCollectedMetadata(material).title), [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false), requestKey = useRef<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => { element?.close(); previous?.focus() }
  }, [])
  async function adopt() {
    if (inFlight.current || loading || (!selected && !title.trim())) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      let saved: RecordItem
      if (selected) {
        // Read only the selected topic at the latest version before appending a reference.
        const response = await apiRequest('topics/' + encodeURIComponent(selected))
        const topic = object(response.item || response.topic) as RecordItem
        if (topic.id !== selected) throw new Error('选题已变化，请重新选择')
        const ids = studioReferenceIds(topic)
        saved = topic
        if (!ids.includes(material.id)) {
          const updated = await api('topics/' + topic.id, 'PATCH', {
          expectedVersion: topic.version,
          references: [...(Array.isArray(topic.references) ? topic.references : ids.map(materialId => ({ materialId }))), { materialId: material.id }],
          })
          saved = object(updated.topic || updated.item) as RecordItem
        }
      } else {
        requestKey.current ||= 'adopt:' + crypto.randomUUID()
        const created = await api('topics', 'POST', { title: title.trim(), status: 'adopted', linkKey: requestKey.current, references: [{ materialId: material.id }] })
        saved = object(created.topic || created.item) as RecordItem
      }
      await onSaved(saved)
    } catch (reason) { setError(errorText(reason)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <div className="radar-source-page radar-source-dialog"><dialog ref={dialog} className="cw-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) close() }}
    onClick={event => { if (!busy && event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close() } }}>
    <form onSubmit={event => { event.preventDefault(); void adopt() }}>
      <header><h2 id={titleId}>采纳到选题</h2><button className="btn ghost" type="button" aria-label="关闭" disabled={busy} onClick={close}>✕</button></header>
      <p>{materialTitle(studioCollectedMetadata(material).title)}</p>
      <label>搜索选题<input type="search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="搜索选题…" maxLength={200} /></label>
      <label>加入选题<select aria-label="选择采纳选题" value={selected} disabled={loading || busy} onChange={event => { setSelected(event.target.value); setChosen(options.find(topic => topic.id === event.target.value)) }}>
        <option value="">＋ 新建选题</option>{options.map(topic => <option key={topic.id} value={topic.id}>{text(topic.title)}</option>)}
      </select></label>
      {(offset > 0 || result.data?.hasMore === true) && <div className="cw-dialog-actions"><button type="button" className="btn" disabled={busy || loading || !offset} onClick={() => setPage({ query: search, offset: Math.max(0, offset - 30) })}>上一页</button><button type="button" className="btn" disabled={busy || loading || !result.data?.hasMore} onClick={() => setPage({ query: search, offset: offset + 30 })}>下一页</button></div>}
      {!selected && <label>选题标题<input required maxLength={100} autoComplete="off" disabled={busy} value={title} onChange={event => setTitle(event.target.value)} /></label>}
      {(error || result.error) && <p role="alert">{error || errorText(result.error)}</p>}
      <div className="cw-dialog-actions"><button className="btn" type="button" disabled={busy} onClick={close}>取消</button>
        <button className="btn primary" disabled={busy || loading || (!selected && !title.trim())}>{busy ? '正在保存…' : '采纳'}</button></div>
    </form>
  </dialog></div>
}
