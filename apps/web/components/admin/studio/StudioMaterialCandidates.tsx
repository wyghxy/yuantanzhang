'use client'

import { useEffect, useRef, useState } from 'react'
import { api, errorText, list, object, text, type RecordItem } from './studio-client'
import { invalidateStudioQueries } from './studio-query-cache'
import { useStudioResource } from './StudioQueryProvider'
import { Busy, Details, Empty, Modal } from './StudioUI'
import { StudioAnalysisResult } from './StudioAnalysisResult'
import s from './StudioWorkbench.module.css'

/** List metadata first; fetch only the result the reader actually opens. */
export function StudioMaterialCandidates({
  materialId, expectedVersion, transcript, disabled = false, close, onAdopt,
}: {
  materialId: string
  expectedVersion: number
  transcript: string
  disabled?: boolean
  close: () => void
  onAdopt: (item: RecordItem) => void | Promise<void>
}) {
  const [selection, setSelected] = useState('')
  const [actionError, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const summaryQuery = useStudioResource(`materials/${encodeURIComponent(materialId)}/candidates?projection=summary`)
  const rows = summaryQuery.data ? list(summaryQuery.data.candidates) : null
  const selected = rows?.find(row => row.id === selection)?.id || rows?.find(row => row.status !== 'adopted')?.id || rows?.[0]?.id || ''
  const detailQuery = useStudioResource(`candidates/${encodeURIComponent(selected)}?projection=detail`, !!selected)
  const detail = detailQuery.data?.candidate as RecordItem | undefined
  const queryError = summaryQuery.error || detailQuery.error
  const error = actionError || (queryError ? errorText(queryError) : '')
  const current = detail?.id === selected ? detail : null
  const output = object(current?.output)
  const analysis = object(output.analysis)
  const target = object(current?.target)
  const stale = current?.sourceStale === true || current?.associationStale === true ||
    (Number.isFinite(Number(target.version)) && Number(target.version) !== expectedVersion)
  const adopt = async () => {
    if (!current || submitting.current || disabled || stale || current.status === 'adopted') return
    submitting.current = true; setBusy(true); setError('')
    try {
      const result = await api(`candidates/${encodeURIComponent(current.id)}/adopt`, 'POST', { expectedVersion })
      invalidateStudioQueries(`materials/${materialId}`)
      invalidateStudioQueries(`candidates/${current.id}`)
      const item = object(result.item)
      const saved = item.id === materialId ? item as RecordItem :
        (await api(`materials/${encodeURIComponent(materialId)}`)).item as RecordItem
      if (mounted.current) await onAdopt(saved)
    } catch (reason) {
      if (mounted.current) setError(errorText(reason))
    } finally {
      submitting.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const kindLabel = (kind: unknown) => ({ analyze: '爆款拆解', analysis: '爆款拆解', transcribe: '正文转写' })[text(kind)] || text(kind, '生成结果')
  return (
    <Modal title="待采用的拆解与转写" close={close} closeDisabled={busy}>
      {error && <p role="alert" className={s.error}>{error} <button className="btn ghost" disabled={busy} onClick={() => { setError(''); void summaryQuery.refetch(); if (selected) void detailQuery.refetch() }}>重新读取</button></p>}
      {!rows && !error && <Busy />}
      {rows?.length === 0 && <Empty title="暂无候选结果"><p>拆解或转写任务完成后，在这里预览。</p></Empty>}
      {!!rows?.length && <>
        <div className={s.actions} aria-label="选择候选结果">
          {rows.map(row => <button key={row.id} className={selected === row.id ? 'btn primary' : 'btn ghost'} disabled={busy}
            aria-pressed={selected === row.id} onClick={() => setSelected(row.id)}>
            {kindLabel(row.kind)} · {row.status === 'adopted' ? '已采用' : '待采用'}{row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString('zh-CN')}` : ''}
          </button>)}
        </div>
        {!current && !error && <Busy />}
        {current && <article className={s.card}>
          {stale && <p className={s.notice}>生成后原文或关联资料发生变化，请重新生成与当前版本一致的结果。</p>}
          {Object.keys(analysis).length ? <StudioAnalysisResult analysis={analysis} transcript={transcript} /> : <Details value={output} />}
          <button className="btn primary" disabled={busy || disabled || stale || current.status === 'adopted'} onClick={() => void adopt()}>
            {busy ? '正在采用…' : current.status === 'adopted' ? '已采用' : '采用到当前版本'}
          </button>
        </article>}
      </>}
    </Modal>
  )
}
