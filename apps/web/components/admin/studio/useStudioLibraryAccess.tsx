'use client'

import { list } from './studio-client'
import { useStudioResource } from './StudioQueryProvider'

/** Deep links outside the page use the same saved library policy before reading full content. */
export function useStudioLibraryAccess({ selected, inPage, completeMode, modeReady, active, deleted, explicitRecoveryId = '' }: {
  selected: string; inPage: boolean; completeMode: boolean; modeReady: boolean; active: boolean; deleted: boolean; explicitRecoveryId?: string
}) {
  // Only a task's explicit recovery action supplies this one-record read intent.
  // It changes neither the completed library query nor the server's owner/creation guards.
  const recoverySelection = active && !deleted && !!selected && selected === explicitRecoveryId
  const access = useStudioResource('materials?' + new URLSearchParams({ collectionView: 'library',
    projection: 'summary', sample: 'all', ids: selected, limit: '1' }),
  modeReady && completeMode && !!selected && active && !deleted && !inPage && !recoverySelection)
  const pendingSelection = !recoverySelection && modeReady && completeMode && !!selected && !inPage && !!access.data && !list(access.data.items).length
  const detailAllowed = recoverySelection || modeReady && (!completeMode || inPage || list(access.data?.items).some(row => row.id === selected))
  return { access, pendingSelection, detailAllowed }
}

export function StudioLibraryAccessNotice({ pending, error, onTasks, onRetry }: {
  pending: boolean; error: boolean; onTasks: () => void; onRetry: () => void
}) {
  if (pending) return <div className="library-read-notice" role="status"><span>这篇作品尚未完成采集。</span><button type="button" className="btn-card-action secondary" onClick={onTasks}>查看任务队列</button></div>
  if (error) return <div className="library-read-notice" role="alert"><span>作品状态读取失败。</span><button type="button" className="btn-card-action secondary" onClick={onRetry}>重试作品状态</button></div>
  return null
}
