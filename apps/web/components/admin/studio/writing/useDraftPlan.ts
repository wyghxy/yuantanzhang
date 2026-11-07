'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiRequest, errorText, object, StudioClientError } from '../studio-client'
import { useStudioResource } from '../StudioQueryProvider'
import type { WritingDraft, WritingRecord } from '../studio-writing-model'
import { readSourcePlan, type SourceVisualPlan } from './source-reference-model'

type Entry = { plan: SourceVisualPlan; raw: WritingRecord; saved: string; version: number; revision: number; busy: boolean; error: string }
const editable = (plan: SourceVisualPlan) => plan.shots.map(({ id, visual, assets }) => ({ id, visual, assets }))
const signature = (plan: SourceVisualPlan) => JSON.stringify(editable(plan))

/** The manuscript owns its plan. Reference selection never changes this hook's key. */
export function useDraftPlan(draft: WritingDraft, externalBusy = false) {
  const path = 'drafts/' + encodeURIComponent(draft.id), query = useStudioResource(path)
  const fetched = object(query.data?.draft) as WritingDraft
  const material = Number(fetched.version) > draft.version ? fetched : draft
  const entry = useRef<Entry | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true), [snapshot, setSnapshot] = useState<Entry | null>(null)
  const [starting, setStarting] = useState(false), [startError, setStartError] = useState('')
  const operationBusy = useRef(false)
  useEffect(() => { operationBusy.current = starting || externalBusy }, [starting, externalBusy])
  const dirty = useCallback(() => !!entry.current && (entry.current.busy || signature(entry.current.plan) !== entry.current.saved), [])
  const changed = useCallback(() => {
    if (!mounted.current) return
    setSnapshot(entry.current ? { ...entry.current } : null)
  }, [])
  const accept = useCallback((record: WritingRecord) => {
    const raw = object(record.visualPlan), plan = readSourcePlan(raw)
    entry.current = plan ? { plan, raw, saved: signature(plan), version: Number(record.version), revision: 0, busy: false, error: '' } : null
    changed()
  }, [changed])
  useEffect(() => {
    mounted.current = true
    const beforeLeave = (event: BeforeUnloadEvent) => { if (dirty() || operationBusy.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeLeave)
    return () => {
      mounted.current = false; clearTimeout(timer.current)
      window.removeEventListener('beforeunload', beforeLeave)
      window.dispatchEvent(new CustomEvent('studio-source-plan-dirty', { detail: false }))
    }
  }, [dirty])
  useEffect(() => {
    const current = entry.current
    if (!current || (!current.busy && !current.error && signature(current.plan) === current.saved && material.version > current.version)) accept(material)
  }, [material, accept])
  async function start(inputBody: string) {
    if (operationBusy.current || dirty() || entry.current?.error) return
    setStarting(true); setStartError('')
    try {
      const current = object((await apiRequest(path)).draft)
      const result = await api(path, 'PATCH', { expectedVersion: current.version, draftPlanStart: { inputBody } })
      if (mounted.current) accept(object(result.draft || result.item))
    } catch (cause) { if (mounted.current) setStartError(errorText(cause)) }
    finally { if (mounted.current) setStarting(false) }
  }
  async function save() {
    clearTimeout(timer.current)
    const current = entry.current
    if (!current || current.busy || signature(current.plan) === current.saved) return
    const shots = editable(current.plan), saved = JSON.stringify(shots)
    current.busy = true; current.error = ''; changed()
    try {
      const patch = { expectedVersion: current.version, draftPlanEdits: { planId: current.raw.planId, shots } }
      let result
      try { result = await api(path, 'PATCH', patch) }
      catch (cause) {
        if (!(cause instanceof StudioClientError) || cause.status !== 409) throw cause
        const latest = object((await apiRequest(path)).draft), raw = object(latest.visualPlan), plan = readSourcePlan(raw)
        if (!plan || raw.planId !== current.raw.planId || signature(plan) !== current.saved || latest.body !== plan.inputBody)
          throw new Error('稿件或规划已在其他位置更新。你的输入已保留，请复制后重新读取并合并。')
        result = await api(path, 'PATCH', { ...patch, expectedVersion: latest.version })
      }
      const record = object(result.draft || result.item)
      current.saved = saved; current.version = Number(record.version); current.raw = object(record.visualPlan)
    } catch (cause) { current.error = errorText(cause) }
    finally { current.busy = false; changed(); if (mounted.current && !current.error && signature(current.plan) !== current.saved) void save() }
  }
  function edit(index: number, field: 'visual' | 'assets', value: string) {
    const current = entry.current
    if (!current) return
    current.plan = { ...current.plan, shots: current.plan.shots.map((shot, i) => i === index ? { ...shot, [field]: value } : shot) }
    current.revision += 1; changed(); clearTimeout(timer.current)
    if (!current.error) timer.current = setTimeout(() => void save(), 700)
  }
  async function reload() {
    const current = entry.current
    if (current?.busy || !window.confirm('重新读取会替换尚未保存的规划。请先复制需要的内容，确认重新读取？')) return
    const revision = current?.revision
    clearTimeout(timer.current)
    try {
      const latest = object((await apiRequest(path)).draft)
      if (entry.current?.revision !== revision) throw new Error('读取期间又有输入，当前规划已保留。')
      if (mounted.current) { accept(latest); setStartError('') }
    } catch (cause) { if (current) { current.error = errorText(cause); changed() } else setStartError(errorText(cause)) }
  }
  const pending = starting || externalBusy || !!snapshot && (snapshot.busy || signature(snapshot.plan) !== snapshot.saved)
  useEffect(() => { window.dispatchEvent(new CustomEvent('studio-source-plan-dirty', { detail: pending })) }, [pending])
  return { plan: snapshot?.plan || null, raw: snapshot?.raw || {}, pending, starting, error: snapshot?.error || startError || (query.error ? errorText(query.error) : ''),
    status: starting ? '正在分段…' : snapshot?.busy ? '正在保存…' : pending ? '尚未保存' : snapshot ? '已保存' : '', start, edit, save, reload, refetch: query.refetch }
}
