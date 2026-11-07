'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api, errorText, object, text, type RecordData, type RecordItem } from './studio-client'
import { studioAccountCaptureNotice, studioAccountCaptureTask, studioAccountState } from './studio-account-state'
import { captureLimit, DEFAULT_CAPTURE_LIMIT, rememberCaptureLimit, storedCaptureLimit, subscribeCaptureLimit } from './studio-capture-limit'

const serverCaptureLimit = () => DEFAULT_CAPTURE_LIMIT

/** Each account owns its submission lock and task; unrelated accounts remain usable. */
export function useStudioAccountCapture(onChanged: () => void, notify: (message: string) => void, onError: (message: string) => void) {
  const [tasks, setTasks] = useState<Record<string, RecordData>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  // Reading the saved count through the store keeps the server-rendered default
  // and the browser value in sync without a state write inside an effect.
  const limit = useSyncExternalStore(subscribeCaptureLimit, storedCaptureLimit, serverCaptureLimit)
  const locks = useRef(new Set<string>())
  const callbacks = useRef({ onChanged, notify, onError })
  useEffect(() => { callbacks.current = { onChanged, notify, onError } }, [onChanged, notify, onError])
  const activeKey = JSON.stringify(Object.entries(tasks)
    .filter(([, task]) => ['queued', 'running'].includes(text(task.status)))
    .map(([accountId, task]) => [accountId, text(task.id)]).filter(([, id]) => id).sort())

  useEffect(() => {
    const active = JSON.parse(activeKey) as [string, string][]
    if (!active.length) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (document.hidden) { timer = setTimeout(() => void poll(), 5000); return }
      let unauthorized = false
      await Promise.all(active.map(async ([accountId, taskId]) => {
        try {
          const result = await api(`tasks/${encodeURIComponent(taskId)}?projection=summary`, 'GET', undefined, controller.signal)
          if (controller.signal.aborted) return
          const task = object(result.task)
          if (task.id !== taskId) return
          setTasks(current => current[accountId]?.id === taskId ? { ...current, [accountId]: task } : current)
          if (!['queued', 'running'].includes(text(task.status))) callbacks.current.onChanged()
        } catch (error) {
          if (controller.signal.aborted) return
          unauthorized ||= object(error).status === 401
          callbacks.current.onError(errorText(error))
        }
      }))
      if (!controller.signal.aborted && !unauthorized) timer = setTimeout(() => void poll(), 2500)
    }
    timer = setTimeout(() => void poll(), 1000)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [activeKey])

  const withTask = (account: RecordItem): RecordItem => ({ ...account, collection: studioAccountCaptureTask(account, tasks[account.id]) })
  function setLimit(value: number) {
    rememberCaptureLimit(value)
  }
  /** `count` comes from the operator's current choice; the server still accepts 1—100 only. */
  async function submit(account: RecordItem, kind: 'collect_creator' | 'resolve_creator', count?: number) {
    const state = studioAccountState(withTask(account))
    if (locks.current.has(account.id) || state.active) return
    if (state.captureBlocked) { callbacks.current.onError(state.captureHint); return }
    if (kind === 'collect_creator' && state.dailyBlocked) { callbacks.current.onError(state.dailyHint); return }
    locks.current.add(account.id)
    setSubmitting(current => ({ ...current, [account.id]: true }))
    callbacks.current.onError('')
    try {
      const result = await api('tasks', 'POST', {
        kind, accountId: account.id, expectedVersion: account.version, idempotencyKey: crypto.randomUUID(),
        ...(kind === 'collect_creator' ? { count: Math.min(state.captureCountLimit, captureLimit(count)), limit: Math.min(state.captureCountLimit, captureLimit(count)), sort: 'latest', collectionMode: 'latest' } : {}),
      })
      const task = object(result.task)
      if (!task.id) throw new Error('未取得采集任务编号，请刷新任务记录后再操作')
      setTasks(current => ({ ...current, [account.id]: task }))
      callbacks.current.onChanged()
      callbacks.current.notify(studioAccountCaptureNotice(task))
    } catch (error) {
      callbacks.current.onError(errorText(error))
    } finally {
      locks.current.delete(account.id)
      setSubmitting(current => ({ ...current, [account.id]: false }))
    }
  }
  async function recollect(account: RecordItem) {
    const state = studioAccountState(withTask(account))
    if (locks.current.has(account.id) || state.active) return
    if (!state.recaptureTaskId) { callbacks.current.onError('当前没有可安全重新采集的原请求，请查看对应任务'); return }
    locks.current.add(account.id)
    setSubmitting(current => ({ ...current, [account.id]: true }))
    callbacks.current.onError('')
    try {
      const result = await api(`tasks/${encodeURIComponent(state.recaptureTaskId)}/account-recapture`, 'POST', {})
      const task = object(result.task)
      if (!task.id) throw new Error('未取得新请求编号，请先查看任务记录，不要重复确认')
      setTasks(current => ({ ...current, [account.id]: task }))
      callbacks.current.onChanged()
      callbacks.current.notify(result.reused ? '已打开先前确认的新请求' : '已确认独立的新请求；旧请求记录保留')
    } catch (error) { callbacks.current.onError(errorText(error)) }
    finally { locks.current.delete(account.id); setSubmitting(current => ({ ...current, [account.id]: false })) }
  }
  function start(account: RecordItem, count = limit) {
    return submit(account, studioAccountState(withTask(account)).verified ? 'collect_creator' : 'resolve_creator', count)
  }
  /** Refresh only the verified profile. The shared client quotes before creating this one task. */
  function refreshProfile(account: RecordItem) { return submit(account, 'resolve_creator') }
  return { withTask, submitting, start, recollect, refreshProfile, limit, setLimit }
}
