'use client'

import { useEffect, useRef, useState } from 'react'
import { api, errorText, text, type RecordItem } from './studio-client'
import { studioReferenceIds } from '@ytz/contracts/studio-radar'
import { Modal } from './StudioUI'
import s from './StudioCreationCenter.module.css'

export function StudioTopicDialog({ item, close, onSaved }: {
  item: RecordItem | null; close: () => void; onSaved: (item: RecordItem) => void
}) {
  const [title, setTitle] = useState(text(item?.title)), [status, setStatus] = useState(text(item?.status, 'idea'))
  const [notes, setNotes] = useState(text(item?.notes)), [outline, setOutline] = useState(text(item?.outline))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const saving = useRef(false)
  const dirty = title !== text(item?.title) || status !== text(item?.status, 'idea') || notes !== text(item?.notes) || outline !== text(item?.outline)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: dirty }))
    const beforeLeave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', beforeLeave)
    return () => { window.removeEventListener('beforeunload', beforeLeave); window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: false })) }
  }, [dirty])
  async function save() {
    if (saving.current || !title.trim()) return
    saving.current = true
    setBusy(true); setError('')
    try {
      const data = await api(item ? `topics/${item.id}` : 'topics', item ? 'PATCH' : 'POST', {
        title: title.trim(), status, notes, outline, ...(item ? { expectedVersion: item.version } : {}),
      })
      window.dispatchEvent(new CustomEvent('studio-topic-dirty', { detail: false }))
      onSaved(data.item as RecordItem)
    } catch (reason) { setError(errorText(reason)) }
    finally { saving.current = false; setBusy(false) }
  }
  function dismiss() { if (!dirty || window.confirm('当前编辑还没有保存，确认离开这个页面？')) close() }
  return <Modal title={item ? '整理选题' : '新建选题'} close={dismiss} closeDisabled={busy}>
    <form className={s.form} onSubmit={event => { event.preventDefault(); void save() }}>
      <label>{item ? '标题' : '选题标题'}<input required disabled={busy} maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></label>
      {item && <><label>状态<select disabled={busy} value={status} onChange={event => setStatus(event.target.value)}>
        <option value="idea">待创作</option><option value="adopted">整理中</option><option value="writing">创作中</option><option value="published">已完成</option>
        {['pending', 'draft', 'done', 'archived'].includes(status) && <option value={status}>{status === 'archived' ? '已归档' : status === 'done' ? '已完成' : status === 'draft' ? '整理中' : '待创作'}</option>}
      </select></label><label>想法与线索<textarea disabled={busy} rows={4} maxLength={12000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <label>创作大纲<textarea disabled={busy} rows={5} maxLength={20000} value={outline} onChange={event => setOutline(event.target.value)} /></label>
        <p>关联 {studioReferenceIds(item).length} 条素材</p></>}
      {error && <p role="alert">{error}</p>}
      <div className={s.dialogActions}>{!item && <button type="button" className="btn" disabled={busy} onClick={dismiss}>取消</button>}
        <button className="btn primary" disabled={busy || !title.trim()}>{busy ? '正在保存…' : item ? '保留修改' : '开始创作'}</button></div>
    </form>
  </Modal>
}
