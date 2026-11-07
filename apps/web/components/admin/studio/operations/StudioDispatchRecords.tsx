'use client'
import { useState } from 'react'
import { list, object, text, type RecordData } from '../studio-client'
import { useStudioPrivacy } from '../StudioPrivacy'
import { studioDateTime, studioDiscoveryCompletion, studioTaskLabel } from '../studio-operations-utils'
import { studioCollectionTaskGroups, studioMetricFollowupView } from '../studio-metric-followup-view'
import { studioTaskDisplay } from '../studio-task-display'
import { stateName } from './operations-presentation'
import { StudioDispatchIcon } from './StudioDispatchIcons'
import { studioContentProgressView } from '../studio-content-progress'

export type CollectionControlFeedback = { message: string; reasons: string[] }

function resultStatus(row: RecordData) {
  const status = text(row.status), items = list(row.items)
  const autoContent = studioContentProgressView(row)
  if (autoContent) return autoContent.attention ? 'partial' : 'running'
  if (['empty', 'needs_attention', 'partial'].includes(status) && row.tasksCreated === 0 &&
      Array.isArray(row.tasks) && row.tasks.length === 0 && row.taskCoverageTruncated !== true &&
      !Number(row.incompleteTasks || 0) && items.length > 0 &&
      items.every(item => item.status === 'skipped' && !item.taskId && !object(item.task).id)) return 'skipped'
  if (['queued', 'running'].includes(status)) return 'running'
  if (['completed', 'succeeded'].includes(status)) return 'done'
  if (['needs_attention', 'partial'].includes(status)) return 'partial'
  if (status === 'cancelled') return 'stopped'
  if (['failed', 'blocked'].includes(status)) return 'failed'
  return status
}
const resultLabels: Record<string, string> = { running: '采集中', done: '已完成', partial: '部分完成', skipped: '未执行', stopped: '已停止', failed: '失败' }

