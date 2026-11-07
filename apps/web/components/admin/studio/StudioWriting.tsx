'use client'
import type { ManuscriptHandle } from './writing/manuscript-rich-document'
import { useManuscriptComposition } from './writing/useManuscriptComposition'
import { useWritingOperation } from './writing/useWritingOperation'
import { useWritingSave } from './writing/useWritingSave'
import { useAssistantWritingContext } from './studio-assistant-context'
import { manuscriptProjection } from './writing/manuscript-timeline'
import { studioRequest } from './studio-request'
import { requireStudioActivation } from './studio-preview'

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'

import { FileText, LoaderCircle } from 'lucide-react'

import {
  renderStudioCard,
  renderStudioCardsZip,
  type StudioRenderCard,
} from './studio-render-browser'

import {
  WritingApiError,
  writingCardSection,
  writingError,
  writingInput,
  writingObject as obj,
  writingReference,
  writingArticle,
  writingRequest as request,
  writingFreshRequest,
  writingSpeech,
  writingText as text,
  type WritingDraft,
  type WritingInput,
  type WritingRecord,
} from './studio-writing-model'

import styles from './StudioWriting.module.css'

import { useStudioTaskLog } from './useStudioTaskLog'

import {
  type Props,
  base,
  type View,
  type Candidate,
  type Task,
  type SavedRevision,
  type TextDownload,
  type HandoffPreview,
  serialize,
  parseWritingBody,
  active,
} from './writing/writing-editor-model'

import { StudioWritingReferences } from './writing/StudioWritingReferences'
import { StudioWritingView } from './writing/StudioWritingView'
import { StudioMaterialAnalysis } from './StudioMaterialAnalysis'
import { StudioWritingPlaybackProvider } from './writing/StudioWritingPlaybackContext'
import { useInitialSourceBody } from './writing/useInitialSourceBody'
import { sourcePlanFromCandidate } from './writing/source-reference-model'
import { rebaseWritingInput } from './writing/writing-rebase'
import { writingCacheKey, writingCacheScope, type WritingCacheScope } from './writing/writing-cache-scope'
import { invalidateStudioQueries } from './studio-query-cache'
import { platforms, type RecordItem } from './studio-client'

export default function StudioWriting(props: Props) {
  return <WritingEditor key={props.draftId} {...props} />
}

