'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, FileText, Plus, Search } from 'lucide-react'
import { RadarEmpty, RadarStatus } from '@/components/admin/RadarUI'
import CreationDeskOpportunityForm from './CreationDeskOpportunityForm'
import CreationDeskProjectForm from './CreationDeskProjectForm'
import CreationListOpportunity from './CreationListOpportunity'
import WritingQuickStart from './writing/WritingQuickStart'
import { creationRequest, type CreationCluster, type CreationOpportunity, type CreationProjectSummary, type CreationSource } from './CreationDeskTypes'
import '@/styles/creation-list.css'

type DeskTab = 'projects' | 'topics'
const projectStatuses = [['master_script', '母版脚本'], ['producing', '制作中'], ['ready_to_publish', '待发布'], ['published', '已发布'], ['reviewed', '已复盘'], ['abandoned', '已放弃']]
function displayDate(value: string) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) }

export default function CreationDesk({ sources, clusters, opportunities, projects }: { sources: CreationSource[]; clusters: CreationCluster[]; opportunities: CreationOpportunity[]; projects: CreationProjectSummary[] }) {
  const router = useRouter(), pending = useRef(false), editorRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<DeskTab>('projects')
  const [quickStart, setQuickStart] = useState(false)
  const [editing, setEditing] = useState<CreationOpportunity | 'new' | null>(null)
  const [creating, setCreating] = useState<CreationOpportunity | null>(null)
  const [busy, setBusy] = useState(false), [refreshing, startTransition] = useTransition()
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [query, setQuery] = useState(''), [status, setStatus] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const visibleTopics = opportunities.filter((item) => (!status || (status === 'accepted' ? ['accepted', 'selected'].includes(item.status) : item.status === status)) && `${item.title} ${item.angle} ${item.reason ?? ''}`.toLocaleLowerCase().includes(search))
  const visibleProjects = projects.filter((item) => (!status || item.status === status) && `${item.title} ${item.opportunity?.angle ?? ''}`.toLocaleLowerCase().includes(search))
  const visibleCount = tab === 'projects' ? visibleProjects.length : visibleTopics.length
  const totalCount = tab === 'projects' ? projects.length : opportunities.length
  function refresh() { startTransition(() => router.refresh()) }
  function focusEditor() { setTimeout(() => { editorRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); editorRef.current?.querySelector<HTMLInputElement>('input')?.focus() }, 0) }
  function openEditor(item: CreationOpportunity | 'new') { setQuickStart(false); setCreating(null); setEditing(item); focusEditor() }
  function openProject(item: CreationOpportunity) { setQuickStart(false); setEditing(null); setCreating(item); focusEditor() }
  function switchTab(next: DeskTab) { setTab(next); setStatus('') }
  async function changeStatus(item: CreationOpportunity, next: string, reason?: string) {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try { await creationRequest(`/api/workspace/content-opportunities/${item.id}`, 'PATCH', { status: next, ...(reason === undefined ? {} : { reason }) }); setNotice('选题状态已保存'); refresh(); return true }
    catch (failure) { setError(failure instanceof Error ? failure.message : '更新失败'); return false }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="creation-list-desk">
    <div className="creation-list-topbar">
      <div className="creation-list-tabs" role="group" aria-label="创作内容分类">
        <button type="button" aria-pressed={tab === 'projects'} onClick={() => switchTab('projects')}>二创工作台 <span>{projects.length}</span></button>
        <button type="button" aria-pressed={tab === 'topics'} onClick={() => switchTab('topics')}>选题库 <span>{opportunities.length}</span></button>
      </div>
      <div className="creation-list-actions">
        <button type="button" className="radar-ghost-button" onClick={() => openEditor('new')} disabled={busy || refreshing}><Plus size={13} />提出选题</button>
        <button type="button" className="radar-primary-button" onClick={() => { setEditing(null); setCreating(null); setQuickStart(true); focusEditor() }} disabled={busy || refreshing}><Plus size={13} />新建文案</button>
      </div>
    </div>
    <div ref={editorRef} className="creation-list-editor-anchor">
      {quickStart && <WritingQuickStart onCancel={() => setQuickStart(false)} />}
      {editing && <CreationDeskOpportunityForm key={editing === 'new' ? 'new' : editing.id} opportunity={editing === 'new' ? null : editing} sources={sources} clusters={clusters} cancel={() => setEditing(null)} saved={() => { setEditing(null); setNotice('选题已保存，等待人工确认'); refresh() }} />}
      {creating && <CreationDeskProjectForm key={creating.id} opportunity={creating} cancel={() => setCreating(null)} />}
    </div>
    {(error || notice || refreshing) && <p aria-live="polite" role="status" className={`creation-list-notice${error ? ' is-error' : ''}`}>{error || (refreshing ? '正在更新列表…' : notice)}</p>}
    <section aria-label={tab === 'projects' ? '文案项目列表' : '选题列表'} aria-busy={refreshing}>
      <div className="creation-list-toolbar">
        <label className="creation-list-search"><Search size={14} aria-hidden="true" /><span className="sr-only">{tab === 'projects' ? '搜索文案项目' : '搜索选题'}</span><input type="search" value={query} maxLength={240} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'projects' ? '搜索文案标题、创作角度…' : '搜索选题、角度或决策记录…'} /></label>
        <label className="creation-list-filter"><span className="sr-only">{tab === 'projects' ? '项目状态' : '选题状态'}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option>{tab === 'projects' ? projectStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>) : <><option value="proposed">待确认</option><option value="accepted">已接受</option><option value="rejected">已拒绝</option></>}</select></label>
        <span className="creation-list-count">{visibleCount === totalCount ? `共 ${totalCount} 条` : `${visibleCount} / ${totalCount} 条`}</span>
      </div>
      {tab === 'projects' ? <>
        <div className="creation-list-inbox">{visibleProjects.length ? visibleProjects.map((project) => <article key={project.id} className="creation-list-row">
          <span className="creation-list-file-icon" aria-hidden="true"><FileText size={16} /></span>
          <div className="creation-list-row-main"><Link className="creation-list-title" href={`/workspace/creation/${project.id}`} title={project.title}>{project.title}</Link><div className="creation-list-meta"><span>{project.opportunity ? '选题创作' : '素材创作'}</span><span>母稿 v{project.masterScript?.version ?? 0} · {project.masterScript?.confirmedAt ? '已确认' : '待确认'}</span>{project.dueAt && <span title="截止时间（北京时间）">截止 {displayDate(project.dueAt)}</span>}</div></div>
          <RadarStatus status={project.status} />
          <time className="creation-list-time" dateTime={project.updatedAt} title="最后更新（北京时间）">{displayDate(project.updatedAt)}</time>
          <Link className="radar-primary-button creation-list-open" href={`/workspace/creation/${project.id}`}>继续创作<ArrowUpRight size={13} /></Link>
        </article>) : <RadarEmpty title={projects.length ? '没有匹配的文案' : '开始你的第一篇文案'} description={projects.length ? '调整搜索或状态筛选，查看其他项目。' : '点击「新建文案」，导入素材并开始写稿；也可以从选题库继续创作。'} />}</div>
      </> : <>
        <div className="creation-list-inbox">{visibleTopics.length ? visibleTopics.map((item) => <CreationListOpportunity key={item.id} opportunity={item} busy={busy || refreshing} edit={() => openEditor(item)} create={() => openProject(item)} changeStatus={(next, reason) => changeStatus(item, next, reason)} />) : <RadarEmpty title={opportunities.length ? '没有匹配的选题' : '选题库空空如也'} description={opportunities.length ? '调整搜索或状态筛选，查看其他选题。' : '从情报流采纳灵感，或点击「提出选题」记录自己的创作判断。'} />}</div>
        <p className="creation-list-footnote">按人工评分与已确认策略排序；未评分选题也可保留、编辑和确认。</p>
      </>}
    </section>
  </div>
}
