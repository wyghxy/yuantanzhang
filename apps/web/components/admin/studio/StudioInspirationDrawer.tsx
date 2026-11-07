'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Lightbulb, Plus, X } from 'lucide-react'
import { api, dateLabel, errorText, list, object, text, type RecordItem } from './studio-client'

export default function StudioInspirationDrawer({ open, close, onTopic, onChanged }: {
  open: boolean; close: () => void; onTopic: (id: string) => void; onChanged: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState(''), [items, setItems] = useState<RecordItem[]>([])
  const [expanded, setExpanded] = useState(false), [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [settledRequest, setSettledRequest] = useState(''), [offset, setOffset] = useState(0)
  const requestKey = [expanded, revision, offset].join(':')
  const loading = open && settledRequest !== requestKey
  const pending = useRef(false)
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    const trigger = document.activeElement as HTMLElement | null
    const modal = dialog.current
    modal?.showModal(); input.current?.focus()
    return () => { modal?.close(); trigger?.focus() }
  }, [open])
  useEffect(() => {
    const refresh = () => { setOffset(0); setRevision(value => value + 1) }
    window.addEventListener('studio-ideas-changed', refresh)
    return () => window.removeEventListener('studio-ideas-changed', refresh)
  }, [])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void api('ideas?limit=' + (expanded ? 100 : 5) + '&offset=' + (expanded ? offset : 0) + '&sample=all', 'GET', undefined, controller.signal)
      .then(value => { if (controller.signal.aborted) return; setItems(previous => expanded && offset ? [...previous, ...list(value.items).filter(item => !previous.some(row => row.id === item.id))] : list(value.items)); setTotal(Number(value.total) || 0); setError('') })
      .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
      .finally(() => { if (!controller.signal.aborted) setSettledRequest(requestKey) })
    return () => controller.abort()
  }, [open, expanded, revision, offset, requestKey])
  function changed() { setRevision(value => value + 1); onChanged(); window.dispatchEvent(new Event('studio-ideas-changed')) }
  async function save() {
    if (pending.current || !content.trim()) return
    pending.current = true; setBusy('save'); setError('')
    const submitted = content
    try { await api('ideas', 'POST', { content: submitted.trim() }); setContent(current => current === submitted ? '' : current); changed() }
    catch (cause) { setError(errorText(cause)) } finally { pending.current = false; setBusy('') }
  }
  async function convert(item: RecordItem) {
    if (pending.current) return
    if (item.topicId) { close(); onTopic(text(item.topicId)); return }
    pending.current = true; setBusy(item.id); setError('')
    try {
      const result = await api('ideas/' + encodeURIComponent(item.id) + '/convert', 'POST', { expectedVersion: item.version })
      changed(); close(); onTopic(text(object(result.topic).id))
    } catch (cause) { setError(errorText(cause)) } finally { pending.current = false; setBusy('') }
  }
  return <dialog ref={dialog} id="inspiration-drawer" aria-labelledby="quick-inspiration-title" onCancel={event => { event.preventDefault(); close() }}>
    <header className="quick-ideas-heading"><div className="quick-ideas-title"><span className="quick-ideas-symbol"><Lightbulb className="icon" /></span><h2 id="quick-inspiration-title" tabIndex={-1}>灵感风暴</h2></div><button className="icon-button" id="close-inspiration" aria-label="关闭灵感风暴" onClick={close}><X className="icon" /></button></header>
    <div className="quick-ideas-body">
      <form id="quick-inspiration-form" className="inspiration-composer" onSubmit={event => { event.preventDefault(); void save() }}>
        <label className="sr-only" htmlFor="quick-inspiration-input">记录灵感</label>
        <textarea ref={input} id="quick-inspiration-input" placeholder="记下一个灵感…" rows={4} maxLength={500} value={content} onChange={event => setContent(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void save() } }} />
        <div className="composer-actions"><span id="quick-inspiration-length">{Array.from(content).length} / 500</span><button className="primary" id="quick-save-inspiration" disabled={!!busy || !content.trim()}><Plus className="icon" />{busy === 'save' ? '保存中…' : '记下来'}</button></div>
      </form>
      <div className="quick-ideas-list-heading"><h3 id="quick-inspiration-list-title">最近灵感 <span id="quick-inspiration-count">{total}</span></h3>{total > 5 && <button className="text-link" id="quick-all-inspirations" onClick={() => { setOffset(0); setExpanded(value => !value) }}>{expanded ? '收起' : '查看全部'}</button>}</div>
      <section id="quick-inspiration-list" aria-labelledby="quick-inspiration-list-title" aria-busy={loading}>
        {items.map(item => <article className="inspiration-entry" key={item.id}><p>{text(item.content)}</p><footer><time dateTime={text(item.createdAt)}>{dateLabel(item.createdAt)}</time><button className="text-link" disabled={!!busy} onClick={() => void convert(item)}>{busy === item.id ? '处理中…' : item.topicId ? '查看选题' : '转为选题'}<ArrowRight className="icon" /></button></footer></article>)}
        {!items.length && <p className="empty-state">{loading ? '正在读取灵感…' : '你的下一个选题，可以从这里开始。'}</p>}
        {expanded && items.length < total && <button className="text-link" disabled={loading} onClick={() => setOffset(items.length)}>加载更多</button>}
      </section>
      <p id="quick-inspiration-feedback" role={error ? 'alert' : 'status'}>{error}</p>
    </div>
  </dialog>
}
