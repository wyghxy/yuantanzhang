'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminShell } from '../AdminShell'
import { api, apiRequest, StudioClientError, type RecordItem } from './studio-client'
import { isStudioPreview } from './studio-preview'
import { cacheStudioReadResult } from './studio-read-cache'
import { StudioReadSession, type ReadState } from './studio-read-session'

/** Mounted only for the opened work, never for a list item or prefetched detail. */
export default function StudioReadState({ material, enabled, className = 'btn ghost' }: {
  material: RecordItem; enabled: boolean; className?: string
}) {
  // All reader hosts key this component by material ID: reopening starts a fresh session.
  const [session] = useState(() => new StudioReadSession())
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const current = session.current(material), client = useQueryClient(), { userId } = useAdminShell()
  const preview = isStudioPreview()
  const save = useMemo(() => async (item: RecordItem, state: ReadState) => {
    const path = 'materials/' + encodeURIComponent(item.id)
    let result
    try { result = await api(path, 'PATCH', { expectedVersion: item.version, readState: state }) }
    catch (cause) {
      // A newer note/import must never be overwritten. Refresh the version and let the user retry.
      if (cause instanceof StudioClientError && cause.status === 409) {
        const latest = await apiRequest(path)
        cacheStudioReadResult(client, path, String(userId), item.id, latest)
        throw new Error('作品已更新，阅读状态尚未保存，请重试。')
      }
      throw cause
    }
    return cacheStudioReadResult(client, path, String(userId), item.id, result)
  }, [client, userId])
  useEffect(() => {
    if (!enabled || preview) return
    const opened = () => {
      if (document.visibilityState === 'visible') void session.opened(material, true, save)
    }
    opened()
    document.addEventListener('visibilitychange', opened)
    return () => document.removeEventListener('visibilitychange', opened)
  }, [session, material, enabled, preview, save])
  const read = current.readState === 'read'
  const label = snapshot.pending ? '保存中…' : snapshot.error ? '重试标记' : read ? '标为未读' : '标为已读'
  return <button type="button" className={className} disabled={snapshot.pending || preview}
    aria-label={snapshot.error ? '阅读状态未保存，重试标记' : read ? '已读，标为未读' : label} title={snapshot.error || (read ? '已读。重新放回待读列表，本次阅读不会再次自动标记' : '未读。打开作品后自动标为已读，也可以手动标记')}
    onClick={() => void session.change(current, snapshot.retryState || (read ? 'unread' : 'read'), save)}>
    <span role={snapshot.error ? 'alert' : 'status'}>{label}</span>
  </button>
}
