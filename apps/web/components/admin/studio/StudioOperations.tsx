'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import {
  api,
  apiFresh,
  text,
  object,
  list,
  errorText,
  downloadStudio,
  type RecordData,
  type RecordItem,
} from './studio-client'

import { Busy, Details, Modal } from './StudioUI'
import StudioKnowledgeCapture from './StudioKnowledgeCapture'

import StudioDashboard from './StudioDashboard'
import { useStudioResource } from './StudioQueryProvider'

import { useStudioTaskLog } from './useStudioTaskLog'
import { useStudioTaskList } from './useStudioTaskList'

import { studioDateTime } from './studio-operations-utils'
import { studioCollectionSubmissionFeedback } from './studio-collection-feedback'

import s from './StudioWorkbench.module.css'

import {
  smallStyle,
  actionsStyle,
  detailStyle,
} from './operations/operations-presentation'

import { StudioDispatchPanel } from './operations/StudioDispatchPanel'
import type { CollectionControlFeedback } from './operations/StudioDispatchRecords'

import { StudioTaskSessionsPanel } from './operations/StudioTaskSessionsPanel'
import taskStyles from './operations/StudioTaskSessions.module.css'

import { StudioOperationDialog } from './operations/StudioOperationDialog'
import { StudioCapabilitiesPanel } from './operations/StudioCapabilitiesPanel'
import capabilityStyles from './operations/StudioCapabilities.module.css'

