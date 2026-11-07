'use client'
import type { ManuscriptHandle } from './manuscript-rich-document'

import type { ReactNode, JSX, Dispatch, SetStateAction, RefObject } from 'react'

import { RotateCcw, Square, X } from 'lucide-react'

import { downloadStudioBlob, type StudioRenderCard } from '../studio-render-browser'

import {
  writingObject as obj,
  writingText as text,
  type WritingDraft,
  type WritingInput,
  type WritingRecord,
} from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import type { RecordData } from '../studio-client'

import type { WritingSegment } from '../studio-writing-model'

import {
  type Candidate,
  type View,
  type TextDownload,
  type Task,
  type SavedRevision,
  type HandoffPreview,
  date,
  active,
  taskNames,
} from './writing-editor-model'

import { StudioWritingCreation } from './StudioWritingCreation'

import { StudioWritingSettings } from './StudioWritingSettings'

import { StudioWritingRewrite } from './StudioWritingRewrite'

import { StudioWritingCandidate } from './StudioWritingCandidate'

import { StudioWritingHistory } from './StudioWritingHistory'

import { StudioWritingCards } from './StudioWritingCards'

import { StudioWritingHandoff } from './StudioWritingHandoff'

export function StudioWritingView({
  referencePanel,
  onSwitch,
  onPick,
  material,
  draft,
  busy,
  saveStatus,
  close,
  characters,
  error,
  setError,
  notice,
  setNotice,
  recovery,
  setInput,
  setRecovery,
  storageKey,
  conflict,
  input,
  draftId,
  acceptDraft,
  reference,
  copy,
  analysisContent,
  mobilePanel,
  setMobilePanel,
  frozen,
  taskDisabled,
  modelMissing,
  createTask,
  dirty,
  setSettingsOpen,
  setRewriteOpen,
  analysisPoints,
  visibleCandidates,
  openCandidate,
  view,
  setView,
  selection,
  textarea,
  setSelection,
  setSegmentId,
  parsed,
  download,
  speech,
  setCardEditor,
  render,
  renderProgress,
  renderAbort,
  textDownloads,
  renderedExports,
  downloadNow,
  openHistory,
  finalize,
  openHandoff,
  projectId,
  save,
  manuscriptComposing, onManuscriptCompose,
  task,
  setShowLogs,
  showLogs,
  logs,
  taskAction,
  settingsOpen,
  profile,
  editConfig,
  rewriteOpen,
  segmentId,
  setInstruction,
  instruction,
  candidate,
  closeCandidate,
  candidateStale,
  acceptStale,
  setAcceptStale,
  adopt,
  showHistory,
  closeHistory,
  revision,
  setRevision,
  history,
  setRestoreConfirmation,
  restoreConfirmation,
  restore,
  cardEditor,
  closeCards,
  handoffOpen,
  closeHandoff,
  targetProject,
  setTargetProject,
  setHandoff,
  projects,
  handoff,
  confirmHandoff,
  previewHandoff,
}: {
  referencePanel: ReactNode
  onSwitch?: (id: string) => void
  onPick?: (kind: 'topic' | 'source', id: string) => void
  sourcePlatform: string
  material: WritingRecord | null
  draft: WritingDraft
  sourceTitle: string
  sourceUrl: string
  adoptReferenceTopic: () => Promise<void>
  busy: string
  saveStatus?: string
  close: () => void
  characters: number
  error: string
  setError: Dispatch<SetStateAction<string>>
  notice: string
  setNotice: Dispatch<SetStateAction<string>>
  recovery: { input: WritingInput; version: number } | null
  setInput: Dispatch<SetStateAction<WritingInput>>
  setRecovery: Dispatch<SetStateAction<{ input: WritingInput; version: number } | null>>
  storageKey: string
  conflict: WritingDraft | null
  input: WritingInput
  draftId: string
  acceptDraft: (next: WritingDraft) => void
  reference: {
    body: string
    paragraphs: { text: string; seconds: number | null }[]
    source: string
    corrected: boolean
    analysis: WritingRecord
  }
  copy: (value: string) => Promise<void>
  sourceParagraphs: JSX.Element
  analysisContent: JSX.Element
  mobilePanel: 'writing' | 'reference'
  setMobilePanel: Dispatch<SetStateAction<'writing' | 'reference'>>
  frozen: boolean
  taskDisabled: boolean
  modelMissing: boolean
  createTask: (kind: string, extra?: WritingRecord) => Promise<void>
  dirty: boolean
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setRewriteOpen: Dispatch<SetStateAction<boolean>>
  analysisPoints: WritingRecord[]
  visibleCandidates: Candidate[]
  openCandidate: (item: Candidate) => void
  view: View
  setView: Dispatch<SetStateAction<View>>
  selection: string
  textarea: RefObject<ManuscriptHandle | null>
  setSelection: Dispatch<SetStateAction<string>>
  setSegmentId: Dispatch<SetStateAction<string>>
  parsed: { segments: WritingSegment[]; cards: StudioRenderCard[]; error: string }
  download: (format: 'markdown' | 'txt') => Promise<void>
  speech: string
  setCardEditor: Dispatch<SetStateAction<StudioRenderCard[] | null>>
  render: (cardId?: string) => Promise<void>
  renderProgress: string
  renderAbort: RefObject<AbortController | null>
  textDownloads: TextDownload[]
  renderedExports: WritingRecord[]
  downloadNow: number
  openHistory: () => Promise<void>
  finalize: () => Promise<void>
  openHandoff: () => Promise<void>
  projectId: number | null
  save: () => Promise<void>
  manuscriptComposing: boolean; onManuscriptCompose: (value: boolean) => void
  task: Task | null
  setShowLogs: Dispatch<SetStateAction<boolean>>
  showLogs: boolean
  logs: never[] | RecordData[]
  taskAction: (action: string) => Promise<void>
  settingsOpen: boolean
  profile: WritingRecord
  editConfig: (key: string, value: unknown) => void
  rewriteOpen: boolean
  segmentId: string
  setInstruction: Dispatch<SetStateAction<string>>
  instruction: string
  candidate: Candidate | null
  closeCandidate: () => void
  candidateStale: boolean
  acceptStale: boolean
  setAcceptStale: Dispatch<SetStateAction<boolean>>
  adopt: () => Promise<void>
  showHistory: boolean
  closeHistory: () => void
  revision: SavedRevision | null
  setRevision: Dispatch<SetStateAction<SavedRevision | null>>
  history: SavedRevision[]
  setRestoreConfirmation: Dispatch<SetStateAction<number | null>>
  restoreConfirmation: number | null
  restore: () => Promise<void>
  cardEditor: StudioRenderCard[] | null
  closeCards: () => void
  handoffOpen: boolean
  closeHandoff: () => void
  targetProject: string
  setTargetProject: Dispatch<SetStateAction<string>>
  setHandoff: Dispatch<SetStateAction<HandoffPreview | null>>
  projects: { id: number; title: string }[]
  handoff: HandoffPreview | null
  confirmHandoff: () => Promise<void>
  previewHandoff: () => Promise<void>
}) {
  return (
    <section className={`studio-column radar-source-page ${styles.root}`} aria-label="写稿工作台">
      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button aria-label="关闭错误提示" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {recovery && (
        <div className={styles.recovery}>
          <div>
            <strong>找到本标签页未保存的输入</strong>
            <p>
              基于 v{recovery.version} 暂存，服务器当前为 v{draft.version}。恢复只进入编辑区。
            </p>
          </div>
          <button
            onClick={() => {
              setInput(recovery.input)
              setRecovery(null)
              setNotice('已恢复暂存输入，请与当前保存版本比较后保存。')
            }}
          >
            恢复输入
          </button>
          <button
            onClick={() => {
              setRecovery(null)
              sessionStorage.removeItem(storageKey)
            }}
          >
            放弃暂存
          </button>
        </div>
      )}
      {conflict && (
        <div className={styles.recovery}>
          <div>
            <strong>服务器已有更新版本 v{conflict.version}</strong>
            <p>当前输入仍在编辑区，可下载副本后读取最新版本。</p>
          </div>
          <button
            onClick={() =>
              downloadStudioBlob(
                new Blob([input.body], { type: 'text/markdown;charset=utf-8' }),
                `unsaved-${draftId}.md`,
              )
            }
          >
            下载当前输入
          </button>
          <button
            onClick={() => {
              if (window.confirm('读取最新保存版本会替换编辑区输入，确认已保留需要的内容？'))
                acceptDraft(conflict)
            }}
          >
            读取最新版本
          </button>
        </div>
      )}

        <StudioWritingCreation
          saveBlocked={!!recovery || !!conflict}
          saveStatus={saveStatus}
          manuscriptComposing={manuscriptComposing} onManuscriptCompose={onManuscriptCompose}
          referencePanel={referencePanel}
          close={close}
        onSwitch={onSwitch}
        onPick={onPick}
          mobilePanel={mobilePanel}
          setMobilePanel={setMobilePanel}
          frozen={frozen}
          input={input}
          setInput={setInput}
          taskDisabled={taskDisabled}
          modelMissing={modelMissing}
          createTask={createTask}
          dirty={dirty}
          setSettingsOpen={setSettingsOpen}
          setRewriteOpen={setRewriteOpen}
          reference={reference}
          material={material}
          analysisPoints={analysisPoints}
          analysisContent={analysisContent}
          visibleCandidates={visibleCandidates}
          openCandidate={openCandidate}
          view={view}
          setView={setView}
          selection={selection}
          textarea={textarea}
          setSelection={setSelection}
          setSegmentId={setSegmentId}
          draft={draft}
          parsed={parsed}
          download={download}
          busy={busy}
          speech={speech}
          setCardEditor={setCardEditor}
          render={render}
          renderProgress={renderProgress}
          renderAbort={renderAbort}
          textDownloads={textDownloads}
          renderedExports={renderedExports}
          setError={setError}
          downloadNow={downloadNow}
          characters={characters}
          openHistory={openHistory}
          copy={copy}
          finalize={finalize}
          openHandoff={openHandoff}
          projectId={projectId}
          save={save}
        />
      {task && (
        <section className={styles.task}>
          <div>
            <span className={active(task) ? styles.taskDotActive : styles.taskDot} />
            <strong>{taskNames[task.status] || task.status}</strong>
            <button onClick={() => setShowLogs((v) => !v)}>
              {showLogs ? '收起日志' : '运行日志'}
            </button>
          </div>
          {active(task) && (
            <progress max={100} value={Number(task.progress || 0)} aria-label="生成任务进度" />
          )}
          <p>
            {task.error ||
              text(obj(logs[logs.length - 1]?.data).message) ||
              (active(task) ? '任务会在后台继续，刷新页面可恢复查看。' : '处理记录已保存。')}
          </p>
          <div className={styles.actions}>
            {active(task) ? (
              <button disabled={!!busy} onClick={() => void taskAction('cancel')}>
                <Square size={13} />
                停止任务
              </button>
            ) : ['failed', 'blocked', 'cancelled'].includes(task.status) ? (
              <button disabled={!!busy} onClick={() => void taskAction('retry')}>
                <RotateCcw size={14} />
                重试原任务
              </button>
            ) : null}
          </div>
          {showLogs && (
            <ol className={styles.logs}>
              {logs.map((event, i) => (
                <li key={String(event.seq || i)}>
                  <time>{date(event.createdAt)}</time>
                  <span>{text(obj(event.data).message) || text(event.event)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {settingsOpen && (
        <StudioWritingSettings
          setSettingsOpen={setSettingsOpen}
          frozen={frozen}
          profile={profile}
          input={input}
          editConfig={editConfig}
          setInput={setInput}
          save={save}
          busy={busy}
          dirty={dirty}
        />
      )}
      {rewriteOpen && (
        <StudioWritingRewrite
          setRewriteOpen={setRewriteOpen}
          selection={selection}
          segmentId={segmentId}
          setSelection={setSelection}
          setSegmentId={setSegmentId}
          frozen={frozen}
          setInstruction={setInstruction}
          instruction={instruction}
          taskDisabled={taskDisabled}
          modelMissing={modelMissing}
          input={input}
          createTask={createTask}
          error={error}
        />
      )}
      {candidate && (
        <StudioWritingCandidate
          closeCandidate={closeCandidate}
          candidate={candidate}
          draft={draft}
          dirty={dirty}
          candidateStale={candidateStale}
          acceptStale={acceptStale}
          setAcceptStale={setAcceptStale}
          input={input}
          error={error}
          busy={busy}
          adopt={adopt}
        />
      )}
      {showHistory && (
        <StudioWritingHistory
          closeHistory={closeHistory}
          busy={busy}
          revision={revision}
          setRevision={setRevision}
          history={history}
          setRestoreConfirmation={setRestoreConfirmation}
          input={input}
          error={error}
          restoreConfirmation={restoreConfirmation}
          restore={restore}
          dirty={dirty}
          draft={draft}
        />
      )}
      {cardEditor && (
        <StudioWritingCards
          closeCards={closeCards}
          cardEditor={cardEditor}
          setCardEditor={setCardEditor}
          error={error}
          input={input}
          setInput={setInput}
          setNotice={setNotice}
          setError={setError}
        />
      )}
      {handoffOpen && (
        <StudioWritingHandoff
          closeHandoff={closeHandoff}
          targetProject={targetProject}
          setTargetProject={setTargetProject}
          setHandoff={setHandoff}
          draft={draft}
          busy={busy}
          projects={projects}
          handoff={handoff}
          error={error}
          confirmHandoff={confirmHandoff}
          previewHandoff={previewHandoff}
        />
      )}
    </section>
  )
}
