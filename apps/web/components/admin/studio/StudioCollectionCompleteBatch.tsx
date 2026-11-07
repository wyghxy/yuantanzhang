'use client'

import { useEffect, useRef, useState } from 'react'
import { api, errorText, list, text } from './studio-client'

/** One reviewed request completes the discovered works in the current filter scope. */
export default function StudioCollectionCompleteBatch({ query, disabled, onChanged, notify }: {
  query: string; disabled?: boolean; onChanged: () => void; notify: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const request = useRef<{ selection: string; key: string } | null>(null)
  useEffect(() => () => { pending.current?.abort(); pending.current = null }, [query])
  async function complete() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller; setBusy(true)
    try {
      const params = new URLSearchParams(query)
      params.set('projection', 'summary'); params.set('deliveryStatus', 'incomplete')
      params.set('limit', '50'); params.set('offset', '0'); params.set('listMode', 'cards')
      const data = await api('materials?' + params, 'GET', undefined, controller.signal)
      controller.signal.throwIfAborted()
      const items = list(data.items).map(item => ({ materialId: item.id }))
      if (!items.length) { notify('当前范围没有待完成的作品'); onChanged(); return }
      const selection = JSON.stringify(items.map(item => item.materialId).sort())
      if (request.current?.selection !== selection) request.current = { selection, key: crypto.randomUUID() }
      const result = await api('materials/content-batch', 'POST', {
        items, idempotencyKey: request.current.key,
      }, controller.signal)
      controller.signal.throwIfAborted()
      request.current = null
      const tasks = list(result.tasks), blocked = list(result.blocked), skipped = list(result.skipped)
      const queued = tasks.length ? `已提交 ${tasks.length} 条完整采集` : '本次没有新增任务'
      const active = skipped.filter(item => item.state === 'active').length
      const complete = skipped.filter(item => item.state === 'complete').length
      const remaining = Math.max(0, Number(data.total || 0) - items.length)
      notify([queued, active ? `${active} 条正在处理` : '', complete ? `${complete} 条已完成` : '',
        blocked.length ? `${blocked.length} 条需处理：${text(blocked[0].message, '请查看任务详情')}` : '',
        remaining ? `另有 ${remaining} 条待完成，可继续分批采集` : '',
      ].filter(Boolean).join('；'))
      onChanged()
    } catch (error) {
      if (!controller.signal.aborted) notify(errorText(error))
    } finally {
      if (pending.current === controller) pending.current = null
      setBusy(false)
    }
  }
  return <button type="button" className="btn-card-action primary" disabled={disabled || busy}
    title="一次确认当前筛选范围内最多50条作品，获取视频和逐字稿；已完成和处理中的作品自动跳过"
    onClick={() => void complete()}>{busy ? '正在核算…' : '完成本批采集'}</button>
}