export function WritingEditor({ draftId, initialMode = 'original', initialTab, onClose, onChanged, onSwitch, onPick }: Props) {
  const url = `${base}drafts/${encodeURIComponent(draftId)}`
  const [draft, setDraft] = useState<WritingDraft | null>(null),
    [input, setInputState] = useState<WritingInput>({
      title: '',
      body: '',
      templateKey: 'tutorial_save_loop',
      config: {},
    })
  const [baseline, setBaseline] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState('')
  const [view, setView] = useState<View>('markdown'),
    [settingsOpen, setSettingsOpen] = useState(false),
    [rewriteOpen, setRewriteOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'writing' | 'reference'>('writing')
  const [material, setMaterial] = useState<WritingRecord | null>(null),
    [profile, setProfile] = useState<WritingRecord>({})
  const [candidates, setCandidates] = useState<Candidate[]>([]),
    [candidate, setCandidate] = useState<Candidate | null>(null),
    [acceptStale, setAcceptStale] = useState(false),
    [candidateStale, setCandidateStale] = useState(false)
  const [selectedTask, setTask] = useState<Task | null>(null),
    [showLogs, setShowLogs] = useState(false),
    [pollRevision, setPollRevision] = useState(0)
  const taskLog = useStudioTaskLog(selectedTask?.id || '', !!selectedTask?.id, pollRevision, showLogs)
  const observedTask = obj(taskLog.detail?.task)
  const task =
    observedTask.id === selectedTask?.id && typeof observedTask.status === 'string'
      ? (observedTask as Task)
      : selectedTask
  const logs = taskLog.events
  const [instruction, setInstruction] = useState(''),
    [selection, setSelection] = useState(''),
    [segmentId, setSegmentId] = useState('')
  const [history, setHistory] = useState<SavedRevision[]>([]),
    [showHistory, setShowHistory] = useState(false),
    [revision, setRevision] = useState<SavedRevision | null>(null)
  const [restoreConfirmation, setRestoreConfirmation] = useState<number | null>(null)
  const [recovery, setRecovery] = useState<{ input: WritingInput; version: number } | null>(null),
    [conflict, setConflict] = useState<WritingDraft | null>(null)
  const [cacheScope, setCacheScope] = useState<WritingCacheScope | null>(null)
  const [cardEditor, setCardEditor] = useState<StudioRenderCard[] | null>(null),
    [renderProgress, setRenderProgress] = useState(''),
    [renderedExports, setRenderedExports] = useState<WritingRecord[]>([]),
    [textDownloads, setTextDownloads] = useState<TextDownload[]>([])
  const [downloadNow, setDownloadNow] = useState(() => Date.now())
  const [handoffOpen, setHandoffOpen] = useState(false),
    [projects, setProjects] = useState<{ id: number; title: string }[]>([]),
    [targetProject, setTargetProject] = useState(''),
    [handoff, setHandoff] = useState<HandoffPreview | null>(null),
    [projectId, setProjectId] = useState<number | null>(null)
  const renderAbort = useRef<AbortController | null>(null),
    enqueueKey = useRef<{ input: string; key: string } | null>(null),
    textarea = useRef<ManuscriptHandle>(null)
  const alive = useRef(true),
    scope = useRef(new AbortController()),
    taskSeen = useRef('')
  const pendingPlan = useRef<{ taskId: string; title: string; inputBody: string } | null>(null)
  const latest = useRef({ draft, input })
  latest.current = { draft, input }
  const setInput = useCallback((value: SetStateAction<WritingInput>) => {
    const next = typeof value === 'function' ? value(latest.current.input) : value
    latest.current = { ...latest.current, input: next }
    setInputState(next)
  }, [])
  const dirty = !!draft && serialize(input) !== baseline
  useAssistantWritingContext(draft, input, setInput, textarea, !!busy, setNotice, material,
    dirty || !!busy, recovery || conflict ? '请先处理稿件的恢复或版本冲突，再发送。' : dirty && error ? '稿件尚未保存，请先处理保存错误再发送。' : '')
  useInitialSourceBody(draft, material, input, setInput, !!recovery)
  const manuscriptComposition = useManuscriptComposition()
  const storageKey = writingCacheKey(cacheScope, draftId)
  const parsed = useMemo(() => parseWritingBody(input.body), [input.body])
  const speech = useMemo(() => writingSpeech(input.body), [input.body]),
    characters = manuscriptProjection(speech).text.replace(/\s/g, '').length
  const frozen = busy !== '' && busy !== 'save'
  const localRequest = useCallback(
    <T,>(path: string, init?: RequestInit) =>
      request<T>(path, { ...init, signal: init?.signal || scope.current.signal }),
    [],
  )

  const refreshCandidates = useCallback(
    async (signal?: AbortSignal) => {
      const data = await localRequest<{ candidates: Candidate[] }>(url + '/candidates?projection=summary', { signal })
      if (alive.current && !signal?.aborted) setCandidates(data.candidates || [])
      return data.candidates || []
    },
    [url, localRequest],
  )
  const acceptDraft = useCallback((next: WritingDraft) => {
    latest.current = { draft: next, input: writingInput(next) }
    setDraft(next)
    const nextInput = writingInput(next)
    setInput(nextInput)
    setBaseline(serialize(nextInput))
    setSelection('')
    setSegmentId('')
    setConflict(null)
    setError('')
    setHandoff(null)
  }, [setInput])
  useEffect(() => {
    if (!renderedExports.length) return
    const timer = window.setInterval(() => setDownloadNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [renderedExports.length])
  useEffect(() => {
    // Each StrictMode setup owns its own signal; a later setup must not revive old callbacks.
    const controller = new AbortController()
    alive.current = true
    scope.current = controller
    const initialRequest = <T,>(path: string) => request<T>(path, { signal: controller.signal })
    const load = async () => {
      try {
        const data = await writingFreshRequest<{ draft: WritingDraft; cacheScope?: unknown }>(url, { signal: controller.signal })
        if (controller.signal.aborted) return
        const identity = writingCacheScope(data.cacheScope)
        setCacheScope(identity)
        acceptDraft(data.draft)
        try {
          // Never inspect or migrate an unowned legacy copy into the current account.
          const key = writingCacheKey(identity, draftId)
          const raw = key ? sessionStorage.getItem(key) : null,
            cached = raw ? JSON.parse(raw) : null
          if (
            cached?.input &&
            typeof cached.input.body === 'string' &&
            typeof cached.input.title === 'string' &&
            cached.version &&
            serialize(cached.input) !== serialize(writingInput(data.draft))
          )
            setRecovery(cached)
        } catch {
          /* A denied browser cache does not prevent server editing. */
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(writingError(e))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    void refreshCandidates(controller.signal).catch(() => {})
    void initialRequest<{ items: Task[] }>(base + 'tasks?projection=summary&limit=10&draftId=' + encodeURIComponent(draftId))
      .then(({ items }) => {
        if (!controller.signal.aborted && items?.[0]) setTask(items[0])
      }).catch(() => {})
    void initialRequest<{ profile: WritingRecord }>(base + 'profile')
      .then((r) => {
        if (!controller.signal.aborted) setProfile(r.profile || (r as WritingRecord))
      })
      .catch(() => {})
    return () => {
      alive.current = false
      controller.abort()
      renderAbort.current?.abort()
      window.dispatchEvent(
        new CustomEvent('studio-writing-dirty', { detail: { draftId, dirty: false } }),
      )
    }
  }, [acceptDraft, draftId, refreshCandidates, url])
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('studio-writing-dirty', { detail: { draftId, dirty } }))
    if (draft && !recovery && storageKey) {
      try {
        if (dirty)
          sessionStorage.setItem(storageKey, JSON.stringify({ input, version: draft.version }))
        else sessionStorage.removeItem(storageKey)
      } catch {
        /* Server save remains available when session storage is full. */
      }
    }
  }, [dirty, draft, draftId, input, recovery, storageKey])
  useEffect(() => {
    if (!task?.id) return
    const current = obj(taskLog.detail?.task)
    if (current.id !== task.id || typeof current.status !== 'string') return
    if (current.status === 'succeeded' && taskSeen.current !== current.id) {
      taskSeen.current = String(current.id)
      void refreshCandidates()
        .then(async rows => {
          if (!alive.current) return
          const context = pendingPlan.current
          if (context && context.taskId === current.id) {
            const result = rows.find(row => row.taskId === context.taskId)
            const detail = result && await localRequest<{ candidate: Candidate }>(`${base}candidates/${encodeURIComponent(result.id)}?projection=detail`)
            if (!alive.current) return
            const plan = detail && sourcePlanFromCandidate(detail.candidate, context)
            if (!plan) throw new Error('画面规划结果暂时无法读取')
            setInput(previous => ({ ...previous, config: { ...previous.config, visualPlan: plan } }))
            pendingPlan.current = null
            setNotice('已生成画面规划')
          } else setNotice('候选稿已生成。请比较后采用，当前正文未被覆盖。')
        })
        .catch(() => {
          if (alive.current) setNotice('任务已完成，候选读取暂时失败，请刷新重试。')
        })
    }
  }, [task?.id, taskLog.detail, refreshCandidates, localRequest, setInput])

  const operationPending = useRef(false)
  const perform = useWritingOperation({ busy, alive, draftId, setBusy, setError, setConflict, pendingRef: operationPending })
  const saving = useWritingSave({ url, storageKey, cacheScope, busy, draft, input, dirty, blocked: !!recovery || !!conflict,
    composing: manuscriptComposition.active, composingRef: manuscriptComposition.composing, recovering: !!recovery, latest, alive, operationPending, setBusy, setError, setConflict,
    accept: (next, value) => {
      latest.current = { draft: next, input: value }
      setDraft(next); setInput(value); setBaseline(serialize(writingInput(next)))
      setError(''); setNotice(''); setConflict(null); setHandoff(null)
      window.dispatchEvent(new CustomEvent('studio-writing-dirty', { detail: { draftId, dirty: serialize(value) !== serialize(writingInput(next)) } }))
      onChanged?.()
    } })
  const save = async () => { await saving.save() }
  const refreshAdoptedReferences = async (topic: RecordItem) => {
    if (topic.id !== latest.current.draft?.topicId) return
    invalidateStudioQueries(url)
    const data = await localRequest<{ draft: WritingDraft }>(url)
    if (!alive.current) return
    const previous = latest.current.draft
    if (!previous || previous.version >= data.draft.version) return
    const merged = rebaseWritingInput(writingInput(previous), latest.current.input, writingInput(data.draft))
    if (!merged) { setConflict(data.draft); setError('稿件已在其他位置更新，请先处理版本冲突'); return }
    latest.current = { draft: data.draft, input: merged }
    setDraft(data.draft)
    setBaseline(serialize(writingInput(data.draft)))
    setInput(merged)
    setConflict(null)
    setHandoff(null)
  }
  const createTask = (kind: string, extra: WritingRecord = {}) =>
    perform('generate', async () => {
      if (!draft || dirty) throw new Error('请先保存当前修改，再生成候选稿')
      const localProfile = Object.fromEntries(
        ['positioning', 'expressions', 'avoidExpressions']
          .filter((key) => text(input.config[key]).trim())
          .map((key) => [key, text(input.config[key])]),
      )
      const payload = {
          kind,
          draftId,
          expectedVersion: draft.version,
          ...(Object.keys(localProfile).length ? { profile: localProfile } : {}),
          ...extra,
        },
        encoded = JSON.stringify(payload)
      if (enqueueKey.current?.input !== encoded)
        enqueueKey.current = { input: encoded, key: crypto.randomUUID() }
      const data = await localRequest<{ task: Task }>(base + 'tasks?projection=summary', {
        method: 'POST',
        body: JSON.stringify({ ...payload, idempotencyKey: enqueueKey.current.key }),
      })
      if (!alive.current) return
      enqueueKey.current = null
      if (kind === 'storyboard') pendingPlan.current = { taskId: data.task.id, title: input.title, inputBody: input.body }
      setTask(data.task)
      setPollRevision((r) => r + 1)
      if (kind === 'rewrite') setRewriteOpen(false)
      setNotice('任务已入队。可以继续手动写稿，生成结果会单独保存为候选。')
    })
  const taskAction = (action: string) =>
    perform(action, async () => {
      if (!task) return
      const result = await localRequest<{ task: Task }>(`${base}tasks/${task.id}/${action}?projection=summary`, {
        method: 'POST',
        body: '{}',
      })
      setTask(result.task)
      setPollRevision((n) => n + 1)
    })
  const openCandidate = (item: Candidate) => {
    void perform('candidate', async () => {
      const detail = item.summaryOnly ? (await localRequest<{ candidate: Candidate }>(`${base}candidates/${encodeURIComponent(item.id)}?projection=detail`)).candidate : item
      if (!alive.current) return
      setCandidate(detail)
      setAcceptStale(false)
      setCandidateStale(Number(detail.target?.version) !== draft?.version || detail.sourceStale === true)
    })
  }
  const adopt = () =>
    perform('adopt', async () => {
      if (!draft || !candidate || dirty) throw new Error('请先保存或保留当前输入副本，再采用候选')
      try {
        const data = await localRequest<{ draft: WritingDraft }>(
          `${url}/candidates/${candidate.id}/adopt`,
          { method: 'POST', body: JSON.stringify({ expectedVersion: draft.version, acceptStale }) },
        )
        if (!alive.current) return
        acceptDraft(data.draft)
        setCandidate(null)
        await refreshCandidates()
        setNotice(`候选已采用为 v${data.draft.version}`)
        onChanged?.()
      } catch (e) {
        if (e instanceof WritingApiError && e.code === 'stale_candidate') setCandidateStale(true)
        throw e
      }
    })
  const openHistory = () =>
    perform('history', async () => {
      const data = await localRequest<{ history: SavedRevision[] }>(url + '/history')
      setHistory(data.history)
      setRevision(data.history.find((r) => r.version !== draft?.version) || data.history[0] || null)
      setRestoreConfirmation(null)
      setShowHistory(true)
    })
  const restore = () =>
    perform('restore', async () => {
      if (!draft || !revision || dirty) throw new Error('请先保存当前输入，再恢复历史版本')
      if (restoreConfirmation !== revision.version) throw new Error('请先确认要恢复的历史版本')
      const data = await localRequest<{ draft: WritingDraft }>(url + '/restore', {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: draft.version, restoreVersion: revision.version }),
      })
      acceptDraft(data.draft)
      setRestoreConfirmation(null)
      setShowHistory(false)
      setNotice('历史正文已恢复为新版本，请重新检查后定稿。')
      onChanged?.()
    })
  const finalize = () =>
    perform('finalize', async () => {
      if (!draft || dirty) throw new Error('请先保存正文，再确认定稿')
      const data = await localRequest<{ draft: WritingDraft }>(url + '/finalize', {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: draft.version }),
      })
      acceptDraft(data.draft)
      setNotice('当前版本已定稿，可以预览交接到内容项目。')
      onChanged?.()
    })
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setNotice('已复制到剪贴板')
    } catch {
      setError('浏览器未允许复制，请选中文字后手动复制')
    }
  }
  const download = (format: 'markdown' | 'txt') =>
    perform('download', async () => {
      requireStudioActivation()
      if (!draft || dirty) throw new Error('请先保存当前修改，再准备对应版本的文件')
      const href = `${url}/export?format=${format}&expectedVersion=${draft.version}`
      await studioRequest(href, { signal: scope.current.signal, cache: 'no-store' }, async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || '文件准备未完成')
        }
        return response.text()
      })
      const item = {
        format,
        version: draft.version,
        filename: `script-v${draft.version}.${format === 'markdown' ? 'md' : 'txt'}`,
        href,
      }
      setTextDownloads((previous) =>
        [item, ...previous.filter((row) => row.format !== format)].slice(0, 2),
      )
      setNotice(
        `v${draft.version} 文件已就绪，请点击下方“下载 ${format === 'markdown' ? 'Markdown' : 'TXT'}”链接。文件是否落盘以浏览器下载记录为准。`,
      )
    })
  const render = (cardId?: string) =>
    perform('render', async () => {
      requireStudioActivation()
      if (!draft || dirty) throw new Error('请先保存卡片和正文，再导出贴图')
      const controller = new AbortController()
      renderAbort.current = controller
      try {
        setRenderProgress('正在核对已保存版本…')
        const saved=await localRequest<{draft:WritingDraft}>(url,{signal:controller.signal})
        if(saved.draft.version!==draft.version)throw new Error('稿件已在其他窗口更新，请先比较最新版本')
        const preview=writingCardSection(saved.draft.body)
        if(!preview.cards.length)throw new Error('稿件中还没有已保存的贴图卡片')
        const card = cardId ? preview.cards.find((c) => c.id === cardId) : null
        if (cardId && !card) throw new Error('这张卡片已变化，请刷新当前稿件后重试')
        const blob = card
          ? await renderStudioCard(card, controller.signal)
          : await renderStudioCardsZip(
              preview.cards,
              (done, total) => setRenderProgress(`正在生成贴图 ${done} / ${total}`),
              controller.signal,
            )
        const filename = card ? `${card.id}-v${draft.version}.png` : `cards-v${draft.version}.zip`
        if(!blob.size)throw new Error('生成的贴图为空，请重试')
        const href=URL.createObjectURL(blob)
        const link=document.createElement('a');link.href=href;link.download=filename;link.click()
        setRenderedExports(previous=>[{filename,urlPath:href,bytes:blob.size},...previous].slice(0,8))
        const release=()=>URL.revokeObjectURL(href);window.setTimeout(release,60000)
        setNotice(filename+' 已生成，请查看浏览器下载记录。')
      } catch (e) {
        if (controller.signal.aborted) throw new Error('贴图导出已停止，稿件仍保持原样。')
        throw e
      } finally {
        renderAbort.current = null
        setRenderProgress('')
      }
    })
  const openHandoff = () =>
    perform('handoff-open', async () => {
      if (dirty) throw new Error('请先保存和定稿')
      const data = await localRequest<{ projects: { id: number; title: string }[] }>(
        '/api/workspace/content-projects',
      )
      setProjects(data.projects)
      setTargetProject(typeof draft?.projectId === 'number' ? String(draft.projectId) : '')
      setHandoff(null)
      setHandoffOpen(true)
    })
  const previewHandoff = () =>
    perform('handoff-preview', async () => {
      if (!draft) return
      const data = await localRequest<{ preview: HandoffPreview }>(url + '/handoff-preview', {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: draft.version,
          ...(targetProject ? { targetProjectId: Number(targetProject) } : {}),
        }),
      })
      setHandoff(data.preview)
    })
  const confirmHandoff = () =>
    perform('handoff', async () => {
      if (!handoff || !draft) return
      const data = await localRequest<{ projectId: number }>(url + '/handoff', {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: handoff.draftVersion,
          sourceDigest: handoff.sourceDigest,
          targetProjectId: handoff.targetProjectId,
          expectedMasterVersion: handoff.expectedMasterVersion,
          confirmed: true,
        }),
      })
      setProjectId(data.projectId)
      setHandoffOpen(false)
      setNotice('定稿已送入内容项目。发布前仍需完成事实复核。')
      onChanged?.()
    })
  const adoptReferenceTopic = () =>
    perform('topic', async () => {
      if (!material?.id) throw new Error('当前稿件没有关联参考素材')
      const data = await localRequest<{ duplicate?: boolean }>(base + 'topics', {
        method: 'POST',
        body: JSON.stringify({
          title: text(material.title),
          materialId: material.id,
          status: 'adopted',
        }),
      })
      setNotice(
        data.duplicate
          ? '这条参考素材已经在选题库中。'
          : '参考素材已采纳进选题库，当前稿件保持原样。',
      )
      onChanged?.()
    })
  // The host navigation guard flushes this editor before asking to leave.
  const close = onClose
  const editConfig = (key: string, value: unknown) =>
    setInput((prior) => ({ ...prior, config: { ...prior.config, [key]: value } }))
  const taskDisabled = !!busy || dirty || active(task)
  const visibleCandidates = candidates.filter((c) => c.status !== 'adopted' && c.id !== obj(input.config.visualPlan).candidateId)
  const closeCandidate = useCallback(() => {
    if (!busy) setCandidate(null)
  }, [busy])
  const closeHistory = useCallback(() => {
    if (!busy) {
      setRestoreConfirmation(null)
      setShowHistory(false)
    }
  }, [busy])
  const closeCards = useCallback(() => setCardEditor(null), [])
  const closeHandoff = useCallback(() => {
    if (!busy) setHandoffOpen(false)
  }, [busy])

  if (loading)
    return (
      <section className={styles.loading} aria-live="polite">
        <LoaderCircle className={styles.spin} size={24} />
        <p>正在读取已保存稿件…</p>
      </section>
    )
  if (!draft)
    return (
      <section className={styles.loading}>
        <FileText size={30} />
        <h2>稿件暂时无法打开</h2>
        <p role="alert">{error}</p>
        <button onClick={onClose}>返回稿件列表</button>
      </section>
    )
  const reference = writingReference(material)
  const analysisPoints = Array.isArray(reference.analysis.points) ? reference.analysis.points.map(obj) : []
  const sourceTitle = text(material?.title) || '独立手工稿件'
  const sourceUrl = text(material?.canonicalUrl) || text(material?.url)
  const sourcePlatform = platforms[text(material?.platform)] || text(material?.platform)
  const sourceParagraphs = (
    <>
      {reference.paragraphs.map((paragraph, i) => (
        <p className="transcript-p" key={i}>
          {paragraph.seconds !== null && (
            <time className="transcript-time">
              {String(Math.floor(paragraph.seconds / 60)).padStart(2, '0')}:
              {String(Math.floor(paragraph.seconds % 60)).padStart(2, '0')}
            </time>
          )}
          {paragraph.text}
        </p>
      ))}
    </>
  )
  const analysisContent = (
    <StudioMaterialAnalysis materialId={text(material?.id)} version={Number(material?.version || 0)} sourceTitle={text(material?.title)}
      transcript={reference.body} analysis={reference.analysis} disabled={frozen} article={writingArticle(material)}
      onMaterial={setMaterial} onChanged={onChanged} />
  )
  return (
    <StudioWritingPlaybackProvider enabled={!!draft.materialId || !!input.references?.length} material={material} initialMode={initialMode} initialTab={initialTab}>
    <StudioWritingView
      onSwitch={onSwitch}
      onPick={onPick}
      referencePanel={<StudioWritingReferences draft={draft} draftPending={dirty || !!busy || !!recovery || !!conflict || !!error} sourceMode={!draft.topicId && !!draft.materialId} initialTab={initialTab} input={input} setInput={setInput} material={material} onMaterial={setMaterial} frozen={frozen} analysisContent={analysisContent} copy={copy} createTask={createTask} taskDisabled={taskDisabled} onChanged={onChanged} defaultTopic={draft.topicId ? { id: text(draft.topicId), title: input.title, version: 0 } as RecordItem : undefined} onAdopt={refreshAdoptedReferences} />}
      sourcePlatform={sourcePlatform}
      material={material}
      draft={draft}
      sourceTitle={sourceTitle}
      sourceUrl={sourceUrl}
      adoptReferenceTopic={adoptReferenceTopic}
      busy={busy}
      saveStatus={saving.status}
      close={close}
      characters={characters}
      error={error}
      setError={setError}
      notice={notice}
      setNotice={setNotice}
      recovery={recovery}
      setInput={setInput}
      setRecovery={setRecovery}
      storageKey={storageKey}
      conflict={conflict}
      input={input}
      draftId={draftId}
      acceptDraft={acceptDraft}
      reference={reference}
      copy={copy}
      sourceParagraphs={sourceParagraphs}
      analysisContent={analysisContent}
      mobilePanel={mobilePanel}
      setMobilePanel={setMobilePanel}
      frozen={frozen}
      taskDisabled={taskDisabled}
      modelMissing={false}
      createTask={createTask}
      dirty={dirty}
      setSettingsOpen={setSettingsOpen}
      setRewriteOpen={setRewriteOpen}
      analysisPoints={analysisPoints}
      visibleCandidates={visibleCandidates}
      openCandidate={openCandidate}
      view={view}
      setView={setView}
      selection={selection}
      textarea={textarea}
      setSelection={setSelection}
      setSegmentId={setSegmentId}
      parsed={parsed}
      download={download}
      speech={speech}
      setCardEditor={setCardEditor}
      render={render}
      renderProgress={renderProgress}
      renderAbort={renderAbort}
      textDownloads={textDownloads}
      renderedExports={renderedExports}
      downloadNow={downloadNow}
      openHistory={openHistory}
      finalize={finalize}
      openHandoff={openHandoff}
      projectId={projectId}
      save={save}
      manuscriptComposing={manuscriptComposition.active} onManuscriptCompose={manuscriptComposition.change}
      task={task}
      setShowLogs={setShowLogs}
      showLogs={showLogs}
      logs={logs}
      taskAction={taskAction}
      settingsOpen={settingsOpen}
      profile={profile}
      editConfig={editConfig}
      rewriteOpen={rewriteOpen}
      segmentId={segmentId}
      setInstruction={setInstruction}
      instruction={instruction}
      candidate={candidate}
      closeCandidate={closeCandidate}
      candidateStale={candidateStale}
      acceptStale={acceptStale}
      setAcceptStale={setAcceptStale}
      adopt={adopt}
      showHistory={showHistory}
      closeHistory={closeHistory}
      revision={revision}
      setRevision={setRevision}
      history={history}
      setRestoreConfirmation={setRestoreConfirmation}
      restoreConfirmation={restoreConfirmation}
      restore={restore}
      cardEditor={cardEditor}
      closeCards={closeCards}
      handoffOpen={handoffOpen}
      closeHandoff={closeHandoff}
      targetProject={targetProject}
      setTargetProject={setTargetProject}
      setHandoff={setHandoff}
      projects={projects}
      handoff={handoff}
      confirmHandoff={confirmHandoff}
      previewHandoff={previewHandoff}
    />
    </StudioWritingPlaybackProvider>
  )
}
