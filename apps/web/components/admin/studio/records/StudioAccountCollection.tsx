'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { text, type RecordData, type RecordItem } from '../studio-client'
import { useStudioPrivacy } from '../StudioPrivacy'
import StudioAdoptDialog from '../StudioAdoptDialog'
import { studioAccountCaptureNotice, studioAccountCaptureTask, studioAccountState } from '../studio-account-state'
import { StudioAccountWorkCard } from './StudioAccountWorkCard'
import { StudioAccountCollectionAttention } from './StudioAccountCollectionAttention'

export function StudioAccountCollection({ account, items, loading, onMaterial, onLibrary, onClose, onChanged, onTasks, onTask, captureTask }: {
  account: RecordItem; items: RecordItem[]; loading: boolean
  onMaterial: (id: string, tab?: string) => void
  onLibrary: (materialId?: string) => void; onClose: () => void; onChanged: () => void; onTasks: () => void
  onTask: (id: string) => void
  captureTask?: RecordData
}) {
  const { creatorName } = useStudioPrivacy()
  const [adopting, setAdopting] = useState<RecordItem | null>(null)
  const task = studioAccountCaptureTask(account, captureTask)
  const state = studioAccountState({ ...account, collection: task }), pending = state.active
  const captureStatus = state.receiptPending ? state.message
    : pending || state.failed || task.status === 'succeeded' ? studioAccountCaptureNotice(task)
    : loading ? '正在读取已采集作品…'
    : typeof account.materialCount === 'number' && account.materialCount > items.length ? `已展示最近 ${items.length} 条，完整作品可在采集仓库查看。`
    : '已采集作品'
  const collectedTime = (item: RecordItem) => Date.parse(text(item.collectedAt)) || Date.parse(text(item.createdAt)) || 0
  const ranked = [...items].sort((a, b) => collectedTime(b) - collectedTime(a))
  return <section className="creator-collection" id="creatorCollection" aria-label="账号作品" aria-busy={loading || pending}>
    <header className="creator-collection-head"><div>
      <div className="creator-collection-title"><h3>{creatorName(account.name, '当前账号')}的作品</h3><span>{typeof account.materialCount === 'number' ? account.materialCount : items.length} 条</span></div>
      <p role="status" className={`creator-collection-status ${pending ? 'is-running' : ''}`}>{pending && <span className="creator-spinner" aria-hidden="true" />}{captureStatus}</p>
    </div><div className="creator-collection-tools">
      <button className="btn ghost" onClick={onTasks}>采集任务 ↗</button>
      <button className="btn creator-library-link" onClick={() => onLibrary()} disabled={!items.length}>在采集仓库查看 ↗</button>
      <button className="creator-collapse" onClick={onClose} aria-label="收起账号作品" title="收起作品"><ChevronDown size={14} /></button>
    </div></header>
    <StudioAccountCollectionAttention task={task} onTask={onTask} onMaterial={onMaterial} onTasks={onTasks} />
    {loading ? <p className="creator-collection-empty">正在读取已采集作品…</p> : items.length ? <div className="creator-works-grid" tabIndex={0} aria-label="账号已采集作品">{ranked.map(item =>
      <StudioAccountWorkCard key={item.id} item={item} onMaterial={onMaterial} onAdopt={setAdopting} onChanged={onChanged} onTask={onTask} />
    )}</div> : <p className="creator-collection-empty">还没有采集作品</p>}
    {adopting && <StudioAdoptDialog material={adopting} close={() => setAdopting(null)} onSaved={() => { setAdopting(null); onChanged() }} />}
  </section>
}
