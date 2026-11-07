'use client'
import { useEffect, useRef, useState } from 'react'
import { playbackFailureReport, type MaterialPreparation, type PlaybackFailureReport } from '@ytz/contracts/studio-playback'
import { apiRequest, errorText, object } from '../studio-client'

type State = { key: string; report?: PlaybackFailureReport; busy?: boolean; message?: string }

/** Diagnosis is read-only. Only an explicit button press starts a local conversion. */
export function usePlaybackCompatibility(id: string, preparation: MaterialPreparation | null, onReady: () => void) {
  const key = `${id}:${preparation?.mediaUrl || ''}`
  const identity = useRef(key), ready = useRef(onReady), current = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const diagnosing = useRef(false)
  const [snapshot, setSnapshot] = useState<State>({ key: '' })
  useEffect(() => { ready.current = onReady }, [onReady])
  useEffect(() => { identity.current = key; current.current?.abort()
    current.current = new AbortController()
    return () => current.current?.abort()
  }, [key])
  const state = snapshot.key === key ? snapshot : { key }
  async function diagnose(video: HTMLVideoElement) {
    if (submitting.current || diagnosing.current) return
    const format = preparation?.sourceFormat, url = preparation?.mediaUrl
    if (!format || !url || !preparation) return
    setSnapshot({ key })
    if (!playbackFailureReport(format, preparation.fingerprint, video.error?.code, 200, video.canPlayType(format.mime), video)) return
    const requested = key, signal = current.current?.signal
    diagnosing.current = true
    try {
      const response = await fetch(url, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store', signal })
      const report = playbackFailureReport(format, preparation.fingerprint, video.error?.code, response.status, video.canPlayType(format.mime), video)
      if (report && response.headers.get('content-type')?.split(';')[0] === format.mime.split(';')[0] && identity.current === requested)
        setSnapshot({ key: requested, report })
    } catch { /* Transport or permission failure must never authorize conversion. */ }
    finally { diagnosing.current = false }
  }
  async function convert() {
    if (!state.report || submitting.current || !current.current) return
    const requested = key, report = state.report, signal = current.current.signal
    submitting.current = true
    setSnapshot({ key: requested, report, busy: true, message: '正在排队转换，原片与逐字稿保留' })
    try {
      const response = await apiRequest(`materials/${encodeURIComponent(id)}/player`, 'POST',
        { confirmed: true, playbackFailure: report }, signal)
      let task = object(response.task)
      if (typeof task.id !== 'string') throw new Error('未取得兼容处理任务，请重试')
      while (['queued', 'running'].includes(String(task.status))) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(signal.reason) }
          const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 3000)
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) { signal.removeEventListener('abort', abort); abort() }
        })
        task = object((await apiRequest(`tasks/${encodeURIComponent(String(task.id))}?projection=summary`, 'GET', undefined, signal)).task)
        if (identity.current === requested) setSnapshot({ key: requested, report, busy: true,
          message: String(task.phase || (task.status === 'queued' ? '正在排队转换，原片与逐字稿保留' : '正在转换兼容视频')) })
      }
      if (task.status !== 'succeeded') throw new Error(String(task.error || '兼容处理未完成，原片与逐字稿保留'))
      if (identity.current === requested) { setSnapshot({ key: requested, message: '兼容视频已就绪' }); ready.current() }
    } catch (error) {
      if (!signal.aborted && identity.current === requested) setSnapshot({ key: requested, report, message: errorText(error) })
    } finally { submitting.current = false }
  }
  return { ...state, diagnose, convert }
}
