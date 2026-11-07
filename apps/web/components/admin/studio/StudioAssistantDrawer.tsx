'use client'
import { useStudioPrivacy } from './StudioPrivacy'
import { useUsageOperation } from '@/lib/use-usage-operation'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Copy,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  UserRound,
  WandSparkles,
  Waypoints,
  X,
} from 'lucide-react'
import { api, errorText, object, text } from './studio-client'
import {
  applyAssistantResult,
  currentAssistantContext,
  readyAssistantContext,
  type AssistantApplyMode,
  type AssistantContext,
} from './studio-assistant-context'
import { useStudioTaskLog } from './useStudioTaskLog'
import StudioAssistantSources, {
  type AssistantSources,
} from './StudioAssistantSources'
import StudioAssistantCoverage from './StudioAssistantCoverage'
import simple from './StudioAssistantSimple.module.css'

type Action = 'chat' | 'replicate' | 'structure' | 'account'
type Round = {
  taskId?: string
  question: string
  answer: string
}
const actions = [
  {
    id: 'replicate' as const,
    title: '参考改写',
    hint: '借鉴爆款机制，写成自己的文案',
    icon: WandSparkles,
    prompt:
      '围绕当前选题，借鉴参考作品的爆款机制，换一个切入点写一篇适合我的新文案。',
  },
  {
    id: 'structure' as const,
    title: '按结构写',
    hint: '沿用钩子、内容推进和收尾方式',
    icon: Waypoints,
    prompt: '参考这篇作品的实际拆解，沿用它的内容架构，为当前选题创作新文案。',
  },
  {
    id: 'account' as const,
    title: '按账号写',
    hint: '结合账号定位、受众和表达习惯',
    icon: UserRound,
    prompt: '根据我的账号定位和受众，围绕当前选题写一篇符合我表达习惯的文案。',
  },
]
const initialSources = (context: AssistantContext): AssistantSources => ({
  sourceMaterialId: context.sourceMaterialId || context.materialId || '',
  sourceTitle: context.sourceTitle || '',
  sourceVersion: context.sourceVersion,
  sourceAnalysisFingerprint: context.sourceAnalysisFingerprint,
  useStructure: false,
  useReferences: true,
  useProfile: false,
  creatorProfileId: '',
  socialAccountId: '',
  relatedDrafts: [],
})

