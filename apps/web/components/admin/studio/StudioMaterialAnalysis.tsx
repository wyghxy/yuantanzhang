'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { WandSparkles } from 'lucide-react'
import { api, errorText, list, object, text, StudioClientError, type RecordData, type RecordItem } from './studio-client'
import { invalidateStudioQueries } from './studio-query-cache'
import { useStudioResource } from './StudioQueryProvider'
import { useStudioTaskLog } from './useStudioTaskLog'
import { StudioWritingBreakdown } from './writing/StudioWritingBreakdown'
import { StudioMaterialCandidates } from './StudioMaterialCandidates'
import { Empty } from './StudioUI'
import s from './StudioWorkbench.module.css'

export function StudioMaterialAnalysis(props: {
  materialId: string; version: number; transcript: string; analysis: RecordData
  sourceTitle?: string
  resultView?: ReactNode; article?: boolean
  disabled?: boolean; onMaterial: (item: RecordItem) => void; onChanged?: () => void
}) {
  return <MaterialAnalysis key={props.materialId} {...props} />
}

function MaterialAnalysis({ materialId, version, sourceTitle, transcript, analysis, resultView, article = false, disabled = false, onMaterial, onChanged }: Parameters<typeof StudioMaterialAnalysis>[0]) {
  const [submittedTaskId, setTaskId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCandidates, setShowCandidates] = useState(false)
  const [dismissedTaskId, setDismissedTaskId] = useState('')
  const submitting = useRef(false)
  const mounted = useRef(true)
  const completed = useRef('')
  const requestKey = useRef('')
  const activePath = `tasks?projection=summary&materialId=${encodeURIComponent(materialId)}&kind=analyze&sourceOperation=none&status=active&limit=1`
  const activeQuery = useStudioResource(activePath, !!materialId)
  const checking = !!materialId && activeQuery.isPending
  const taskId = submittedTaskId || list(activeQuery.data?.items)[0]?.id || ''
  const { detail, error: taskError } = useStudioTaskLog(taskId, !!taskId, 0, false)
  const task = object(detail?.task)
  const status = text(task.status)
  const active = !!taskId && (!status || ['queued', 'running'].includes(status))
  const hasAnalysis = Object.keys(analysis).some(key => !['stale', 'model', 'sourceVersion', 'sourceMaterialId', 'savedMaterialVersion'].includes(key))
  const terminalError = ['failed', 'cancelled', 'blocked'].includes(status) ?
    text(task.error) || (status === 'cancelled' ? '拆解任务已取消。' : '拆解未完成，请查看任务中的失败原因。') : ''
  const visibleError = error || taskError || (activeQuery.error ? errorText(activeQuery.error) : '') || terminalError
  const candidatesOpen = showCandidates || (status === 'succeeded' && dismissedTaskId !== taskId)
  const closeCandidates = () => { setShowCandidates(false); setDismissedTaskId(taskId) }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { requestKey.current = '' }, [version])
  useEffect(() => {
    if (!taskId || !['succeeded', 'failed', 'cancelled', 'blocked'].includes(status) || completed.current === taskId) return
    completed.current = taskId
    if (status === 'succeeded') {
      invalidateStudioQueries(`materials/${materialId}/candidates`)
    }
  }, [taskId, status, materialId])
  const start = async () => {
    if (!materialId || !transcript.trim() || disabled || active || checking || submitting.current) return
    submitting.current = true; setBusy(true); setError('')
    const storageKey = `radar:analysis-pending:${materialId}:${version}`
    try {
      // Recheck after a stale tab or an ambiguous network response before creating a task.
      const existing = list((await api(activePath)).items)[0]
      if (existing) { setTaskId(existing.id); return }
      if (!requestKey.current) {
        try { requestKey.current = sessionStorage.getItem(storageKey) || '' } catch { /* Storage can be unavailable. */ }
        requestKey.current ||= crypto.randomUUID()
        try { sessionStorage.setItem(storageKey, requestKey.current) } catch { /* In-memory key still protects this session. */ }
      }
      const result = await api('tasks', 'POST', { kind: 'analyze', materialId, expectedVersion: version,
        ...(hasAnalysis ? { regenerate: true } : {}), idempotencyKey: requestKey.current })
      const id = text(object(result.task).id)
      if (!id) throw new Error('任务响应缺少编号，请重新读取任务状态。')
      if (mounted.current) setTaskId(id)
      requestKey.current = ''
      try { sessionStorage.removeItem(storageKey) } catch { /* Optional persistence. */ }
    } catch (reason) {
      if (reason instanceof StudioClientError && [400, 401, 403, 404, 409, 422].includes(reason.status)) {
        requestKey.current = ''
        try { sessionStorage.removeItem(storageKey) } catch { /* Optional persistence. */ }
      }
      if (mounted.current) setError(errorText(reason))
    } finally {
      submitting.current = false
      if (mounted.current) setBusy(false)
    }
  }
  if (!materialId) return <Empty title="还没有采纳素材"><p>从情报流选择参考素材后，可在这里直接拆解正文。</p></Empty>
  return <div className="insight-container">
    <div className="insight-head-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span className="badge">{hasAnalysis ? '已保存的模型拆解' : '尚无模型拆解'}</span>
      <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 12 }}
        disabled={disabled || checking || busy || active || !transcript.trim()} onClick={() => void start()}>
        <WandSparkles size={13} />{checking ? '正在读取任务状态…' : busy ? '正在提交…' : active ? '正在拆解…' : hasAnalysis ? '重新生成' : '生成爆款拆解'}
      </button>
    </div>
    {visibleError && <p className={s.error} role="alert">{visibleError} <button className="btn ghost" disabled={busy} onClick={() => { setError(''); void activeQuery.refetch() }}>重新读取任务状态</button></p>}
    {active && <p className={s.notice} role="status">{text(task.phase) || (status === 'queued' ? '已加入拆解队列' : '正在读取拆解进度')}。你可以继续编辑稿件。</p>}
    {analysis.stale === true && <p className={s.notice}>参考原文已变化，这份拆解基于旧版本。请核对或重新生成。</p>}
    {hasAnalysis ? resultView || <StudioWritingBreakdown analysis={analysis} source={{ materialId, version, title: sourceTitle }} /> :
      <Empty title={transcript.trim() ? '从一条好内容中，找到自己的切入点' : '尚无可拆解的正文'}>
        <p>{transcript.trim() ? article ? '拆解文章的内容结构、表达机制与开篇钩子。基于已保存的正文；结果先进入候选供你预览。' : '一次拆解包含内容结构、表达机制与 2 秒、5 秒开场分析。基于已保存的逐字稿；结果先进入候选供你预览。' : article ? '请先到采集仓库读取文章正文。' : '请先提取文字逐字稿，或到采集仓库完成转写。'}</p>
      </Empty>}
    <div className={s.actions}><button className="btn ghost" disabled={busy} onClick={() => setShowCandidates(true)}>查看候选结果</button></div>
    {candidatesOpen && <StudioMaterialCandidates materialId={materialId} expectedVersion={version} transcript={transcript} disabled={disabled}
      close={closeCandidates} onAdopt={item => { onMaterial(item); closeCandidates(); onChanged?.() }} />}
  </div>
}
