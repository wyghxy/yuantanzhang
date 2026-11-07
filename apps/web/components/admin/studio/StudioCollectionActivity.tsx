'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { list } from './studio-client'
import { useStudioResource } from './StudioQueryProvider'
import { studioCollectionActivity } from './studio-collection-activity'
import { invalidateStudioQueries } from './studio-query-cache'
import s from './StudioWorkbench.module.css'

export default function StudioCollectionActivity({ platform, accountId, enabled = true, onOpen }: {
  platform: string; accountId: string; enabled?: boolean; onOpen?: () => void
}) {
  const [visible, setVisible] = useState(true)
  const params = new URLSearchParams({ projection: 'summary', status: 'active', limit: '50' })
  if (accountId !== 'all') params.set('accountId', accountId)
  const result = useStudioResource('tasks?' + params, enabled && visible)
  const { running, queued } = studioCollectionActivity(list(result.data?.items), platform, accountId)
  const active = running + queued > 0
  const observed = useRef('')
  const signature = `${platform}:${accountId}:${running}:${queued}`
  const { refetch } = result
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    update(); document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (!enabled || !visible) return
    const timer = setInterval(() => { void refetch({ cancelRefetch: false }) }, active ? 3000 : 15000)
    return () => clearInterval(timer)
  }, [enabled, visible, active, refetch])
  useEffect(() => {
    if (!result.data || result.error || result.isPlaceholderData) return
    if (observed.current && observed.current !== signature) void invalidateStudioQueries('tasks')
    observed.current = signature
  }, [signature, result.data, result.error, result.isPlaceholderData])
  if (!enabled) return null
  const uncertain = result.isPending || result.isPlaceholderData
  const label = `${result.data?.hasMore ? '已读取任务：' : ''}${running ? `采集中 ${running} 项` : ''}${running && queued ? ' · ' : ''}${queued ? `排队中 ${queued} 项` : ''}`
  // 看得到"在采集"就必须点得进去：这句话本身是入口，而不只是一行说明。
  // 空闲与读取中不渲染，避免一句恒定的"当前没有采集任务运行"长期占着标题行。
  return <span className="collection-activity-slot" role="status" aria-live="polite">
    {result.error
      ? <span className="collection-activity is-error">采集状态更新失败</span>
      : !uncertain && active && (onOpen
        ? <button type="button" className="collection-activity is-active" onClick={onOpen} title="查看任务队列">
            <LoaderCircle size={13} className={s.spin} aria-hidden="true" />
            {label}
            <span className="collection-activity-go" aria-hidden="true">→</span>
          </button>
        : <span className="collection-activity is-active">
            <LoaderCircle size={13} className={s.spin} aria-hidden="true" />
            {label}
          </span>)}
  </span>
}