export default function StudioAssistantDrawer({
  open,
  close,
  onTask,
  onDraft,
  context,
}: {
  open: boolean
  close: () => void
  onTask: (id: string) => void
  onDraft: (id: string) => void
  context: AssistantContext
}) {
  const { materialTitle } = useStudioPrivacy()
  const dialog = useRef<HTMLDialogElement>(null),
    promptInput = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const [resultContext, setResultContext] = useState<AssistantContext | null>(
    null,
  )
  const [sources, setSources] = useState(() => initialSources(context)),
    [action, setAction] = useState<Action>('chat')
  const [sourceExpanded, setSourceExpanded] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [lastContext, setLastContext] = useState<AssistantContext | null>(null)
  const [prompt, setPrompt] = useState(''),
    [question, setQuestion] = useState('')
  const [taskId, setTaskId] = useState(''),
    [previousId, setPreviousId] = useState(''),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [applied, setApplied] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false),
    [history, setHistory] = useState<Round[]>([])
  const [now, setNow] = useState(0),
    [started, setStarted] = useState(0)
  const pending = useRef(false),
    enqueue = useRef<{ signature: string; key: string } | null>(null)
  const sendScope = useRef<AbortController | null>(null)
  const usage = useUsageOperation(
    JSON.stringify([open, context, prompt, action, sources, webSearch]),
  )
  const taskLog = useStudioTaskLog(taskId, !!taskId, 0, false, true)
  const task = object(taskLog.detail?.task),
    status = text(task.status),
    output = object(task.output),
    answer = text(output.text)
  const active =
    !!taskId &&
    (!status || ['queued', 'running'].includes(status) || taskLog.resultPending)
  const selected =
    context.selectionStart !== undefined && context.selectionEnd !== undefined
      ? context.body.slice(context.selectionStart, context.selectionEnd)
      : ''
  const modelNote = ''
  const elapsed = Math.max(
    0,
    Math.floor((now - (Date.parse(text(task.createdAt)) || started)) / 1000),
  )
  useEffect(() => {
    if (!open) {
      composing.current = false
      dialog.current?.close()
      return
    }
    const trigger = document.activeElement as HTMLElement | null,
      node = dialog.current
    const small = window.matchMedia('(max-width: 1099px)')
    const show = () => {
      node?.close()
      if (small.matches) node?.showModal()
      else node?.show()
    }
    show()
    promptInput.current?.focus()
    small.addEventListener('change', show)
    return () => {
      sendScope.current?.abort()
      small.removeEventListener('change', show)
      node?.close()
      trigger?.focus()
    }
  }, [open])
  useEffect(() => {
    if (!active && !busy) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, busy])
  if (context !== lastContext) {
    setLastContext(context)
    const choice = actions.find((row) => row.id === context.intent)
    if (choice) {
      setAction(choice.id)
      setPrompt(choice.prompt)
      setSourceExpanded(
        choice.id === 'account' || !initialSources(context).sourceMaterialId,
      )
      setSources((old) => ({
        ...old,
        ...initialSources(context),
        useStructure: choice.id !== 'account',
        useProfile: choice.id === 'account',
      }))
    } else if (
      context.draftId &&
      sources.relatedDrafts.some((row) => row.draftId === context.draftId)
    ) {
      setSources((old) => ({
        ...old,
        relatedDrafts: old.relatedDrafts.filter(
          (row) => row.draftId !== context.draftId,
        ),
      }))
    }
  }
  function choose(value: (typeof actions)[number]) {
    setAction(value.id)
    setPrompt(value.prompt)
    setError('')
    setSourceExpanded(value.id === 'account' || !sources.sourceMaterialId)
    setSources((old) => ({
      ...old,
      useStructure: value.id !== 'account',
      useProfile: value.id === 'account' || old.useProfile,
    }))
    promptInput.current?.focus()
  }
  async function send() {
    if (!prompt.trim() || pending.current || active) return
    if (
      (sources.useStructure || ['replicate', 'structure'].includes(action)) &&
      !sources.sourceMaterialId
    ) {
      setSourceExpanded(true)
      setError('请选择一篇已完成拆解的参考作品。')
      return
    }
    if (
      (sources.useStructure || ['replicate', 'structure'].includes(action)) &&
      (!Number.isSafeInteger(sources.sourceVersion) ||
        Number(sources.sourceVersion) < 1)
    ) {
      setSourceExpanded(true)
      setError('参考作品版本尚未核实，请重新选择当前作品后再发送。')
      return
    }
    if (
      !context.draftId &&
      !context.materialId &&
      !sources.sourceMaterialId &&
      !sources.relatedDrafts.length
    ) {
      setSourceExpanded(true)
      setError('请先选择一篇稿件或参考作品，再开始创作。')
      return
    }
    pending.current = true
    setBusy(true)
    setStarted(() => Date.now())
    setNow(() => Date.now())
    setError('')
    setFeedback('')
    const scope = new AbortController()
    sendScope.current = scope
    const signal = AbortSignal.any([scope.signal, usage.begin()])
    let contextChanged: (() => void) | undefined
    try {
      if (context.draftId) setFeedback('正在确认稿件保存状态…')
      const current = await readyAssistantContext(context.draftId, signal),
        frozen = current.draftId ? current : context
      setFeedback('')
      if (frozen.draftId) {
        contextChanged = () => {
          const latest = currentAssistantContext()
          if (
            latest.draftId !== frozen.draftId ||
            latest.expectedVersion !== frozen.expectedVersion ||
            latest.title !== frozen.title ||
            latest.body !== frozen.body ||
            latest.writingPending ||
            latest.writingError
          )
            scope.abort()
        }
        window.addEventListener('studio-ai-context-changed', contextChanged)
      }
      const payload = {
        kind: 'assistant',
        prompt: prompt.trim(),
        action,
        webSearch,
        ...(frozen.draftId
          ? {
              draftId: frozen.draftId,
              expectedVersion: frozen.expectedVersion,
              title: frozen.title,
              body: frozen.body,
              ...(frozen.selectionStart !== undefined
                ? {
                    selectionStart: frozen.selectionStart,
                    selectionEnd: frozen.selectionEnd,
                  }
                : {}),
            }
          : frozen.materialId
            ? {
                materialId: frozen.materialId,
                expectedVersion: frozen.expectedVersion,
              }
            : {}),
        useReferences: sources.useReferences,
        useStructure: sources.useStructure,
        useProfile: sources.useProfile,
        relatedDrafts: sources.relatedDrafts.map(
          ({ draftId, expectedVersion }) => ({ draftId, expectedVersion }),
        ),
        ...(sources.sourceMaterialId
          ? {
              sourceMaterialId: sources.sourceMaterialId,
              ...(sources.sourceVersion !== undefined
                ? { sourceVersion: sources.sourceVersion }
                : {}),
              ...(sources.sourceAnalysisFingerprint
                ? {
                    sourceAnalysisFingerprint:
                      sources.sourceAnalysisFingerprint,
                  }
                : {}),
            }
          : {}),
        ...(sources.useProfile && sources.creatorProfileId
          ? { creatorProfileId: Number(sources.creatorProfileId) }
          : {}),
        ...(sources.useProfile && sources.socialAccountId
          ? { socialAccountId: Number(sources.socialAccountId) }
          : {}),
        ...((status === 'succeeded' ? taskId : previousId)
          ? { previousTaskId: status === 'succeeded' ? taskId : previousId }
          : {}),
      }
      const signature = JSON.stringify(payload)
      if (enqueue.current?.signature !== signature)
        enqueue.current = { signature, key: crypto.randomUUID() }
      signal.throwIfAborted()
      const result = await api(
        'tasks',
        'POST',
        { ...payload, idempotencyKey: enqueue.current.key },
        signal,
      )
      const id = text(object(result.task).id)
      if (!id) throw new Error('未收到任务编号，请重试确认任务是否已创建。')
      if (
        taskId &&
        taskId !== id &&
        ['succeeded', 'failed', 'cancelled', 'blocked'].includes(status)
      ) {
        setHistory((old) => [
          ...old.slice(-4),
          {
            taskId,
            question,
            answer: answer || text(task.error, '本次未生成文案。'),
          },
        ])
        if (status === 'succeeded') setPreviousId(taskId)
      }
      enqueue.current = null
      setTaskId(id)
      setResultContext(frozen)
      setQuestion(payload.prompt)
      setPrompt('')
      setApplied(false)
      setConfirmReplace(false)
      setAction('chat')
      onTask(id)
    } catch (cause) {
      if (!signal.aborted) setError(errorText(cause))
      setFeedback('')
    } finally {
      if (contextChanged)
        window.removeEventListener('studio-ai-context-changed', contextChanged)
      pending.current = false
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(answer)
      setFeedback('已复制文案。')
    } catch {
      setError('复制失败，请选择文案后复制。')
    }
  }
  function adopt(mode: AssistantApplyMode) {
    if (!resultContext || !answer || applied) return
    const problem = applyAssistantResult(resultContext, answer, mode)
    setFeedback(problem || '已放入稿件，保存后生效。')
    setConfirmReplace(false)
    if (!problem) setApplied(true)
  }
  async function createDraft() {
    if (pending.current || !answer) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await api('assistant-drafts', 'POST', { taskId })
      const id = text(object(result.item).id)
      if (!id) throw new Error('未收到新稿件编号，请重试。')
      setFeedback('已保存为新稿件。')
      onDraft(id)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function cancel() {
    try {
      await api('tasks/' + encodeURIComponent(taskId) + '/cancel', 'POST', {})
      setFeedback('已请求停止。')
    } catch (cause) {
      setError(errorText(cause))
    }
  }
  function reset() {
    if (active || busy) return
    setTaskId('')
    setPreviousId('')
    setHistory([])
    setPrompt('')
    setQuestion('')
    setError('')
    setFeedback('')
    setApplied(false)
    setConfirmReplace(false)
    setAction('chat')
    setWebSearch(false)
  }
  return (
    <dialog
      ref={dialog}
      id="ai-drawer"
      className={`ai-creation-drawer ${simple.drawer}`}
      aria-labelledby="ai-title"
      onCompositionStartCapture={() => {
        composing.current = true
      }}
      onCompositionEndCapture={() => {
        composing.current = false
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        if (
          !composing.current &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229
        )
          close()
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!composing.current) close()
      }}
    >
      <header className="ai-heading">
        <div className="ai-heading-title">
          <Sparkles size={18} />
          <h2 id="ai-title">AI 帮写</h2>
        </div>
        <div className="ai-heading-actions">
          <button
            className="icon-button"
            aria-label="开始新对话"
            title="开始新对话"
            disabled={busy || active}
            onClick={reset}
          >
            <RotateCcw className="icon" />
          </button>
          <button
            className="icon-button"
            id="ai-close"
            aria-label="关闭 AI 助手"
            onClick={close}
          >
            <X className="icon" />
          </button>
        </div>
      </header>
      <div className="ai-scroll">
        <section className="ai-context" aria-label="当前创作上下文">
          <div className="ai-context-top">
            <span>{context.draftId ? '当前稿件' : '当前内容'}</span>
            <span>{selected ? selected.length + ' 字选段' : ''}</span>
          </div>
          <h3 title={!context.draftId && (context.materialId || context.sourceMaterialId) ? materialTitle(context.title) : context.title}>{!context.draftId && (context.materialId || context.sourceMaterialId) ? materialTitle(context.title) : context.title}</h3>
          {selected && (
            <details>
              <summary>查看选段</summary>
              <blockquote>{selected}</blockquote>
            </details>
          )}
        </section>
        <StudioAssistantSources
          value={sources}
          change={setSources}
          open={open}
          disabled={busy || active}
          draft={!!context.draftId}
          currentDraftId={context.draftId}
          expanded={sourceExpanded}
          onExpanded={setSourceExpanded}
        />
        {!taskId && (
          <div className="ai-creation-actions" aria-label="写作方式">
            {actions.map((row) => (
              <button
                type="button"
                key={row.id}
                aria-pressed={action === row.id}
                title={row.hint}
                onClick={() => choose(row)}
                disabled={busy}
              >
                {row.title}
              </button>
            ))}
          </div>
        )}
        {!taskId && selected && (
          <div className="ai-suggestions">
            {['润色选段', '压缩选段', '让这段更口语化'].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setAction('chat')
                  setPrompt(value)
                  promptInput.current?.focus()
                }}
              >
                {value}
              </button>
            ))}
          </div>
        )}
        {!!history.length && (
          <details className="ai-history">
            <summary>历史对话（{history.length}）</summary>
            {history.map((row, index) => (
              <section key={row.taskId || `unlinked-${index}`}>
                <p className="ai-question">{row.question}</p>
                <div className="ai-result">{row.answer}</div>
                
              </section>
            ))}
          </details>
        )}
        {taskId && (
          <section
            className="ai-answer"
            aria-label="生成文案"
            aria-busy={active}
          >
            <details className="ai-history">
              <summary>本次要求</summary>
              <p className="ai-question">{question}</p>
            </details>
            <div className="ai-answer-heading">
              <h3>{active ? '生成中' : '结果'}</h3>
            </div>
            <StudioAssistantCoverage
              value={output.coverage || object(task.input).coverage}
            />
            {active && (
              <div className="ai-progress" role="status">
                <LoaderCircle className="ai-spinner" size={18} />
                <div>
                  <strong>
                    {taskLog.resultPending
                      ? '正在读取结果'
                      : text(task.phase, '准备中')}
                  </strong>
                  <span>{elapsed} 秒</span>
                </div>
                {!taskLog.resultPending && (
                  <button className="text-link" onClick={() => void cancel()}>
                    停止
                  </button>
                )}
              </div>
            )}
            {!active && (
              <div className="ai-result" id="ai-result">
                {answer || text(task.error, '未生成文案，请修改要求后重试。')}
              </div>
            )}
            
            {answer && (
              <>
                <div className="ai-result-actions">
                  {resultContext?.draftId &&
                  resultContext.selectionStart !== undefined ? (
                    <button
                      className="primary"
                      id="ai-replace"
                      disabled={applied}
                      onClick={() => adopt('replace')}
                    >
                      替换选段
                    </button>
                  ) : (
                    resultContext?.draftId && (
                      <button
                        className="primary"
                        id="ai-append"
                        disabled={applied}
                        onClick={() => adopt('append')}
                      >
                        追加到稿件
                      </button>
                    )
                  )}
                  {!resultContext?.draftId && (
                    <button
                      className="primary"
                      id="ai-new-draft"
                      disabled={busy}
                      onClick={() => void createDraft()}
                    >
                      存为新稿
                    </button>
                  )}
                  <button id="ai-copy" onClick={() => void copy()}>
                    <Copy size={15} />
                    复制
                  </button>
                  {resultContext?.draftId && (
                    <details className="ai-more-actions">
                      <summary>更多</summary>
                      {resultContext.selectionStart !== undefined && (
                        <button
                          id="ai-append"
                          disabled={applied}
                          onClick={() => adopt('append')}
                        >
                          追加到稿件
                        </button>
                      )}
                      <button
                        id="ai-whole"
                        disabled={applied}
                        onClick={() => setConfirmReplace(true)}
                      >
                        替换整篇
                      </button>
                      <button
                        id="ai-new-draft"
                        disabled={busy}
                        onClick={() => void createDraft()}
                      >
                        <FilePlus2 size={15} />
                        存为新稿
                      </button>
                    </details>
                  )}
                </div>
                {confirmReplace && (
                  <div
                    className="ai-confirm"
                    role="group"
                    aria-label="确认替换正文"
                  >
                    <p>替换整篇正文？</p>
                    <button className="primary" onClick={() => adopt('whole')}>
                      确认替换
                    </button>
                    <button onClick={() => setConfirmReplace(false)}>
                      取消
                    </button>
                  </div>
                )}
                <div className="ai-suggestions" aria-label="继续修改">
                  {['更口语一点', '缩短到一分钟', '给我三个不同开头'].map(
                    (value) => (
                      <button
                        key={value}
                        disabled={busy || active}
                        onClick={() => {
                          setPrompt(value)
                          promptInput.current?.focus()
                        }}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {(error || taskLog.error) && (
          <p className="ai-error" role="alert">
            {error || taskLog.error}
          </p>
        )}
        {feedback && (
          <p className="ai-feedback" role="status">
            {feedback}
          </p>
        )}
      </div>
      <form
        id="ai-form"
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <details className="ai-options">
          <summary>更多设置{webSearch ? ' · 已开启联网' : ''}</summary>
          <label className="ai-check">
            <input
              type="checkbox"
              checked={webSearch}
              disabled={busy || active}
              onChange={(event) => setWebSearch(event.target.checked)}
            />
            联网查证
          </label>
        </details>
        <label htmlFor="ai-prompt" className="sr-only">
          {answer ? '继续修改' : '写作要求'}
        </label>
        <div className="ai-input-shell">
          <textarea
            ref={promptInput}
            id="ai-prompt"
            rows={3}
            maxLength={4000}
            value={prompt}
            placeholder="想怎么写？例如：改成 60 秒口播，语气自然。"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === 'Enter' &&
                !composing.current &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div className="ai-composer-actions">
            {modelNote && (
              <span id="ai-mode-note" role="status">
                {modelNote}
              </span>
            )}
            <button
              className="primary"
              id="ai-send"
              title="Ctrl / ⌘ + Enter"
              disabled={busy || active || !prompt.trim()}
            >
              {busy
                ? '提交中'
                : active
                  ? '生成中'
                  : answer
                    ? '继续修改'
                    : '生成'}
              <ArrowRight className="icon" />
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
