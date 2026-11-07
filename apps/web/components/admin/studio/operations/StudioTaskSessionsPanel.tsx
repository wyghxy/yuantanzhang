'use client'

import type { Dispatch, SetStateAction } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { studioMetricFollowupView } from '../studio-metric-followup-view'
import { taskRecovery, type TaskControl } from '../studio-task-recovery'
import { studioTaskDisplay, studioTaskTextStatus } from '../studio-task-display'

import { text, object, list, type RecordData, type RecordItem } from '../studio-client'

import { Details } from '../StudioUI'

import { useStudioTaskLog } from '../useStudioTaskLog'

import { studioDateTime, studioDiscoveryCompletion, studioTaskLabel, studioTerminalStates } from '../studio-operations-utils'

import s from '../StudioWorkbench.module.css'
import taskStyles from './StudioTaskSessions.module.css'

import { actionsStyle, stateName } from './operations-presentation'

const detailStyle = { padding: '18px 0', borderBottom: '1px solid var(--ui-border)', fontSize: 15 } as const
const smallStyle = { color: 'var(--ui-text-muted)', fontSize: 14, lineHeight: 1.65 } as const

export function StudioTaskSessionsPanel({
  status,
  setStatus,
  setOffset,
  onNavigate,
  perform,
  openPanel,
  tasks,
  onTask,
  onMaterial,
  busy,
  loading,
  controlTask,
  offset,
  total,
  selected,
  task,
  log,
}: {
  status: string
  setStatus: Dispatch<SetStateAction<string>>
  setOffset: Dispatch<SetStateAction<number>>
  onNavigate: (view: string) => void
  perform: (action: () => Promise<void>) => Promise<void>
  openPanel: (name: string) => Promise<void>
  tasks: RecordItem[]
  onTask: (id: string) => void
  onMaterial?: (id: string) => void
  busy: boolean
  loading: boolean
  controlTask: (id: string, action: TaskControl) => Promise<void>
  offset: number
  total: number
  selected: string
  task: RecordData
  log:
    | ReturnType<typeof useStudioTaskLog>
    | { detail: null; events: never[]; connection: string; error: string }
}) {
  const memberView = usePathname().startsWith('/workspace')
  const savedResult = task.output || task.result
  const selectedDiscovery = studioDiscoveryCompletion(task)
  const selectedFollowup = studioMetricFollowupView(task)
  return (
    <>
      <div style={{ ...actionsStyle, marginBottom: 14 }}>
        <select
          className="btn ghost"
          value={status}
          aria-label="筛选任务状态"
          onChange={(event) => {
            setStatus(event.target.value)
            setOffset(0)
            onTask('')
          }}
        >
          <option value="work_queue">工作队列</option>
          <option value="attention">待处理与历史核对</option>
          <option value="active">进行中</option>
          <option value="hidden">已移出</option>
          <option value="">全部运行记录</option>
          {['queued', 'running', ...studioTerminalStates].map((key) => (
            <option value={key} key={key}>
              {stateName(key)}
            </option>
          ))}
        </select>
        <button className="btn ghost" onClick={() => onNavigate('schedule')}>
          定时采集
        </button>
        <button className="btn ghost" onClick={() => void perform(() => openPanel('capabilities'))}>
          查看服务状态
        </button>
      </div>
      {status === 'work_queue' && <p style={smallStyle}>处理中的任务在前，随后是等待启动和需处理事项；完成后移至运行记录。指标回访与历史核对可在筛选中查看。</p>}
      {status === 'attention' && <p style={smallStyle}>这里汇总未完成任务、待授权的指标回访和待核对的历史回执。指标回访单独授权，不计入正文采集失败。内容已就绪的作品可直接打开，无需重新采集；移出只整理提醒，作品与运行记录会保留。</p>}
      <div id="sessionTasks" aria-busy={loading} aria-label="任务列表" role="region" tabIndex={0}>
        {loading ? <div className="empty" role="status">正在读取任务…</div> : tasks.length ? (
          tasks.map((row) => {
            const recovery = taskRecovery(row)
            const display = studioTaskDisplay(row)
            const neutralNotice = ['待确认', '请求结果待核实'].includes(display.status)
            const followup = studioMetricFollowupView(row)
            const discovery = studioDiscoveryCompletion(row)
            const contentReady = object(row.currentDelivery).complete === true
            const stopped = ['failed', 'blocked', 'cancelled'].includes(text(row.status))
            const sourceProtected = row.sourceObligation === true
            const deletableSource = sourceProtected && !recovery.materialId && row.sourceDiscarded !== true
            const recapture = !memberView && stopped && !contentReady && row.sourceDiscarded !== true &&
              (row.requestReceiptPending === true || object(row.recovery).code === 'receipt_required') &&
              (['import', 'prepare_source'].includes(text(row.kind)) && object(row.input).platform === 'wechat_official' ||
                row.kind === 'collect_creator' && object(row.input).platform === 'douyin')
            return (
            <article key={row.id} style={detailStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{recovery.title}</strong>
                  <p style={smallStyle}>{studioTaskLabel(row)}</p>
                  {row.collectionProgress && !stopped ? (
                    <p style={smallStyle}>
                      {object(row.collectionProgress).linkAdded ? '链接已添加 · ' : ''}
                      {object(row.collectionProgress).contentFetched ? '内容已抓取' : row.status === 'succeeded' ? '本任务未记录抓取证据' : '等待抓取'} · {studioTaskTextStatus(row)}
                    </p>
                  ) : null}
                  <div style={smallStyle}>
                    {studioDateTime(row.createdAt)} · {followup?.status || discovery?.label || display.status}
                    {followup ? ` · ${followup.schedule}` : row.notBefore ? ` · 最早执行 ${studioDateTime(row.notBefore)}` : ''}
                  </div>
                  {followup ? <p style={smallStyle}>{followup.hint}</p> : discovery ? <p style={smallStyle}>{discovery.hint}</p>
                    : row.phase && !stopped ? <p style={smallStyle}>{text(row.phase)}</p> : null}
                  {!stopped && !discovery && !followup?.planned && typeof row.progress === 'number' && (
                    <progress
                      aria-label={`${studioTaskLabel(row)}进度`}
                      value={row.progress}
                      max={100}
                      style={{ width: 180 }}
                    />
                  )}
                </div>
                <div style={actionsStyle}>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      onTask(row.id)
                    }}
                  >
                    详情与日志
                  </button>
                  {['queued', 'running'].includes(text(row.status)) && !sourceProtected && (
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void perform(() => controlTask(row.id, 'cancel'))}
                    >
                      停止
                    </button>
                  )}
                  {(stopped || ['queued', 'running'].includes(text(row.status))) && deletableSource && (
                    <button className="btn ghost" disabled={busy} onClick={() => void perform(() => controlTask(row.id, 'discard'))}>删除</button>
                  )}
                  {stopped && recovery.retry && (
                    <button
                      className={`btn ${taskStyles.taskRetry}`}
                      disabled={busy}
                      onClick={() => void perform(() => controlTask(row.id, 'retry'))}
                    >
                      {followup?.awaitingAuthorization ? '查看回访任务' : '重新尝试'}
                    </button>
                  )}
                  {recapture && <button className="btn ghost" disabled={busy}
                    onClick={() => void perform(() => controlTask(row.id, 'recapture'))}>重新获取</button>}
                  {stopped && recovery.configuration && <Link className="btn ghost" href="/workspace/settings">查看设置</Link>}
                  {(stopped || sourceProtected || followup) && recovery.materialId && onMaterial && <button className="btn ghost" onClick={() => onMaterial(recovery.materialId)}>打开作品</button>}
                  {stopped && recovery.account && <button className="btn ghost" onClick={() => onNavigate('accounts')}>查看来源账号</button>}
                  {stopped && recovery.resumeConfig && !memberView && (
                    <button className="btn ghost" disabled={busy} onClick={() => void perform(() => controlTask(row.id, 'resume-config'))}>
                      用新配置继续
                    </button>
                  )}
                  {stopped && row.sourceDiscarded !== true && <button className="btn ghost" disabled={busy} onClick={() => void perform(() => controlTask(row.id, row.attentionHidden ? 'restore-attention' : 'dismiss'))}>
                    {row.attentionHidden ? (row.status === 'cancelled' ? '恢复到运行记录' : '恢复到待处理') : '移出待处理'}
                  </button>}
                </div>
              </div>
              {row.error && !followup?.awaitingAuthorization ? (
                <p role={contentReady || neutralNotice ? undefined : 'alert'} style={contentReady || neutralNotice ? smallStyle : { ...smallStyle, color: 'var(--danger)' }}>
                  {contentReady ? '历史任务记录：' : ''}{text(row.error)}
                </p>
              ) : null}
              {stopped && (!followup?.awaitingAuthorization || !recovery.retry) && <p style={smallStyle}>{memberView && recovery.configuration && !text(object(row.recovery).hint)
                ? '当前版本未接入此项外部处理能力。已保存内容会保留。'
                : recovery.hint}</p>}
            </article>
          )})
        ) : (
          <div className="empty">{status === 'work_queue' ? '当前没有采集任务等待处理，已完成任务可在全部运行记录查看。' : status === 'attention' ? '没有待处理事项，已完成的记录可在“全部运行记录”查看。' : status === 'hidden' ? '没有已移出的事项。移出后作品和运行记录仍会保留，可随时恢复。' : status === 'active' ? '目前没有正在处理的任务。' : '暂无运行记录'}</div>
        )}
      </div>
      <div className={`${s.pagination} ${taskStyles.pagination}`}>
        <button disabled={!offset} onClick={() => setOffset((old) => Math.max(0, old - 30))}>
          上一页
        </button>
        <span>{total} {status === 'attention' ? '项待处理与历史核对' : status === 'work_queue' ? '项工作' : '个任务'}</span>
        <button disabled={offset + 30 >= total} onClick={() => setOffset((old) => old + 30)}>
          下一页
        </button>
      </div>
      {selected && (
        <aside className="drawer open" id="logDrawer" aria-label="运行日志">
          <header>
            <strong>
              {studioTaskLabel(task)} · {selectedFollowup?.status || selectedDiscovery?.label || stateName(task.status)}
            </strong>
            <button
              className="dialog-close-btn"
              aria-label="关闭日志"
              onClick={() => {
                onTask('')
              }}
            >
              ✕
            </button>
          </header>
          {selectedFollowup && <p style={{ ...smallStyle, padding: '8px 16px' }}>{selectedFollowup.schedule} · {selectedFollowup.hint}</p>}
          {selectedDiscovery && <p style={{ ...smallStyle, padding: '8px 16px' }}>{selectedDiscovery.hint}</p>}
          <div style={{ ...smallStyle, padding: '8px 16px' }} role="status">
            {log.connection} · 显示最近 500 条
            {log.events[0]?.seq ? ` · 起始序号 ${text(log.events[0].seq)}` : ''}
          </div>
          <div className="log-box" id="log" role="log" aria-label="任务运行日志">
            {log.events.length
              ? log.events.map((event) => (
                  <div key={text(event.seq)}>
                    {studioDateTime(event.createdAt)}{' '}
                    {text(object(event.data).message, text(event.event))}
                  </div>
                ))
              : '暂无已保存日志'}
            {task.error && !selectedFollowup?.awaitingAuthorization ? <div role="alert">{text(task.error)}</div> : null}
          </div>
          <div style={{ padding: '12px 16px', overflow: 'auto' }}>
            {list(log.detail?.steps).length > 0 && (
              <details>
                <summary>处理步骤与检查点</summary>
                <Details value={log.detail?.steps} />
              </details>
            )}
            {savedResult ? (
              <details open>
                <summary>本次结果</summary>
                <Details value={savedResult} />
              </details>
            ) : null}
          </div>
        </aside>
      )}
    </>
  )
}