export function StudioDispatchRecords({ collections, collectionFeedback, offset, total, onOffset, busy, onControl, onTask, onNavigate, onRefresh, feedback }: {
  collectionFeedback: Record<string, CollectionControlFeedback>
  collections: RecordData[]; offset: number; total: number; onOffset: (n: number) => void; busy: boolean
  onControl: (id: string, action: 'cancel' | 'retry' | 'content') => void; onTask: (id: string) => void
  onNavigate: (view: string) => void; onRefresh: () => void; feedback: string
}) {
  const [filter, setFilter] = useState('all'), [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { creatorName, platformLabel } = useStudioPrivacy()
  const rows = collections.filter(row => filter === 'all' || (filter === 'attention' ? ['partial', 'failed', 'stopped', 'skipped'].includes(resultStatus(row)) : resultStatus(row) === filter))
  return <section className="cs-results" aria-labelledby="cs-results-title">
    <header className="cs-panel-head"><div className="cs-heading"><h3 id="cs-results-title">最近采集</h3><span id="cs-result-count" className="cs-caption">{total} 个批次</span></div><div className="cs-actions">
      <select id="cs-result-filter" aria-label="筛选当前页采集状态" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部状态</option><option value="running">进行中</option><option value="done">已完成</option><option value="attention">需处理</option></select>
      <button className="cs-button cs-text" onClick={() => onNavigate('tasks')}>运行日志 ↗</button>
    </div></header>
    <div className="cs-result-columns" aria-hidden="true"><span>采集批次</span><span>平台范围</span><span>结果</span><span>状态</span><span>操作</span></div>
    <div id="cs-jobs" className="cs-results-body" role="region" tabIndex={0} aria-label="最近采集">{rows.length ? rows.map(row => {
      const id = text(row.id), tasks = list(row.tasks), items = list(row.items), status = resultStatus(row), active = status === 'running', opened = expanded[id] ?? status === 'skipped'
      const controlFeedback = collectionFeedback[id]
      const autoContent = studioContentProgressView(row)
      const platforms = [...new Set(items.map(item => text(item.platform)).filter(Boolean))]
      const receipt = object(row.receiptSummary), returned = typeof receipt.returnedCount === 'number' ? receipt.returnedCount : null
      const { content, followups } = studioCollectionTaskGroups(tasks)
      const progress = object(row.contentProgress), followupSummary = object(row.followupSummary)
      const contentTotal = Number(progress.total ?? content.length), succeeded = Number(progress.completed ?? content.filter(task => task.status === 'succeeded' || task.deliveryResolved === true).length)
      const retryable = content.some(task => task.deliveryResolved !== true && ['failed', 'blocked', 'cancelled'].includes(text(task.status)))
      return <article className="cs-batch" key={id}><div className="cs-result-row">
        <div className="cs-batch-title"><strong>{object(row.selection).source === 'schedule' ? '每日自动采集' : '平台采集'}</strong><small>{studioDateTime(row.createdAt)}</small></div>
        <div className="cs-batch-platforms">{platforms.map(platform => <span key={platform}>{platformLabel(platform)}</span>)}</div>
        <div className="cs-batch-result">{autoContent ? <span>{autoContent.message}</span> : active ? <><span>{row.taskCoverageTruncated === true ? '正在核对采集任务范围' : `采集已完成 ${succeeded} / ${contentTotal} 项`}</span>{row.taskCoverageTruncated !== true && <progress value={succeeded} max={Math.max(1, contentTotal)} aria-label="采集任务进度" />}</> : <>{status === 'skipped' ? `${items.length} 个账号全部跳过` : status === 'done' && returned === 0 ? '已检查，无新增作品' : returned !== null ? `本次收录 ${returned} 条作品` : `${Number(row.tasksCreated || 0)} 个账号任务`}</>}</div>
        <span className="cs-status" data-status={status}>{autoContent?.label || resultLabels[status] || stateName(row.status)}</span>
        <div className="cs-batch-actions">{active && <button className="cs-button cs-text" disabled={busy} onClick={() => onControl(id, 'cancel')}>停止</button>}{!active && (row.contentResumeAvailable === true || autoContent?.resumable) && <button className="cs-button cs-text" disabled={busy} onClick={() => onControl(id, 'content')}>继续采集</button>}<button className="cs-button cs-text cs-expand" aria-expanded={opened} aria-controls={'cs-detail-' + id} onClick={() => setExpanded(old => ({ ...old, [id]: !opened }))}>{opened ? '收起' : '详情'}<StudioDispatchIcon name="chevron" /></button></div>
      </div>{controlFeedback && <div className="cs-batch-details" role={controlFeedback.reasons.length ? 'alert' : 'status'}><p className="cs-caption">{controlFeedback.message}</p>{controlFeedback.reasons.map(reason => <p className="cs-caption" key={reason}>{reason}</p>)}</div>}{opened ? <div className="cs-batch-details" id={'cs-detail-' + id}>
        {Number(row.incompleteTasks) > 0 && <p className="cs-caption">{Number(row.incompleteTasks)} 个任务存在封面、正文或采集范围缺项。可查看日志确认原因；后续同步继续未完成的新发布范围，不补抓关注前的作品。</p>}
        {Number(followupSummary.total ?? followups.length) > 0 && <p className="cs-caption">指标回访单独处理，不计入正文采集进度。{Number(followupSummary.awaitingAuthorization || 0) > 0 ? ` ${followupSummary.awaitingAuthorization} 项待授权。` : ''}{Number(followupSummary.scheduled || 0) > 0 ? ` ${followupSummary.scheduled} 项等待计划时间。` : ''}{Number(followupSummary.needsAttention || 0) > 0 ? ` ${followupSummary.needsAttention} 项回访需处理。` : ''}</p>}
        {!active && retryable && <div className="cs-batch-error">部分采集任务尚未完成<button className="cs-button cs-text" disabled={busy} onClick={() => onControl(id, 'retry')}>重试</button></div>}
        {items.length ? items.map((item, index) => <div className="cs-batch-work" key={text(item.accountId, String(index))}><div><strong>{creatorName(item.name)}</strong><span>{platformLabel(item.platform)} · {studioDiscoveryCompletion(object(item.task))?.label || stateName(object(item.task).status || item.status)}{item.reason ? ' · ' + text(item.reason) : ''}</span>{object(item.task).error ? <span role="alert">{text(object(item.task).error)}</span> : null}</div>{item.taskId ? <button className="cs-button cs-text" onClick={() => onTask(text(item.taskId))}>查看任务 ↗</button> : null}</div>) : <p className="cs-muted">{active ? '正在整理选定平台的账号任务…' : status === 'stopped' ? '任务已停止，可重新发起。' : '暂无账号任务结果'}</p>}
        {content.length > 0 && <details><summary>采集任务（{content.length}）</summary>{content.map(task => <div className="cs-batch-work" key={task.id}><div><strong>{studioTaskLabel(task)}</strong><span>{task.deliveryResolved ? '内容已就绪' : studioDiscoveryCompletion(task)?.label || studioTaskDisplay(task).status}</span></div><button className="cs-button cs-text" onClick={() => onTask(task.id)}>日志</button></div>)}</details>}
        {followups.length > 0 && <details><summary>指标回访（{followups.length}）</summary>{followups.map(task => {
          const view = studioMetricFollowupView(task)!
          return <div className="cs-batch-work" key={task.id}><div><strong>{view.title}</strong><span>{view.status} · {view.schedule}</span></div><button className="cs-button cs-text" onClick={() => onTask(task.id)}>{view.awaitingAuthorization ? '查看待授权回访' : '查看回访'}</button></div>
        })}</details>}
        {row.taskCoverageTruncated === true && <p className="cs-caption">子任务超过查询范围，当前明细不完整。</p>}
      </div> : <div id={'cs-detail-' + id} hidden />}</article>
    }) : <div className="cs-empty"><span><StudioDispatchIcon name="clock" /></span><strong>{collections.length ? '暂无符合条件的采集' : '暂无采集记录'}</strong><p>{collections.length ? '切换状态，查看其他批次。' : '选择平台后，即可发起采集。'}</p></div>}</div>
    <footer className="cs-panel-foot"><span id="cs-feedback" className="cs-feedback" role={feedback ? 'alert' : 'status'}>{feedback || '仅采集正在跟踪的账号'}</span><div className="cs-actions">{feedback && <button className="cs-button cs-text" disabled={busy} onClick={onRefresh}>重试</button>}{total > 20 && <><button className="cs-button cs-text" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - 20))}>上一页</button><span className="cs-caption">{Math.floor(offset / 20) + 1} / {Math.ceil(total / 20)}</span><button className="cs-button cs-text" disabled={offset + 20 >= total} onClick={() => onOffset(offset + 20)}>下一页</button></>}<button className="cs-button cs-text" onClick={() => onNavigate('works')}>采集仓库 ↗</button></div></footer>
  </section>
}
