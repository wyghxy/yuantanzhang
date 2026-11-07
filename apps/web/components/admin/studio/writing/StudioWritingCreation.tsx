'use client'
import type { ManuscriptHandle } from './manuscript-rich-document'

import { useEffect, useRef, useState, type ReactNode, type JSX, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { Sparkles } from 'lucide-react'
import type { StudioRenderCard } from '../studio-render-browser'
import { writingText as text, writingArticle, type WritingDraft, type WritingInput, type WritingRecord, type WritingSegment } from '../studio-writing-model'
import type { Candidate, View, TextDownload } from './writing-editor-model'
import { StudioWritingDraftPicker } from './StudioWritingDraftPicker'
import { StudioWritingTopicButton } from './StudioWritingTopicButton'
import { useWritingPlayback } from './StudioWritingPlaybackContext'
import { WritingModeSwitch, WritingTranscript } from './StudioWritingPlayback'
import playbackStyles from './StudioWritingPlayback.module.css'
import { StudioManuscriptEditor } from './StudioManuscriptEditor'
import { manuscriptProjection } from './manuscript-timeline'
import { StudioManuscriptActions } from './StudioManuscriptActions'
import { StudioManuscriptInsertion } from './StudioManuscriptInsertion'
import { BREAKDOWN_REVEAL_EVENT } from './breakdown-source-location'

/** Original creation-workbench DOM; only event/data bindings belong to the adapter. */
export function StudioWritingCreation({
  referencePanel, close, onSwitch, onPick, mobilePanel, setMobilePanel,
  frozen, input, setInput, selection, textarea, setSelection, setSegmentId,
  draft, characters, copy, busy, dirty, setError, save, reference, material, manuscriptComposing, onManuscriptCompose, saveBlocked, saveStatus,
}: {
  referencePanel: ReactNode
  close: () => void
  onSwitch?: (id: string) => void
  onPick?: (kind: 'topic' | 'source', id: string) => void
  mobilePanel: 'reference' | 'writing'
  setMobilePanel: Dispatch<SetStateAction<'reference' | 'writing'>>
  frozen: boolean
  input: WritingInput
  setInput: Dispatch<SetStateAction<WritingInput>>
  taskDisabled: boolean
  modelMissing: boolean
  createTask: (kind: string, extra?: WritingRecord) => Promise<void>
  dirty: boolean
  manuscriptComposing: boolean
  onManuscriptCompose: (value: boolean) => void
  saveBlocked: boolean
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setRewriteOpen: Dispatch<SetStateAction<boolean>>
  reference: {
    body: string
    paragraphs: { text: string; seconds: number | null }[]
    source: string
    corrected: boolean
    analysis: WritingRecord
  }
  material: WritingRecord | null
  analysisPoints: WritingRecord[]
  analysisContent: JSX.Element
  visibleCandidates: Candidate[]
  openCandidate: (item: Candidate) => void
  view: View
  setView: Dispatch<SetStateAction<View>>
  selection: string
  textarea: RefObject<ManuscriptHandle | null>
  setSelection: Dispatch<SetStateAction<string>>
  setSegmentId: Dispatch<SetStateAction<string>>
  draft: WritingDraft
  parsed: { segments: WritingSegment[]; cards: StudioRenderCard[]; error: string }
  download: (format: 'markdown' | 'txt') => Promise<void>
  busy: string
  saveStatus?: string
  speech: string
  setCardEditor: Dispatch<SetStateAction<StudioRenderCard[] | null>>
  render: (cardId?: string) => Promise<void>
  renderProgress: string
  renderAbort: RefObject<AbortController | null>
  textDownloads: TextDownload[]
  renderedExports: WritingRecord[]
  setError: Dispatch<SetStateAction<string>>
  downloadNow: number
  characters: number
  openHistory: () => Promise<void>
  copy: (value: string) => Promise<void>
  finalize: () => Promise<void>
  openHandoff: () => Promise<void>
  projectId: number | null
  save: () => Promise<void>
}) {
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null)
  const workspace = useRef<HTMLElement>(null)
  const mode = draft.topicId ? 'topic' : draft.materialId ? 'source' : 'draft'
  const playback = useWritingPlayback()
  const reading = mode === 'source' && playback?.enabled && playback.mode === 'original'
  const setReferenceVisible = playback?.setMobileReferenceVisible
  const registerRevealPlayer = playback?.registerRevealPlayer
  useEffect(() => {
    const reveal = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: HTMLElement }>).detail?.trigger
      if (mode === 'source' && trigger && workspace.current?.contains(trigger) && window.matchMedia('(max-width:650px)').matches)
        setMobilePanel('writing')
    }
    window.addEventListener(BREAKDOWN_REVEAL_EVENT, reveal)
    return () => window.removeEventListener(BREAKDOWN_REVEAL_EVENT, reveal)
  }, [mode, setMobilePanel])
  useEffect(() => {
    const query = window.matchMedia('(max-width:650px)')
    const update = () => setReferenceVisible?.(!query.matches || mobilePanel === 'reference')
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [mobilePanel, setReferenceVisible])
  useEffect(() => {
    return registerRevealPlayer?.(() => { if (window.matchMedia('(max-width:650px)').matches) setMobilePanel('reference') })
  }, [registerRevealPlayer, setMobilePanel])
  return (
    <StudioManuscriptInsertion key={draft.id} disabled={frozen} reveal={() => { playback?.switchMode('editor'); setMobilePanel('writing') }}>
    <section ref={workspace} id="creation-workspace" aria-label="创作中心"
      data-mode={mode === 'source' ? 'source' : 'topic'}
      data-panel={mobilePanel === 'writing' ? 'left' : 'right'}>
      <header className="cw-toolbar">
        <div className="cw-mobile-tabs" role="group" aria-label="切换工作面板">
          <button className="btn" aria-pressed={mobilePanel === 'writing'} onClick={() => setMobilePanel('writing')}>{mode === 'source' ? '原文与编辑' : '我的稿件'}</button>
          <button className="btn" aria-pressed={mobilePanel === 'reference'} onClick={() => setMobilePanel('reference')}>参考</button>
        </div>
      </header>
      <div className={`cw-grid ${playbackStyles.layoutGrid}`}>
        <section className="cw-left" id="cw-left">
          <section className="cw-writing" id="cw-writing" aria-label="稿件编辑与输出">
            <div className={`cw-current ${playbackStyles.current}`} id="cw-current">
              <div className="cw-breadcrumb">
                <button className="btn ghost" id="cw-back" title="返回创作中心" aria-label="返回创作中心" onClick={close}>
                  <span aria-hidden="true">‹</span> 返回
                </button>
              </div>
              <StudioWritingDraftPicker id={draft.id} title={input.title} mode={mode}
                entityId={text(mode === 'topic' ? draft.topicId : draft.materialId)}
                onSwitch={onSwitch} onPick={onPick} />
            </div>
            {/* Both modes keep the same rows. Original-reading disables the
                manuscript controls instead of moving the mode switch. */}
            <div className={playbackStyles.manuscriptTools} ref={setToolbarTarget} />
            <div className="cw-draft-toolbar">
              {playback?.enabled && mode === 'source' ? <WritingModeSwitch /> : <h2>{mode === 'source' ? '二创稿件' : '我的稿件'}</h2>}
              <span id="cw-draft-state" aria-live="polite">{saveStatus || (busy === 'save' ? '正在保存' : dirty ? '等待保存' : '已保存')}</span>
              {!reading && !!draft.topicId && <StudioWritingTopicButton id={text(draft.topicId)} disabled={frozen} onError={setError} />}
              <button id="cw-ai-write" className="btn cw-ai-button" aria-haspopup="dialog" hidden={reading}
                disabled={frozen} onClick={() => window.dispatchEvent(new Event('studio-ai-open'))}><Sparkles size={14} aria-hidden="true" />AI 帮写</button>
            </div>
            <StudioManuscriptEditor input={input} setInput={setInput} textarea={textarea} frozen={frozen}
              sourceTranscript={mode === 'source' && !writingArticle(material) && playback && playback.sourceId === draft.materialId ? playback.base.value?.transcript || playback.player.value?.transcript : undefined}
              toolbarTarget={toolbarTarget} onCompose={onManuscriptCompose} hidden={!!reading} dirty={dirty} busy={busy} save={save}
              onSelection={value => { setSelection(value); setSegmentId('') }} />
            <footer className="cw-draft-footer" hidden={reading}>
              <span id="cw-word-count">{characters} 字</span>
              <span id="cw-selection-count" hidden={!selection}>已选 {selection.length} 字</span>
              <StudioManuscriptActions draftId={draft.id} input={input} setInput={setInput} disabled={frozen}
                onClear={() => { setSelection(''); setSegmentId(''); textarea.current?.focus() }} />
              <button className="btn ghost" id="cw-copy" disabled={!input.body.trim()} onClick={() => void copy(manuscriptProjection(input.body).text)}>复制稿件</button>
              <button className="btn" id="cw-save" disabled={frozen || manuscriptComposing || saveBlocked || !dirty || !!busy} title={saveBlocked ? '请先处理恢复或版本冲突' : undefined} onClick={() => void save()}>{busy === 'save' ? '保存中…' : '保存'}</button>
            </footer>
            <WritingTranscript visible={!!reading} body={playback?.sourceId === material?.id ? reference.body : ''} article={writingArticle(material)} sourceVersion={typeof material?.version === 'number' ? material.version : undefined} notes={mode === 'source' ? playback?.notes : undefined} disabled={frozen} />
          </section>
        </section>
        <section className="cw-right" id="cw-right" aria-label="参考素材">
          {referencePanel}
        </section>
      </div>
    </section>
    </StudioManuscriptInsertion>
  )
}
