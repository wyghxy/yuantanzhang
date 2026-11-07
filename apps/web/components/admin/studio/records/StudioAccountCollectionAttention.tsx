'use client'
import { object, type RecordData } from '../studio-client'
import { studioAccountAttention } from '../studio-account-state'

/** Locate the original task; an unknown request result never becomes an automatic retry. */
export function StudioAccountCollectionAttention({ task, onTask, onMaterial, onTasks }: {
  task: RecordData; onTask: (id: string) => void; onMaterial: (id: string) => void; onTasks: () => void
}) {
  const attention = studioAccountAttention(task)
  if (!attention.visible) return null
  const completion = object(task.completion)
  const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  const total = count(completion.total) ? completion.total : null
  const ready = count(completion.ready) ? completion.ready : 0
  const noSpeech = count(completion.noSpeech) ? completion.noSpeech : 0
  const completed = total === null ? 0 : Math.min(total, ready + noSpeech)
  const remaining = total === null ? null : Math.max(0, total - completed)
  const represented = new Set(attention.tasks.map(item => item.materialId).filter(Boolean))
  return <div className="creator-collection-attention" role="group" aria-label="本次采集未完成项">
    <p role="status">{total !== null && total > 0 && remaining
      ? `${completed}/${total} 已完成；${remaining} 篇采集未完成`
      : '本次采集尚未完整完成'}</p>
    <p>{task.receiptPending === true
      ? '原请求结果待核实，暂不重复发起。已保存的作品保留，请打开对应任务核对。'
      : '已保存的作品保留。请查看失败原因，并按对应任务提供的安全方式继续处理。'}</p>
    {attention.tasks.map((item, index) => <div className="creator-collection-tools" key={item.taskId}>
      <button type="button" className="btn ghost" onClick={() => onTask(item.taskId)}>
        {item.reason === 'receipt_pending' ? '核对未完成任务' : '查看失败原因 / 继续处理'}{attention.tasks.length > 1 ? ` ${index + 1}` : ''}
      </button>
      {item.materialId && <button type="button" className="btn ghost" onClick={() => onMaterial(item.materialId!)}>打开未完成作品{attention.tasks.length > 1 ? ` ${index + 1}` : ''}</button>}
    </div>)}
    {attention.materialIds.filter(id => !represented.has(id)).map((id, index) => <button type="button" className="btn ghost" key={id}
      onClick={() => onMaterial(id)}>打开未完成作品 {index + 1}</button>)}
    {attention.incompleteReason && <p>{attention.incompleteReason}</p>}
    {attention.truncated && <button type="button" className="btn ghost" onClick={onTasks}>查看其余采集任务</button>}
  </div>
}
