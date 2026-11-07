'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MaterialPreparation } from '@ytz/contracts/studio-playback'
import { api, apiRequest, errorText } from '../studio-client'
import { isStudioPreview } from '../studio-preview'
import { useElapsedWait } from './useElapsedWait'

export function useMaterialPreparation(id: string, endpoint: 'prepare' | 'player', active: boolean, onReady: () => void) {
  const [snapshot, setSnapshot] = useState<{ key: string; value: MaterialPreparation | null; error: string }>({ key: '', value: null, error: '' })
  const [revision, refresh] = useState(0)
  const requestKey = id + ':' + endpoint + ':' + active + ':' + revision
  const value = snapshot.key === requestKey ? snapshot.value : null
  const readyKey = useRef(''), callback = useRef(onReady), identity = useRef(id)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { callback.current = onReady; identity.current = id }, [onReady, id])
  useEffect(() => {
    if (!id || !active || isStudioPreview()) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const path = `materials/${encodeURIComponent(id)}/${endpoint}`
    async function load() {
      try {
        // Progress polling must observe the server, not the general material-list cache.
        const result = await apiRequest(path, 'GET', undefined, controller.signal) as unknown as MaterialPreparation
        if (controller.signal.aborted) return
        setSnapshot({ key: requestKey, value: result, error: '' })
        if (result.state === 'ready') {
          const key = id + ':' + result.fingerprint
          if (readyKey.current !== key) { readyKey.current = key; callback.current() }
        } else if (result.state === 'loading') timer = setTimeout(() => void load(), 1800)
      } catch (cause) {
        if (!controller.signal.aborted) setSnapshot(previous => ({ key: requestKey, value: previous.key === requestKey ? previous.value : null, error: errorText(cause) }))
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [id, endpoint, active, requestKey])
  const retry = useCallback(async () => {
    if (submitting.current || !active || !id || isStudioPreview()) return
    submitting.current = true; setBusy(true)
    const requestedId = id
    setSnapshot(previous => ({ ...previous, error: '' }))
    try {
      // The player only reloads saved media; it never retries an external task.
      if (endpoint === 'player') {
        if (identity.current === requestedId) refresh(n => n + 1)
        return
      }
      if (value?.task && value.recovery?.retry !== false && ['failed', 'blocked', 'cancelled'].includes(value.task.status))
        await api(`tasks/${encodeURIComponent(value.task.id)}/retry`, 'POST', {})
      else if (value?.state === 'idle')
        await api(`materials/${encodeURIComponent(id)}/${endpoint}`, 'POST', {})
      if (identity.current === requestedId) refresh(n => n + 1)
    } catch (cause) {
      if (identity.current === requestedId) setSnapshot(previous => ({ ...previous, error: errorText(cause) }))
    } finally {
      submitting.current = false; setBusy(false)
    }
  }, [id, value, active, endpoint])
  const error = id && active && isStudioPreview() ? '试用预览不调用模型，请在正式工作台准备原文和视频' : snapshot.key === requestKey ? snapshot.error : ''
  const waiting = !!id && active && !error && (busy || !value || value.state === 'loading')
  const elapsedSeconds = useElapsedWait(waiting, requestKey)
  return { value, error, retry, waiting, busy, elapsedSeconds }
}
