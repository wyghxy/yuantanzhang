'use client'
import { useEffect, useRef, useState } from 'react'
import { api, apiFresh, errorText, object, text, type RecordData, type RecordItem } from './studio-client'
import { collectionRecoveryAction, currentCollectionRecoveryAction } from './studio-collection-recovery'
import { createUsageOperationScope } from '@/lib/usage-operation-scope'
import { Modal } from './StudioUI'
import StudioMaterialRecovery from './StudioMaterialRecovery'
import s from './StudioWorkbench.module.css'

/** A list click reads the current material before quoting; rendering never starts external work. */
export default function StudioCollectionRecovery({ item, changed, className = 'btn ghost' }: {
  item: RecordItem; changed?: () => void; className?: string
}) {
  const [current, setCurrent] = useState<RecordItem | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [repair, setRepair] = useState(false)
  const [acceptedTask, setAcceptedTask] = useState('')
  const submitting = useRef(false)
  const [recoveryScope] = useState(createUsageOperationScope)
  useEffect(() => () => recoveryScope.cancel(), [item.id, recoveryScope])
  const action = collectionRecoveryAction(item)
  async function open() {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError('')
    setMessage(acceptedTask ? '任务已提交，可在待处理中查看实际进度。' : '')
    try {
      const result = await apiFresh('materials/' + encodeURIComponent(item.id))
      setCurrent(result.item as RecordItem)
    } catch (cause) {
      if (acceptedTask) setMessage('任务已提交，状态刷新未完成。请重新读取，勿重复提交。')
      else setError(errorText(cause))
    }
    finally { submitting.current = false; setBusy(false) }
  }
  async function resume() {
    if (submitting.current || !current || acceptedTask) return
    submitting.current = true; setBusy(true); setError('')
    let admitted = false
    try {
      const signal = recoveryScope.begin()
      // Recheck after an open dialog: another tab may already have completed or resumed it.
      const fresh = (await apiFresh('materials/' + encodeURIComponent(current.id), signal)).item as RecordItem
      setCurrent(fresh)
      const next = await currentCollectionRecoveryAction(fresh, signal)
      let result: RecordData
      if (next?.kind === 'retry') result = await api('tasks/' + encodeURIComponent(next.taskId) + '/retry', 'POST', {}, signal)
      else if (next?.kind === 'start' || next?.kind === 'repair') result = await api('materials/' + encodeURIComponent(fresh.id) + '/prepare', 'POST', {}, signal)
      else { setMessage(next?.hint || '正文已经就绪，请重新读取作品。'); changed?.(); return }
      const task = object(result.task), preparation = object(result.preparation)
      if (result.taskError || ['failed', 'blocked', 'cancelled'].includes(text(task.status)))
        throw new Error(text(result.taskError) || text(task.error) || '采集尚未接收，请查看处理状态。')
      admitted = !!text(task.id) && ['queued', 'running'].includes(text(task.status))
      if (admitted) setAcceptedTask(text(task.id))
      const updated = (await apiFresh('materials/' + encodeURIComponent(fresh.id))).item as RecordItem
      setCurrent(updated)
      changed?.()
      const after = collectionRecoveryAction(updated)
      if (after?.kind === 'waiting' || ['queued', 'running'].includes(text(task.status)))
        setMessage('已提交处理，后台会继续执行，可在待处理中查看实际进度。')
      else if (!after)
        setMessage('采集内容已经就绪，请重新读取作品。')
      else throw new Error(after.hint || text(preparation.message) || '尚未确认入队，请重新读取处理状态。')
    } catch (cause) {
      if (admitted) {
        changed?.()
        setMessage('任务已提交，状态刷新未完成。请重新读取，勿重复提交。')
      } else setError(errorText(cause))
    }
    finally { submitting.current = false; setBusy(false) }
  }
  const selected = current && collectionRecoveryAction(current)
  if (!action && !current) return null
  return <>
    {action && <button type="button" className={className} disabled={busy || action.kind === 'waiting'} onClick={() => void open()}>{busy ? '正在读取…' : action.label}</button>}
    {!current && error && <span role="alert">{error}</span>}
    {current && !repair && <Modal title="继续处理作品" close={() => { setCurrent(null); setAcceptedTask(''); setError(''); setMessage('') }} closeDisabled={busy}>
      <p className={s.prose}>{String(current.title || '当前作品')}</p>
      {!acceptedTask && <p className={s.prose}>{selected?.hint || '正文已经就绪，可以继续阅读。'}</p>}
      {error && <p className={s.error} role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className={s.actions}>
        {!selected && <a className="btn primary" href={'/workspace/viral?view=works&material=' + encodeURIComponent(current.id)}>打开作品</a>}
        {/* Keep focus through the fresh-state preflight; submitting guards duplicate activation. */}
        {!acceptedTask && selected && ['retry', 'start', 'repair'].includes(selected.kind) && <button type="button" className="btn primary" aria-disabled={busy} onClick={() => void resume()}>{selected.label}</button>}
        {acceptedTask && <button type="button" className="btn ghost" disabled={busy} onClick={() => void open()}>重新读取</button>}
        {selected?.kind === 'waiting' && <span role="status">{selected.label}</span>}
        {!acceptedTask && selected && <button type="button" className="btn ghost" disabled={busy} onClick={() => setRepair(true)}>补充正文或原视频</button>}
        {selected?.kind === 'blocked' && <a className="btn ghost" href="/workspace/viral?view=capabilities">检查来源连接</a>}
        {!!object(current.collection).taskId && <a className="btn ghost" href="/workspace/viral?view=pending">查看待处理与日志</a>}
      </div>
    </Modal>}
    {current && repair && <StudioMaterialRecovery material={current} close={() => setRepair(false)} onSaved={() => { changed?.(); setCurrent(null); setRepair(false) }} notify={setMessage} />}
  </>
}
