'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { api, apiFresh, errorText, list, object, text, type RecordItem } from './studio-client'
import { useStudioResource, useStudioSearch } from './StudioQueryProvider'
import { Busy, Modal } from './StudioUI'
import { StudioTopicDialog } from './StudioTopicDialog'
import { openStudioTopicDraft } from './studio-creation-client'
import s from './StudioCreationCenter.module.css'

export const topicStatusLabel = (value: unknown) => ({
  idea: '待创作', pending: '待创作', adopted: '整理中', draft: '整理中',
  writing: '创作中', published: '已完成', done: '已完成', archived: '已归档',
}[text(value)] || '待创作')

type CreationCenterProps = {
  feed: ReactNode; revision: number; onChanged: () => void
  initialTopicId?: string
  onDraft: (id: string) => void; notify: (message: string) => void
}

export default function StudioCreationCenter(props: CreationCenterProps) {
  return <CreationCenterSession key={props.initialTopicId || ''} {...props} />
}

function CreationCenterSession({ feed, onChanged, onDraft, notify, initialTopicId = '' }: CreationCenterProps) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0), search = useStudioSearch(query)
  const params = new URLSearchParams({ projection: 'summary', limit: '30', offset: String(offset), sample: 'all', q: search })
  if (status) params.set('topicState', status)
  const result = useStudioResource('topics?' + params)
  const items = list(result.data?.items), loading = result.isPending, error = result.error ? errorText(result.error) : ''
  const [working, setBusy] = useState(false), [panel, setPanel] = useState('left')
  const opening = useRef<AbortController | null>(null)
  useEffect(() => () => opening.current?.abort(), [])
  const [locating, setLocating] = useState(!!initialTopicId)
  const busy = working || locating
  const [edit, setEdit] = useState<RecordItem | 'new' | null>(null), [remove, setRemove] = useState<RecordItem | null>(null)
  useEffect(() => {
    if (!initialTopicId) return
    const controller = new AbortController()
    // A source link only reads the existing topic. Opening a writing draft here
    // would create a new source as a side effect of navigating from knowledge.
    void apiFresh('topics/' + encodeURIComponent(initialTopicId), controller.signal).then(result => {
      if (controller.signal.aborted) return
      const item = object(result.item)
      if (text(item.id) !== initialTopicId) throw new Error('这条选题已不可用，请在选题库重新选择。')
      setEdit(item as RecordItem)
      setPanel('left')
    }).catch(reason => {
      if (!controller.signal.aborted) notify(errorText(reason))
    }).finally(() => {
      if (!controller.signal.aborted) setLocating(false)
    })
    return () => controller.abort()
  }, [initialTopicId, notify])
  async function editTopic(item: RecordItem) {
    if (busy) return
    setBusy(true)
    try { setEdit(object((await api(`topics/${item.id}`)).item) as RecordItem) }
    catch (reason) { notify(errorText(reason)) }
    finally { setBusy(false) }
  }
  async function write(item: RecordItem) {
    if (busy || opening.current) return
    const controller = new AbortController()
    opening.current = controller
    setBusy(true)
    try {
      const id = await openStudioTopicDraft(item, controller.signal)
      if (!controller.signal.aborted) onDraft(id)
    } catch (reason) { if (!controller.signal.aborted) notify(errorText(reason)) }
    finally {
      if (opening.current === controller) opening.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  async function deleteTopic() {
    if (!remove || busy) return
    setBusy(true)
    try {
      await api(`topics/${remove.id}`, 'DELETE', { expectedVersion: remove.version })
      setRemove(null); onChanged(); notify('已移除选题')
    } catch (reason) { notify(errorText(reason)) }
    finally { setBusy(false) }
  }
  return <div className="radar-source-page"><section id="creation-workspace" aria-label="创作中心" data-panel={panel} data-mode="overview">
    <header className="cw-toolbar"><div className="cw-mobile-tabs" role="group" aria-label="切换工作面板">
      <button aria-pressed={panel === 'left'} onClick={() => setPanel('left')}>选题库</button>
      <button aria-pressed={panel === 'right'} onClick={() => setPanel('right')}>情报流</button>
    </div>
    </header><div className="cw-grid">
      <section className="cw-left" id="cw-left" aria-label="选题库"><div className="cw-topic-library" id="cw-library">
        <header className="cw-panel-head"><div><h2>选题库 <span id="cw-topic-count">{result.data ? Number(result.data.total) : '—'}</span></h2></div>
          <div className={s.projectActions}><Link className="btn ghost" href="/workspace/creation">内容项目</Link>
            <button id="cw-new" className="btn" onClick={() => setEdit('new')} disabled={busy}>＋ 新建选题</button></div></header>
        {locating && <p role="status">正在打开原选题…</p>}
        <div className="cw-search"><input id="cw-topic-search" type="search" aria-label="搜索选题" placeholder="搜索选题…" value={query} onChange={event => { setQuery(event.target.value); setOffset(0) }} />
          <select id="cw-topic-status" aria-label="筛选选题状态" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}><option value="">全部状态</option>
            {Object.entries({ pending: '待创作', draft: '整理中', writing: '创作中', done: '已完成', archived: '已归档' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
        <div id="cw-topic-list" className="cw-topic-list" role="region" aria-label="选题列表" tabIndex={0}>{error && <p role="alert">{error} <button onClick={() => void result.refetch()}>重试</button></p>}{loading ? <Busy /> : items.length ? items.map(item => <article key={item.id} className="cw-topic-row">
          <div className="cw-topic-content"><div className="cw-topic-row-top"><span>{topicStatusLabel(item.status)}</span><span>{Number(item.referenceCount) || 0} 篇素材</span></div>
            <button className="cw-topic-title" disabled={busy} onClick={() => void write(item)}>{text(item.title)}</button>
            {item.notes ? <span className="cw-topic-note">{text(item.notes)}</span> : null}</div>
          <div className="cw-row-actions" role="group" aria-label="选题操作"><button className="btn cw-action-primary" disabled={busy} onClick={() => void write(item)}>{item.hasDraft ? '继续写稿' : '开始创作'}</button>
            <button className="btn ghost" disabled={busy} onClick={() => void editTopic(item)}>整理选题</button><button className="btn ghost cw-action-remove" disabled={busy} onClick={() => setRemove(item)}>移除</button></div>
        </article>) : <p className="cw-empty">没有匹配的选题</p>}</div>
        {(offset > 0 || result.data?.hasMore) ? <div className="feed-pagination"><button className="btn ghost" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>上一页</button><span>{Math.floor(offset / 30) + 1}</span><button className="btn ghost" disabled={!result.data?.hasMore} onClick={() => setOffset(Number(result.data?.nextOffset))}>下一页</button></div> : null}
      </div></section>
      <section className="cw-right" id="cw-right" aria-label="参考素材">{feed}</section>
    </div>
    {edit && <StudioTopicDialog item={edit === 'new' ? null : edit} close={() => setEdit(null)} onSaved={item => {
      const created = edit === 'new'; setEdit(null); onChanged(); if (created) void write(item); else notify('已保留修改')
    }} />}
    {remove && <Modal title="移除选题" close={() => setRemove(null)} closeDisabled={busy}><p>移除“{text(remove.title)}”？已收录的素材仍保留。</p>
      <div className={s.dialogActions}><button className="btn" disabled={busy} onClick={() => setRemove(null)}>取消</button><button className="btn primary" disabled={busy} onClick={() => void deleteTopic()}>移除</button></div></Modal>}
  </section></div>
}
