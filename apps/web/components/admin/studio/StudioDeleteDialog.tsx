'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { api, errorText, list, object, text, StudioClientError, type RecordItem } from './studio-client'
import { useStudioPrivacy } from './StudioPrivacy'

export default function StudioDeleteDialog({ kind, record, close, onDeleted, onReference }: {
  kind: 'materials' | 'accounts' | 'topics' | 'drafts' | 'ideas'; record: RecordItem
  close: () => void; onDeleted: () => void; onReference?: (kind: string, id: string) => void
}) {
  const { materialTitle } = useStudioPrivacy()
  const dialog = useRef<HTMLDialogElement>(null), inFlight = useRef(false), titleId = useId()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [references, setReferences] = useState<RecordItem[]>([])
  const [target, setTarget] = useState(record), [changed, setChanged] = useState(false)
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => { element?.close(); previous?.focus() }
  }, [])
  async function remove() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await api(kind + '/' + encodeURIComponent(target.id), 'DELETE', { expectedVersion: target.version }); onDeleted() }
    catch (cause) {
      setError(errorText(cause))
      if (cause instanceof StudioClientError) {
        const latest = object(cause.data.current)
        setReferences(list(latest.references))
        if (cause.data.code === 'version_conflict' && latest.id === target.id && typeof latest.version === 'number') {
          setTarget(latest as RecordItem); setChanged(true)
        }
      }
    }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <div className="radar-source-page radar-source-dialog"><dialog ref={dialog} className="cw-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <header><h2 id={titleId}>删除确认</h2><button type="button" className="btn ghost" aria-label="关闭" disabled={busy} onClick={close}>✕</button></header>
    <p>{kind === 'materials' ? materialTitle(target.title, '未命名') : text(target.title || target.name, '未命名')}</p>
    {changed && <p role="status">此记录已更新，已显示最新标题。请核对后再次确认删除。</p>}
    <p>{kind === 'materials' ? '被选题或稿件引用的作品需要先解除引用。删除后可在“已删除”中恢复。' : '仅删除当前记录，保留原始素材及其他关联内容。'}</p>
    {error && <p role="alert">{error}</p>}
    {!!references.length && <ul>{references.map(row => <li key={row.kind + ':' + row.id}><button type="button" className="btn ghost" onClick={() => onReference?.(text(row.kind), row.id)}>{row.kind === 'topics' ? '选题：' : '稿件：'}{text(row.title)}</button></li>)}</ul>}
    <div className="cw-dialog-actions"><button type="button" className="btn" disabled={busy} onClick={close}>取消</button><button type="button" className="btn danger" disabled={busy || !!references.length} onClick={() => void remove()}>{busy ? '正在删除…' : changed ? '确认删除最新记录' : '删除'}</button></div>
  </dialog></div>
}