export default function StudioOperations({
  view: requestedView,
  onTask,
  onOpenTask,
  onNavigate,
  notify,
  onMaterial,
  onTopic,
  onPlatform,
}: {
  view: string
  taskId: string
  onTask: (id: string) => void
  onOpenTask: (id: string) => void
  onNavigate: (view: string) => void
  notify: (message: string) => void
  onMaterial?: (id: string) => void
  onTopic?: (id: string) => void
  onPlatform?: (platform: string) => void
  activeTask?: RecordData | null
}) {
  const view =
    requestedView === 'dashboard'
      ? 'overview'
      : requestedView === 'home'
        ? 'schedule'
        : requestedView === 'pending' ? 'tasks' : requestedView
  const overview = useStudioResource('dashboard', view === 'overview', true)
  const dashboard = overview.data || null
  const [reports, setReports] = useState<RecordItem[]>([])
  const [offset, setOffset] = useState(0),
    [status, setStatus] = useState(requestedView === 'pending' ? 'work_queue' : ''),
    [reportTotal, setReportTotal] = useState(0),
    [reportOffset, setReportOffset] = useState(0)
  const taskList = useStudioTaskList(offset, status, view === 'tasks')
  const tasks = list(taskList.data?.items), total = Number(taskList.data?.total || 0)
  const refreshTasks = taskList.refresh
  const taskListError = view === 'tasks' ? taskList.error : null
  const [error, setError] = useState(''),
    [actionError, setActionError] = useState(''),
    [actionMessage, setActionMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loadedKey, setLoadedKey] = useState(''),
    [dataKey, setDataKey] = useState(''),
    [refresh, setRefresh] = useState(0)
  const [selected, selectLog] = useState(''),
    [logRevision, setLogRevision] = useState(0),
    log = useStudioTaskLog(selected, view === 'tasks', logRevision, true, true)
  const [panel, setPanel] = useState(''),
    [profile, setProfile] = useState<RecordData>({}),
    [schedule, setSchedule] = useState<RecordData>({})
  const capabilityQuery = useStudioResource('capabilities', view === 'capabilities' || panel === 'capabilities')
  const capabilities = capabilityQuery.data || null
  const capabilityError = view === 'capabilities' || panel === 'capabilities' ? capabilityQuery.error : null
  const [period, setPeriod] = useState('24'),
    [report, setReport] = useState<RecordItem | null>(null),
    [collections, setCollections] = useState<RecordData[]>([]),
    [collectionsKey, setCollectionsKey] = useState(''),
    [collectionTotal, setCollectionTotal] = useState(0),
    [collectionOffset, setCollectionOffset] = useState(0)
  const [collectionFeedback, setCollectionFeedback] = useState<Record<string, CollectionControlFeedback>>({})
  const [transcribePlatform, setTranscribePlatform] = useState('douyin'),
    [materials, setMaterials] = useState<RecordItem[]>([]),
    [materialTotal, setMaterialTotal] = useState(0),
    [materialOffset, setMaterialOffset] = useState(0),
    [checkedMaterials, setCheckedMaterials] = useState<string[]>([])
  const [snapshots, setSnapshots] = useState<RecordItem[]>([]),
    [snapshotTotal, setSnapshotTotal] = useState(0),
    [snapshotOffset, setSnapshotOffset] = useState(0)
  const performing = useRef(false),
    reading = useRef(false),
    collectionRequest = useRef<{ scope: string; key: string } | null>(null),
    scheduleSnapshot = useRef<RecordData>({})
  const reload = useCallback(() => {
    refreshTasks()
    setRefresh((value) => value + 1)
    setLogRevision((value) => value + 1)
  }, [refreshTasks])
  const requestKey = JSON.stringify([
      view,
      offset,
      status,
      reportOffset,
      period,
      collectionOffset,
    ]),
    loading = view === 'overview' ? overview.isPending : view === 'tasks' ? taskList.isPending : loadedKey !== requestKey,
    initialLoading = view === 'overview' ? overview.isPending : view === 'capabilities' ? capabilityQuery.isPending : loading && dataKey !== requestKey
  useEffect(() => {
    if (view === 'overview' || view === 'tasks') return
    const controller = new AbortController()
    reading.current = true
    const read = (path: string) => api(path, 'GET', undefined, controller.signal)
    void (async () => {
      if (view === 'reports') {
        const data = await read(`reports?limit=20&offset=${reportOffset}&hours=${period}`)
        if (!controller.signal.aborted) {
          setReports(list(data.items))
          setReportTotal(Number(data.total))
        }
      } else if (view === 'capabilities') {
        await apiFresh('capabilities', controller.signal)
      } else if (view === 'schedule') {
        const results = await Promise.allSettled([
          apiFresh('schedule', controller.signal),
          read(`collections?limit=20&offset=${collectionOffset}`),
        ])
        if (controller.signal.aborted) return
        if (results[0].status === 'fulfilled') {
          setSchedule(results[0].value)
          scheduleSnapshot.current = results[0].value
        }
        if (results[1].status === 'fulfilled') {
          setCollections(list(results[1].value.items))
          setCollectionTotal(Number(results[1].value.total))
          setCollectionsKey(requestKey)
        }
        const failure = results.find((result) => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason
      }
      if (!controller.signal.aborted) { setError(''); setDataKey(requestKey) }
    })()
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorText(failure))
      })
      .finally(() => {
        if (!controller.signal.aborted) { reading.current = false; setLoadedKey(requestKey) }
      })
    return () => { controller.abort(); reading.current = false }
  }, [view, offset, status, reportOffset, period, collectionOffset, refresh, requestKey])
  useEffect(() => {
    if (view !== 'schedule') return
    const timer = setInterval(() => { if (!document.hidden && !reading.current) setRefresh(value => value + 1) }, 10000)
    return () => clearInterval(timer)
  }, [view])
  useEffect(() => {
    if (panel !== 'transcribe' && panel !== 'snapshots') return
    const controller = new AbortController(),
      path =
        panel === 'transcribe'
          ? `materials?projection=summary&limit=30&offset=${materialOffset}&platform=${transcribePlatform}`
          : `snapshots?limit=30&offset=${snapshotOffset}`
    void api(path, 'GET', undefined, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        if (panel === 'transcribe') {
          setMaterials(list(data.items))
          setMaterialTotal(Number(data.total))
          setCheckedMaterials([])
        } else {
          setSnapshots(list(data.items))
          setSnapshotTotal(Number(data.total))
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorText(failure))
      })
    return () => controller.abort()
  }, [panel, materialOffset, transcribePlatform, snapshotOffset, refresh])

  async function perform(action: () => Promise<void>) {
    if (performing.current) return
    performing.current = true
    setBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      await action()
    } catch (failure) {
      setActionError(errorText(failure))
    } finally {
      performing.current = false
      setBusy(false)
    }
  }
  async function queue(kind: string, input: RecordData = {}) {
    const data = await api('tasks', 'POST', {
        kind,
        ...input,
        idempotencyKey: crypto.randomUUID(),
      }),
      id = text(object(data.task).id)
    onTask(id)
    notify('任务已保存并入队')
    return id
  }
  async function openPanel(name: string) {
    if (name === 'profile') setProfile(await api('profile'))
    if (name === 'capabilities') await apiFresh('capabilities')
    setPanel(name)
  }
  async function saveSchedule(next: RecordData) {
    const saved = await api('schedule', 'PATCH', {
      expectedVersion: next.expectedVersion,
      maxPointsPerTask: next.maxPointsPerTask,
      enabled: next.enabled,
      time: next.time,
      times: next.times,
      platforms: next.platforms,
      ...(Object.hasOwn(next, 'contentGrant') ? { contentGrant: next.contentGrant } : {}),
      ...(Object.hasOwn(next, 'completeCollection') ? { completeCollection: next.completeCollection } : {}),
    })
    setSchedule(saved)
    scheduleSnapshot.current = saved
    notify('调度设置已保存')
    return saved
  }
  async function collect(platform: string, platforms?: string[]) {
    const scope = JSON.stringify([platform, platforms ? [...platforms].sort() : null])
    if (collectionRequest.current?.scope !== scope)
      collectionRequest.current = { scope, key: crypto.randomUUID() }
    const data = await api('collections', 'POST', {
        idempotencyKey: collectionRequest.current.key,
        platform,
        ...(platforms ? { platforms } : {}),
        collectionMode: 'incremental',
        collectionIntent: 'check_updates',
      }),
      collection = object(data.collection)
    collectionRequest.current = null
    setCollections((old) => [collection, ...old.filter((row) => row.id !== collection.id)])
    setCollectionTotal((old) => old + (data.duplicate === true ? 0 : 1))
    const feedback = studioCollectionSubmissionFeedback(collection)
    if (feedback.error) setActionError(feedback.message)
    else setActionMessage(feedback.message)
    notify(feedback.message)
  }
  async function controlTask(id: string, action: 'discard' | 'cancel' | 'retry' | 'recapture' | 'resume-config' | 'dismiss' | 'restore-attention') {
    if (action === 'discard' && !window.confirm('删除这条尚未收录的素材？这会终止后续处理，旧任务不能恢复。已保存的任务记录会保留。')) return
    const result = await api(`tasks/${id}/${action}`, 'POST', {})
    const nextTaskId = text(object(result.task).id)
    if ((action === 'resume-config' || action === 'recapture') && nextTaskId) onTask(nextTaskId)
    reload()
    if (action === 'recapture') {
      notify(result.complete ? '内容已完整，无需重新获取' : result.reused ? '已打开先前确认的新请求' : '已确认独立的新请求；旧请求记录保留')
      return
    }
    notify(action === 'discard' ? '待收录素材已删除；旧任务与运行记录保留' : action === 'dismiss' ? '已移出待处理，可在已移出中恢复；作品和运行记录保留' : action === 'restore-attention' ? '已恢复此事项' : action === 'cancel' ? '已提交停止请求，等待任务释放资源' : action === 'resume-config' ? '已创建新配置任务，复用已抓取音频' : '已重新排队，将复用已完成步骤')
  }
  async function controlCollection(id: string, action: 'cancel' | 'retry' | 'content') {
    setCollectionFeedback((old) => { const next = { ...old }; delete next[id]; return next })
    const result = await api(`collections/${encodeURIComponent(id)}/${action}`, 'POST', {}),
      updated = object(result.collection), results = list(result.results)
    if (updated.id) setCollections((old) => old.map((row) => (row.id === id ? updated : row)))
    if (action === 'content') {
      const message = '已确认继续本批正文与视频，将复用已发现的作品，不重新抓取账号列表'
      setCollectionFeedback(old => ({ ...old, [id]: { message, reasons: [] } }))
      notify(message)
      reload()
      return
    }
    const conflicts = results.filter((row) => row.status === 'conflict')
    const processed = results.length - conflicts.length
    const message = [
      processed ? action === 'retry' ? `${processed} 个任务已重新排队` : `${processed} 个任务已处理停止请求` : '',
      conflicts.length ? `${conflicts.length} 个任务未能${action === 'retry' ? '重试' : '停止'}` : '',
    ].filter(Boolean).join('；') || `本批没有可${action === 'retry' ? '重试' : '停止'}的任务`
    setCollectionFeedback((old) => ({ ...old, [id]: {
      message,
      reasons: [...new Set(conflicts.map((row) => text(row.error, '任务状态已变化，请查看任务日志后再试')))],
    } }))
    notify(message)
  }
  const task = object(log.detail?.task)
  const pageTitle =
    (
      {
        overview: '情报看板',
        tasks: requestedView === 'pending' ? '工作队列' : '任务与运行记录',
        schedule: '采集调度中心',
        reports: '情报报告',
        capabilities: '平台与服务状态',
      } as Record<string, string>
    )[view] || '情报看板'
  const pageDescription = (
    {
      overview: '一屏掌握对标博主资产、作品流转与情报采集节奏',
      tasks: '找到未完成的事项，按原因重试、补充材料或移出待处理。',
      schedule: '执行分平台日更抓取、一键全平台采集与逐字稿处理。',
      reports: '按真实观测生成报告，来源、统计范围与回访结果随报告保存。',
    } as Record<string, string>
  )[view]

  const capabilityPanel = (
    <StudioCapabilitiesPanel data={capabilities} />
  )
  const pageActions = (
<div style={actionsStyle}>
          <button className={view === 'capabilities' ? capabilityStyles.button : 'btn ghost'} disabled={loading || (view === 'capabilities' && busy)} onClick={reload}>
            ↻ {view === 'overview' ? '刷新看板' : view === 'capabilities' ? '刷新状态' : '刷新'}
          </button>
          {view === 'overview' && (
            <details style={{ position: 'relative' }}>
              <summary className="btn ghost">更多</summary>
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  minWidth: 150,
                  zIndex: 10,
                  background: 'var(--ui-popover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: 8,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <button className="btn ghost" onClick={() => onNavigate('reports')}>
                  情报报告
                </button>
                <button className="btn ghost" onClick={() => onNavigate('schedule')}>
                  采集调度
                </button>
                <button
                  className="btn ghost"
                  onClick={() => void perform(() => openPanel('profile'))}
                >
                  创作档案
                </button>
                <button
                  className="btn ghost"
                  onClick={() => void perform(() => openPanel('capabilities'))}
                >
                  平台与服务
                </button>
              </div>
            </details>
          )}
        </div>
  )
  const Surface = view === 'overview' ? Fragment : 'section'
  const Scope = view === 'schedule' ? 'div' : Fragment
  const scopeProps = view === 'schedule' ? { className: 'radar-source-page' } : {}
  const surfaceProps = view === 'overview' ? {} : { className: view === 'schedule' ? 'fullview-container cs-page' : view === 'tasks' ? `fullview-container ${taskStyles.taskSessions}` : view === 'capabilities' ? `fullview-container ${capabilityStyles.surface}` : 'fullview-container', id: view === 'schedule' ? 'view-home' : `view-${view}` }
  return (
    <Scope {...scopeProps}>
    <Surface {...surfaceProps}>
      {view !== 'overview' && view !== 'schedule' && <div className="fullview-head">
        <div><h2 className="fullview-title">{pageTitle}</h2>{pageDescription && <p className="fullview-subtitle">{pageDescription}</p>}</div>
        {pageActions}
      </div>}
      {view !== 'schedule' && actionError && <p className={s.error} role="alert">{actionError}</p>}
      {view !== 'schedule' && (error || log.error || taskListError || overview.error || capabilityError) && (
        <p className={s.error} role="alert">
          {error || log.error || errorText(taskListError || overview.error || capabilityError)} <button className="btn ghost" onClick={() => view === 'overview' ? void overview.refetch() : reload()}>重试</button>
        </p>
      )}
      {view !== 'tasks' && initialLoading ? (
        view === 'schedule' ? <div className="cs-workspace"><Busy /></div> : <Busy />
      ) : view === 'overview' ? (
        dashboard && (
          <StudioDashboard
            dashboard={dashboard}
            actions={pageActions}
            onNavigate={onNavigate}
            onRefresh={() => void overview.refetch()}
            onPlatform={onPlatform}
            onMaterial={onMaterial}
            onTopic={onTopic}
          />
        )
      ) : view === 'schedule' ? (
        <StudioDispatchPanel
          busy={busy}
          schedule={schedule}
          perform={perform}
          saveSchedule={saveSchedule}
          collect={collect}
          error={error}
          actionError={actionError}
          actionMessage={actionMessage}
          reload={reload}
          collections={collections}
          collectionFeedback={collectionFeedback}
          collectionOffset={collectionOffset}
          setCollectionOffset={setCollectionOffset}
          collectionTotal={collectionTotal}
          collectionsReady={collectionsKey === requestKey}
          controlCollection={controlCollection}
          onTask={onOpenTask}
          onNavigate={onNavigate}
          onTranscribe={platform => { setTranscribePlatform(platform); setMaterialOffset(0); setMaterials([]); setPanel('transcribe') }}
        />
      ) : view === 'tasks' ? (
        <StudioTaskSessionsPanel
          status={status}
          setStatus={setStatus}
          setOffset={setOffset}
          onNavigate={onNavigate}
          perform={perform}
          openPanel={openPanel}
          tasks={tasks}
          loading={loading}
          onMaterial={onMaterial}
          onTask={selectLog}
          busy={busy}
          controlTask={controlTask}
          offset={offset}
          total={total}
          selected={selected}
          task={task}
          log={log}
        />
      ) : view === 'reports' ? (
        <>
          <div style={{ ...actionsStyle, marginBottom: 16 }}>
            <select
              className="btn ghost"
              value={period}
              aria-label="报告周期"
              onChange={(event) => {
                setPeriod(event.target.value)
                setReportOffset(0)
              }}
            >
              <option value="24">24 小时</option>
              <option value="72">72 小时</option>
              <option value="168">168 小时</option>
            </select>
            <button
              className="btn btn-emerald"
              disabled={busy}
              onClick={() => void perform(async () => { await queue('report', { hours: Number(period) }) })}
            >
              生成报告
            </button>
            <button className="btn ghost" onClick={() => setPanel('snapshots')}>
              指标快照与回访
            </button>
          </div>
          {reports.length ? (
            reports.map((row) => (
              <article key={row.id} style={detailStyle}>
                <strong>{text(row.title, '情报报告')}</strong>
                <p style={smallStyle}>
                  {text(row.hours, period)} 小时 · {studioDateTime(row.createdAt)} · v{row.version}
                </p>
                <div style={actionsStyle}>
                  <button className="btn ghost" onClick={() => setReport(row)}>
                    研读报告
                  </button>
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() =>
                      void perform(() =>
                        downloadStudio(
                          `reports/${row.id}/export?expectedVersion=${row.version}`,
                          `情报报告-v${row.version}.md`,
                        ),
                      )
                    }
                  >
                    下载 Markdown
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              还没有这个周期的报告。生成报告会读取当前已保存的真实素材与指标快照。
            </div>
          )}
          <div className={s.pagination}>
            <button
              disabled={!reportOffset}
              onClick={() => setReportOffset((old) => Math.max(0, old - 20))}
            >
              上一页
            </button>
            <span>{reportTotal} 份报告</span>
            <button
              disabled={reportOffset + 20 >= reportTotal}
              onClick={() => setReportOffset((old) => old + 20)}
            >
              下一页
            </button>
          </div>
        </>
      ) : view === 'capabilities' ? (
        capabilityPanel
      ) : (
        <div className="empty">请选择看板、采集调度或运行日志。</div>
      )}
      {panel && (
        <StudioOperationDialog
          panel={panel}
          setPanel={setPanel}
          busy={busy}
          error={actionError || error}
          profile={profile}
          setProfile={setProfile}
          perform={perform}
          notify={notify}
          capabilityPanel={capabilityPanel}
          onNavigate={onNavigate}
          materials={materials}
          checkedMaterials={checkedMaterials}
          setCheckedMaterials={setCheckedMaterials}
          materialOffset={materialOffset}
          setMaterialOffset={setMaterialOffset}
          materialTotal={materialTotal}
          onTask={onTask}
          snapshots={snapshots}
          onMaterial={onMaterial}
          snapshotOffset={snapshotOffset}
          setSnapshotOffset={setSnapshotOffset}
          snapshotTotal={snapshotTotal}
        />
      )}
      {report && (
        <Modal title={text(report.title, '情报报告')} close={() => setReport(null)}>
          <StudioKnowledgeCapture material={report} sourceType="studio_reports" />
          <pre className={s.prose}>{text(object(report.output).markdown || report.markdown)}</pre>
          <details>
            <summary>来源、指标与回访明细</summary>
            <Details value={object(report.output).items || report.items} />
          </details>
        </Modal>
      )}
    </Surface>
    </Scope>
  )
}
