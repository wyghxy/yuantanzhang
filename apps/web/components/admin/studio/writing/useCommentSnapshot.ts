'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorText } from '../studio-client'
import { studioAuthExpired, studioTaskChanged } from '../studio-query-cache'

/** Data bridge only; the approved original renderer owns all comments UI. */
export function useCommentSnapshot(materialId: string, active: boolean, frozen: boolean) {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null)
  const [revision, refresh] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submitting = useRef(false)
  useEffect(() => {
    if (!active || !materialId || frozen) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let reading = false, pending = false, failures = 0, taskId = ''
    const path = `materials/${encodeURIComponent(materialId)}/comments`
    const schedule = (delay: number) => { clearTimeout(timer); timer = setTimeout(() => { void poll() }, delay) }
    const stop = () => { controller.abort(); clearTimeout(timer) }
    const poll = async () => {
      if (controller.signal.aborted || document.hidden || navigator.onLine === false) return
      if (reading) { pending = true; return }
      reading = true; clearTimeout(timer)
      try {
        const result = await api(path, 'GET', undefined, controller.signal)
        if (controller.signal.aborted) return
        failures = 0; taskId = typeof result.task_id === 'string' ? result.task_id : ''
        setSnapshot({ ...result, record_id: materialId })
        if (result.status === 'loading') schedule(1500)
      } catch (error) {
        if (controller.signal.aborted) return
        const status = Number((error as { status?: number } | null)?.status || 0)
        setSnapshot(previous => previous?.record_id === materialId && previous.status === 'ready'
          ? previous : { record_id: materialId, status: 'failed', items: [], scope: 'collected' })
        if ([401, 403, 404].includes(status)) stop()
        else if ((!status || status >= 500) && ++failures <= 3) schedule(1500 * 2 ** (failures - 1))
      } finally {
        reading = false
        if (pending && !controller.signal.aborted) { pending = false; schedule(0) }
      }
    }
    const refresh = () => { if (!document.hidden) { failures = 0; void poll() } }
    const taskChanged = (event: Event) => {
      const changed = (event as CustomEvent<{ taskId?: string }>).detail?.taskId
      if (!changed || changed === taskId) refresh()
    }
    const visibility = () => { if (document.hidden) clearTimeout(timer); else refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener(studioTaskChanged, taskChanged)
    window.addEventListener(studioAuthExpired, stop)
    document.addEventListener('visibilitychange', visibility)
    void poll()
    return () => {
      stop()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener(studioTaskChanged, taskChanged)
      window.removeEventListener(studioAuthExpired, stop)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [materialId, active, frozen, revision])
  const collect = useCallback(async () => {
    if (submitting.current || !active || frozen || !materialId) return
    submitting.current = true; setBusy(true); setError('')
    try {
      // A click rechecks the existing request before retrying.
      const current = await api(`materials/${encodeURIComponent(materialId)}/comments`)
      if (current.status === 'not_collected') await api(`materials/${encodeURIComponent(materialId)}/comments`, 'POST', {})
      else if (current.status === 'failed' && typeof current.task_id === 'string')
        await api(`tasks/${encodeURIComponent(current.task_id)}/retry`, 'POST', {})
    } catch (cause) { setError(errorText(cause)) }
    finally { submitting.current = false; setBusy(false); refresh(value => value + 1) }
  }, [active, frozen, materialId])
  const value = snapshot?.record_id === materialId ? snapshot : active && materialId && !frozen
    ? { record_id: materialId, status: 'loading', items: [], scope: 'collected' }
    : null
  return { snapshot: value, collect, busy, error }
}
