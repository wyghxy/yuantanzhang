'use client'
import { useEffect, useRef, useState } from 'react'
import { isStudioPreview } from './studio-preview'
import { api, object, text, errorText, StudioClientError, type RecordData } from './studio-client'
import { studioAuthExpired } from './studio-query-cache'
import { mergeStudioEvents, studioEventCursor, studioTerminalStates } from './studio-operations-utils'
import { studioTaskScheduledRefreshDelay } from './studio-task-display'
import { studioTaskRefreshScheduler } from './studio-task-refresh'

type LogState = { key: string; detail: RecordData | null; events: RecordData[]; connection: string; error: string; resultPending: boolean; logsLoaded: boolean }
const empty = (key: string): LogState => ({ key, detail: null, events: [], connection: '正在读取任务状态', error: '', resultPending: false, logsLoaded: false })

/** Background consumers need progress, not step output or historical logs. */
export function useStudioTaskLog(taskId: string, enabled: boolean, revision: number, includeLogs = true, includeOutput = false) {
  const key = `${taskId}:${revision}`
  const [state, setState] = useState<LogState>(() => empty(''))
  const [visible, setVisible] = useState(true)
  const savedCursor = useRef({ key: '', seq: 0 })
  useEffect(() => {
    const changed = () => setVisible(!document.hidden)
    changed(); document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  useEffect(() => {
    if (!taskId || !enabled || !visible || isStudioPreview()) return
    if (savedCursor.current.key !== key) savedCursor.current = { key, seq: 0 }
    const controller = new AbortController()
    let poll: ReturnType<typeof setTimeout> | undefined, reconnect: ReturnType<typeof setTimeout> | undefined
    let source: EventSource | null = null, terminal = false, failures = 0
    let refreshing: Promise<void> | null = null
    let currentTask: RecordData = {}
    const update = (change: Partial<LogState> | ((value: LogState) => Partial<LogState>)) => {
      if (controller.signal.aborted) return
      setState(old => { const current = old.key === key ? old : empty(key); return { ...current, ...(typeof change === 'function' ? change(current) : change) } })
    }
    const stop = () => { controller.abort(); liveRefresh.dispose(); clearTimeout(poll); clearTimeout(reconnect); source?.close() }
    window.addEventListener(studioAuthExpired, stop)
    const failed = (error: unknown) => {
      if (controller.signal.aborted) return
      update({ error: errorText(error), connection: '连接中断，已保留当前状态', resultPending: false })
      if (error instanceof StudioClientError && [401, 403, 404].includes(error.status)) stop()
    }
    const readHistory = async () => {
      if (!includeLogs) return
      for (;;) {
        const data = await api(`tasks/${taskId}/events?projection=summary&after=${savedCursor.current.seq}`, 'GET', undefined, controller.signal)
        const incoming = Array.isArray(data.events) ? data.events as RecordData[] : []
        const next = studioEventCursor(incoming), previous = savedCursor.current.seq
        if (controller.signal.aborted) return
        savedCursor.current.seq = Math.max(previous, next)
        update(old => ({ events: mergeStudioEvents(old.events, incoming) }))
        if (incoming.length < 500 || next <= previous) { update({ logsLoaded: true }); return }
      }
    }
    const readTask = async () => {
      const data = await api(`tasks/${taskId}?projection=summary`, 'GET', undefined, controller.signal)
      if (controller.signal.aborted) return
      currentTask = object(data.task)
      terminal = studioTerminalStates.includes(text(currentTask.status))
      update({ detail: data, error: '', resultPending: terminal && includeOutput })
      if (terminal && includeOutput) {
        const result = await api(`tasks/${taskId}?projection=result`, 'GET', undefined, controller.signal)
        update({ detail: { ...data, task: { ...object(data.task), output: object(result.task).result } }, resultPending: false })
      }
    }
    const refreshTask = async (force = false) => {
      if (refreshing && !force) return refreshing
      while (refreshing) await refreshing
      if (controller.signal.aborted) return
      const request = readTask(); refreshing = request
      try { await request } finally { if (refreshing === request) refreshing = null }
    }
    const liveRefresh = studioTaskRefreshScheduler({ refresh: () => refreshTask(), onError: failed })
    const connect = () => {
      if (controller.signal.aborted || terminal || studioTaskScheduledRefreshDelay(currentTask)) return
      source?.close()
      source = new EventSource(`/api/workspace/studio/tasks/${taskId}/stream?projection=${includeLogs || includeOutput ? 'summary' : 'status'}&after=${savedCursor.current.seq}`)
      source.onopen = () => { failures = 0; update({ connection: includeLogs ? '日志已连接' : '任务状态已连接', error: '' }) }
      const receive = (event: MessageEvent) => {
        if (controller.signal.aborted) return
        if (includeOutput && !terminal) liveRefresh.request()
        try {
          const row = object(JSON.parse(event.data))
          savedCursor.current.seq = Math.max(savedCursor.current.seq, studioEventCursor([row]))
          if (includeLogs) update(old => ({ events: mergeStudioEvents(old.events, [row]) }))
        } catch { /* Invalid events never replace persisted progress. */ }
      }
      for (const name of ['queued', 'started', 'progress', 'checkpoint', 'step', 'succeeded', 'failed', 'blocked', 'cancelled', 'retry', 'log', 'cancel_requested', 'recovered', 'asr_waiting', 'collector_waiting']) source.addEventListener(name, receive as EventListener)
      source.onmessage = receive
      source.addEventListener('status', event => {
        if (controller.signal.aborted) return
        try {
          const status = object(JSON.parse((event as MessageEvent).data))
          const changed = ['status', 'phase', 'progress'].some(field => currentTask[field] !== status[field])
          currentTask = { ...currentTask, ...status }
          terminal = studioTerminalStates.includes(text(status.status))
          if (includeOutput && changed && !terminal) liveRefresh.request()
          update(old => ({ detail: { ...old.detail, task: { ...object(old.detail?.task), ...status } }, resultPending: terminal && includeOutput }))
          if (terminal || studioTaskScheduledRefreshDelay(currentTask)) {
            if (terminal) liveRefresh.dispose()
            clearTimeout(poll); source?.close()
            void start(true).catch(failed)
          }
        } catch { /* A malformed heartbeat never replaces the task. */ }
      })
      source.onerror = () => {
        source?.close()
        if (controller.signal.aborted || terminal || studioTaskScheduledRefreshDelay(currentTask)) return
        update({ connection: '连接中断，正在恢复任务状态' })
        // Read once before reconnecting: EventSource does not expose a 401 response.
        reconnect = setTimeout(() => void start().catch(failed), Math.min(15000, 2000 * 2 ** failures))
      }
    }
    const start = async (force = false) => {
      clearTimeout(poll); clearTimeout(reconnect)
      try {
        await refreshTask(force); await readHistory()
        if (controller.signal.aborted) return
        if (terminal) { liveRefresh.dispose(); source?.close(); source = null; update({ connection: includeLogs ? '已读取完整任务日志' : '任务已结束' }); return }
        const scheduledDelay = studioTaskScheduledRefreshDelay(currentTask)
        if (scheduledDelay) {
          source?.close(); source = null
          update({ connection: '等待计划时间' })
          poll = setTimeout(() => void start().catch(failed), scheduledDelay)
          return
        }
        connect()
        poll = setTimeout(() => void start().catch(failed), 55000)
      } catch (error) {
        failed(error)
        if (!controller.signal.aborted && ++failures <= 3)
          reconnect = setTimeout(() => void start().catch(failed), Math.min(15000, 2000 * 2 ** failures))
      }
    }
    void start()
    return () => { window.removeEventListener(studioAuthExpired, stop); stop() }
  }, [taskId, enabled, revision, key, includeLogs, includeOutput, visible])
  return state.key === key && enabled ? state : empty(key)
}
