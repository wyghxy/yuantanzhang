'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import CreationProjectEvidence from '@/components/admin/CreationProjectEvidence'
import CreationProjectForm from '@/components/admin/CreationProjectForm'
import CreationScriptEditor from '@/components/admin/CreationScriptEditor'
import WritingWorkbench from '@/components/admin/writing/WritingWorkbench'
import StationHandoffProvenance from '@/components/admin/StationHandoffProvenance'
import NativeStudioProvenance from '@/components/admin/NativeStudioProvenance'
import '@/styles/writing-workbench.css'
import { RadarStatus } from '@/components/admin/RadarUI'
import { creationRequest } from '@/lib/creation-client'
import type { CreationDetailResponse } from '@/lib/creation-types'

export default function CreationProjectDetail({ projectId }: { projectId: number }) {
  const [data, setData] = useState<CreationDetailResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const loadSequence = useRef(0)
  async function requestReload() {
    setLoading(true); setError('')
    const sequence = ++loadSequence.current
    try {
      const nextData = await creationRequest<CreationDetailResponse>(`/api/workspace/content-projects/${projectId}`)
      if (sequence !== loadSequence.current) return
      setData(nextData); setError(''); setReloadKey((value) => value + 1)
    }
    catch (caught) { if (sequence === loadSequence.current) setError(caught instanceof Error ? caught.message : '项目读取失败') }
    finally { if (sequence === loadSequence.current) setLoading(false) }
  }
  useEffect(() => {
    const controller = new AbortController(), sequence = ++loadSequence.current
    void creationRequest<CreationDetailResponse>(`/api/workspace/content-projects/${projectId}`, { signal: controller.signal }).then((nextData) => {
      if (controller.signal.aborted || sequence !== loadSequence.current) return
      setData(nextData); setError(''); setReloadKey((value) => value + 1)
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted && sequence === loadSequence.current) setError(caught instanceof Error ? caught.message : '项目读取失败')
    }).finally(() => { if (!controller.signal.aborted && sequence === loadSequence.current) setLoading(false) })
    return () => controller.abort()
  }, [projectId])
  if (!data) return <section className="radar-panel" aria-busy={loading}><p role={error ? 'alert' : 'status'} className="text-sm leading-7">{loading ? '正在读取项目与来源…' : error}</p>{!loading && <button type="button" onClick={requestReload} className="radar-primary-button mt-4 min-h-11">重新加载</button>}<Link href="/workspace/creation" className="mt-4 block py-3 text-sm text-primary underline">返回创作列表</Link></section>
  const { project, sources } = data
  return <div className="creation-project-detail">
    <div className="admin-project-heading"><div><Link href="/workspace/creation" className="admin-project-back">← 创作工作台</Link><span className="text-muted-foreground">/</span><h1>{project.title}</h1></div><RadarStatus status={project.status} /></div>
    <p aria-live="polite" role={error ? 'alert' : 'status'} className={error || loading || message ? `mb-3 text-xs ${error ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}` : 'sr-only'}>{error || (loading ? '正在读取最新版本…' : message)}</p>
    <WritingWorkbench projectId={projectId} onMasterChanged={() => { void requestReload() }} masterEditor={<CreationScriptEditor key={`script-${reloadKey}-${project.masterScript?.version ?? 0}-${project.masterScript?.confirmedAt ?? 'draft'}`} projectId={project.id} title={project.title} script={project.masterScript} sources={sources} onReload={requestReload} onSaved={(masterScript, invalidated) => {
        setData((current) => current ? { ...current, project: { ...current.project, masterScript, status: !masterScript.confirmedAt && current.project.status === 'ready_to_publish' ? 'master_script' : current.project.status, variants: invalidated ? current.project.variants.map((variant) => ({ ...variant, status: 'needs_review', confirmedAt: null })) : current.project.variants } } : current)
        setMessage(masterScript.confirmedAt ? `母稿 v${masterScript.version} 已人工确认。` : `母稿 v${masterScript.version} 已保存；${invalidated} 个平台稿需要重新复核。`)
      }} />} />
    <NativeStudioProvenance projectId={project.id} masterVersion={project.masterScript?.version ?? 0} />
    <StationHandoffProvenance projectId={project.id} masterVersion={project.masterScript?.version ?? 0} />
    <details className="creation-project-metadata"><summary>项目制作信息、来源与发布历史</summary><div className="mt-4 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <fieldset disabled={loading} aria-busy={loading}><CreationProjectForm key={`project-${reloadKey}-${project.status}`} project={project} onSaved={(patch) => setData((current) => current ? { ...current, project: { ...current.project, ...patch } } : current)} /></fieldset>
      <CreationProjectEvidence project={project} />
    </div></details>
  </div>
}
