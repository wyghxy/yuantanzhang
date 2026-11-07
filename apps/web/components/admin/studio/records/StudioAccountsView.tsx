'use client'

import type { JSX, Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import { StudioCreatorAvatar, useStudioPrivacy } from '../StudioPrivacy'
import { isSample, platforms, text, type RecordData, type RecordItem } from '../studio-client'
import { Busy, Platform } from '../StudioUI'
import { accountTrackingLabel } from '../StudioMaterialHelpers'
import { studioAccountState } from '../studio-account-state'
import { StudioAccountCollection } from './StudioAccountCollection'
import { accountDirection, accountFollowers, accountNumber, StudioAccountProfile } from './StudioAccountProfile'
import s from '../StudioWorkbench.module.css'

export function StudioAccountsView({ pills, search, loading, listReadError, onRetry, items, selected, setSelected,
  creatorActions, recentLoading, recent, onMaterial, onAccountMaterials, busy, perform,
  onChanged, onTasks, onTask, captureTask, onDelete, expandedId, setExpandedId, onRefreshProfile, onRecapture, refreshingProfile,
}: {
  pills: JSX.Element; search: JSX.Element
  loading: boolean; items: RecordItem[]; selected: RecordItem | null
  listReadError: string; onRetry: () => void
  setSelected: Dispatch<SetStateAction<RecordItem | null>>
  expandedId: string; setExpandedId: Dispatch<SetStateAction<string>>
  creatorActions: (row: RecordItem, onCapture?: () => void) => JSX.Element
  recentLoading: boolean; recent: RecordItem[]
  onMaterial: (id: string, tab?: string) => void
  onAccountMaterials: (id: string, materialId?: string) => void
  busy: boolean; perform: (fn: () => Promise<void>) => Promise<void>
  onChanged: () => void; onTasks: () => void
  onTask: (id: string) => void
  onDelete: (row: RecordItem) => void
  captureTask?: RecordData
  onRefreshProfile: (row: RecordItem) => void
  onRecapture: (row: RecordItem) => void
  refreshingProfile: boolean
}) {
  const { creatorName } = useStudioPrivacy()
  const root = useRef<HTMLDivElement>(null)
  const expanded = !!selected && expandedId === selected.id
  const states = items.map(studioAccountState)
  const running = states.filter(state => state.spinning && state.task.status === 'running').length
  const queued = states.filter(state => state.spinning && state.task.status === 'queued').length
  // 只在真有采集任务时说明进度。空闲时那句「本页暂无采集任务运行」没有信息量，
  // 却常驻在筛选与搜索之间，把标签行切断；读取失败已有下方 role=alert 的完整提示，
  // 这里不再重复播报，避免同一件事在两处各说一遍。
  const activity = running || queued ? `本页 ${running} 个账号采集中${queued ? ` · ${queued} 个排队` : ''}` : ''
  const toggle = (row: RecordItem) => {
    setSelected(row)
    setExpandedId(current => current === row.id ? '' : row.id)
  }
  useEffect(() => {
    if (!expanded) return
    const header = root.current?.querySelector('.creator-collection-head')
    if (!header) return
    const bounds = header.getBoundingClientRect()
    if (bounds.bottom > window.innerHeight - 48 || bounds.top < 0)
      header.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [expanded, selected?.id])
  const collapse = () => {
    setExpandedId('')
    root.current?.querySelector<HTMLButtonElement>('.creator-row.selected .creator-select')?.focus({ preventScroll: true })
  }
  return <div className="creator-workbench" id="creatorWorkbench" ref={root}>
      <div className="library-main-col">
        <div className="creator-filter-bar" id="creatorFilterBar" aria-label="博主筛选">
          <div className="creator-filter-pills" id="creatorRailPlat">{pills}</div>
          <span className="creator-filter-sep" aria-hidden="true" />
          <div className="creator-filter-tail">
            <div className={`creator-collection-activity${activity ? ' is-active' : ' is-idle'}`} id="creatorCollectionActivity"
              role="status" aria-live="polite">
              {activity && <span className="creator-activity-dot" aria-hidden="true" />}
              {activity}
            </div>
            {search}
          </div>
        </div>
        <div className="table-wrap creator-table-wrap" id="creatorTable" tabIndex={0} aria-label="对标账号列表" aria-busy={loading}>
          {listReadError && <div className={items.length ? 'creator-collection-status' : 'empty'} role="alert">
            <p>{items.length ? '更新失败，保留上次读取的对标账号' : '暂时无法读取对标账号'}</p>
            <p>{listReadError}</p>
            <button type="button" className="btn ghost" disabled={loading} onClick={onRetry}>重试</button>
          </div>}
          {loading ? <Busy /> : items.length ? <table>
            <thead><tr><th>创作者</th><th>平台</th><th>粉丝数</th><th>情报状态</th><th>已采集</th><th>快捷操作</th></tr></thead>
            <tbody>{items.map(row => {
              const rowExpanded = selected?.id === row.id && expanded
              const name = creatorName(row.name, '待识别账号')
              const count = typeof row.materialCount === 'number' ? row.materialCount : null
              const collection = studioAccountState(row)
              const enabled = row.enabled !== false
              return <tr className={`creator-row ${selected?.id === row.id ? 'selected' : ''}`} key={row.id}
                onClick={event => { if (!(event.target as HTMLElement).closest('button,a,details,label,select')) toggle(row) }}>
                <td><div className="creator-cell">
                  <div className="creator-avatar-wrap" data-platform={platforms[text(row.platform)]}><StudioCreatorAvatar name={row.name} url={row.avatarUrl || row.avatar_url} /></div>
                  <div className="creator-info-stack">
                    <button type="button" className="creator-name-text creator-select" aria-expanded={rowExpanded} aria-controls="creatorCollection" onClick={() => toggle(row)}>{name}<ChevronDown size={14} /></button>
                    {accountDirection(row) !== '待补充内容方向' && <span className="creator-identity-chip">{accountDirection(row)}</span>}
                    <span className="creator-identity-chip" role="status" title={collection.message} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {collection.spinning && !listReadError && <LoaderCircle size={14} className={s.spin} aria-hidden="true" />}
                      {listReadError && collection.active ? '采集状态待更新' : collection.compactLabel}
                    </span>
                    {collection.attention.visible && <details>
                        <summary className="creator-failure-link creator-identity-chip">查看采集详情{collection.attention.count > 0 ? `（${collection.attention.count} 项待处理）` : ''}</summary>
                        <div className="creator-info-stack" role="group" aria-label={`${name}的采集未完成项`}>
                          {collection.attention.tasks.map((task, index) => <div key={task.taskId}>
                            <button type="button" className="creator-failure-link creator-identity-chip" onClick={() => onTask(task.taskId)}>查看任务 {index + 1}：{task.label}</button>
                            {task.materialId && <button type="button" className="creator-failure-link creator-identity-chip" onClick={() => onMaterial(task.materialId!)}>查看对应作品 {index + 1}</button>}
                          </div>)}
                          {collection.attention.incompleteReason && <span className="creator-identity-chip">{collection.attention.incompleteReason}</span>}
                          {collection.attention.truncated && <span className="creator-identity-chip">当前显示 {collection.attention.tasks.length} 项，请在采集任务中查看其余记录。</span>}
                          {collection.attention.materialIds.map((id, index) => <button type="button" className="creator-failure-link creator-identity-chip" key={id} onClick={() => onMaterial(id)}>查看未完成作品 {index + 1}</button>)}
                          <button type="button" className="creator-failure-link creator-identity-chip" onClick={() => onAccountMaterials(row.id)}>查看已采集作品</button>
                          {collection.attention.truncated && <button type="button" className="creator-failure-link creator-identity-chip" onClick={onTasks}>查看采集任务</button>}
                        </div>
                      </details>}
                    {isSample(row) && <span className="creator-pending-badge">试用样例</span>}
                  </div>
                </div></td>
                <td><Platform value={row.platform} /></td>
                <td className="creator-followers"><strong>{accountNumber(accountFollowers(row))}</strong><span className="creator-mobile-label">粉丝</span></td>
                <td><span className={`tracking-status-chip ${enabled ? 'active' : 'paused'}`}>{accountTrackingLabel(row)}</span></td>
                <td><button type="button" className="creator-count" aria-expanded={rowExpanded} aria-controls="creatorCollection" aria-label={`查看${name}已采集${count === null ? '' : `的 ${count} 条`}作品`} onClick={() => toggle(row)}>{count ?? '—'}<span>条</span><ChevronDown size={14} /></button></td>
                <td><div className="creator-row-actions">{creatorActions(row, () => { setSelected(row); setExpandedId(row.id) })}</div></td>
              </tr>
            })}</tbody>
          </table> : !listReadError && <div className="empty">还没有对标账号</div>}
        </div>
      </div>
      <StudioAccountProfile account={selected} expanded={expanded} busy={busy} toggle={toggle}
        perform={perform} onDelete={onDelete}
        onRefresh={onRefreshProfile} onRecapture={onRecapture} refreshing={refreshingProfile}
        onReview={row => { const state = studioAccountState(row); if (state.captureTaskId) onTask(state.captureTaskId); else onTasks() }}
        onUpdated={row => { setSelected(row); onChanged() }} />
      {selected && expanded && <StudioAccountCollection account={selected} items={recent} loading={recentLoading}
        onMaterial={onMaterial} onLibrary={materialId => onAccountMaterials(selected.id, materialId)}
        onClose={collapse} onChanged={onChanged} onTasks={onTasks} onTask={onTask} captureTask={captureTask} />}
    </div>
}
