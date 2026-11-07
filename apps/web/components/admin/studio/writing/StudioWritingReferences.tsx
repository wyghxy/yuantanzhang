'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { dateLabel, errorText, list, object, text, type RecordItem } from '../studio-client'
import { detailRecord } from '../studio-detail-record'
import { sourceOpeningEvidence } from '@ytz/contracts/studio-source-tools'
import { useStudioResource } from '../StudioQueryProvider'
import { StudioWritingSourceFeed } from './StudioWritingSourceFeed'
import { useOriginalComments } from './useOriginalComments'
import StudioAdoptDialog from '../StudioAdoptDialog'
import { useStudioPrivacy } from '../StudioPrivacy'
import { originalDuration } from '../original-studio-model'
import { studioSafeUrl } from '../studio-operations-utils'
import { writingArticle, writingReference, writingSourceMaterial, type WritingDraft, type WritingInput, type WritingRecord } from '../studio-writing-model'
import { sourceAnalysisDetail, sourcePlanText } from './source-reference-model'
import { useDraftPlan } from './useDraftPlan'
import { StudioSourceImages } from './StudioSourceImages'
import { StudioSourcePublication } from './StudioSourcePublication'
import styles from '../StudioWriting.module.css'
import { useWritingPlayback, writingReferenceTabs } from './StudioWritingPlaybackContext'
import { PreparationMessage } from './StudioWritingPlayback'
import { StudioReferenceReader } from './StudioReferenceReader'
import playbackStyles from './StudioWritingPlayback.module.css'
import StudioReadState from '../StudioReadState'
import StudioKnowledgeCapture from '../StudioKnowledgeCapture'
import { MaterialNotesPanel } from './MaterialNotesPanel'
import noteStyles from './TranscriptAnnotations.module.css'
import { StudioArticleOpening } from './StudioArticleOpening'
import { useBreakdownSourceLocation } from './useBreakdownSourceLocation'
import { BREAKDOWN_REVEAL_EVENT } from './breakdown-source-location'

const tabs = writingReferenceTabs

export function StudioWritingReferences({ draft, draftPending, sourceMode, initialTab, input, material: parentMaterial, onMaterial, frozen, analysisContent, copy, onChanged, defaultTopic, onAdopt }: {
  draft: WritingDraft; draftPending: boolean
  sourceMode: boolean; onChanged?: () => void
  defaultTopic?: RecordItem; onAdopt?: (topic: RecordItem) => void | Promise<void>
  initialTab?: string; input: WritingInput; setInput: Dispatch<SetStateAction<WritingInput>>
  material: WritingRecord | null; onMaterial: Dispatch<SetStateAction<WritingRecord | null>>
  frozen: boolean; analysisContent: ReactNode; copy: (value: string) => Promise<void>
  createTask: (kind: string) => Promise<void>; taskDisabled: boolean
}) {
  const visibleTabs = tabs
  const { creatorName, platformLabel, materialTitle } = useStudioPrivacy()
  const [adopting, setAdopting] = useState(false)
  const [selected, setSelected] = useState('')
  const [preview, setPreview] = useState(false)
  const [adding, setAdding] = useState(false)
  const refs = input.references || []
  const current = selected && (sourceMode || preview || refs.some(ref => ref.materialId === selected)) ? selected : refs[0]?.materialId || text(draft.materialId)
  const hasSource = !!current
  const key = [...new Set([...refs.map(ref => ref.materialId), ...(current ? [current] : [])])].join(',')
  const referenceQuery = useStudioResource('materials?' + new URLSearchParams({ projection: 'summary', listMode: 'feed', ids: key, sample: 'all', limit: '100' }), !!key)
  const sourceQuery = useStudioResource('materials?projection=summary&listMode=feed&limit=30&sample=all', sourceMode)
  const detailQuery = useStudioResource('materials/' + encodeURIComponent(current), !!current)
  const fetchedMaterial = detailRecord(detailQuery.data) as WritingRecord | null
  const material = parentMaterial?.id === current && Number(parentMaterial.version) >= Number(fetchedMaterial?.version || 0)
    ? parentMaterial : fetchedMaterial?.id === current ? fetchedMaterial : null
  const materials = list(referenceQuery.data?.items), allSources = list(sourceQuery.data?.items)
  const loading = !!current && detailQuery.isPending
  const failure = detailQuery.error || referenceQuery.error || sourceQuery.error
  const error = failure ? errorText(failure) : ''
  // Only the selected source downloads its transcript; the native selector uses summaries.
  // A different key has no old detail, so a late response cannot replace the new selection.
  const playback = useWritingPlayback()
  const setPlaybackSource = playback?.setSourceId
  useEffect(() => { setPlaybackSource?.(current) }, [current, setPlaybackSource])
  const [fallbackTab, setFallbackTab] = useState<(typeof tabs)[number]>(visibleTabs.find(value => value === initialTab) || visibleTabs[0])
  const tab = playback?.tab || fallbackTab
  const setTab = playback?.setTab || setFallbackTab
  const materialRevision = playback?.materialRevision || 0
  const refetchDetail = detailQuery.refetch
  useEffect(() => {
    if (current && materialRevision) void refetchDetail()
  }, [current, materialRevision, refetchDetail])
  useEffect(() => {
    onMaterial(current ? detailRecord(detailQuery.data) as WritingRecord | null : null)
  }, [current, detailQuery.data, onMaterial])
  const reload = () => { void referenceQuery.refetch(); if (current) void detailQuery.refetch(); if (sourceMode) void sourceQuery.refetch() }
  const choices = sourceMode ? allSources : materials.filter(item => refs.some(ref => ref.materialId === item.id))
  const options = [...(current && !choices.some(item => item.id === current) ? [{ id: current, title: material?.title }] : []), ...choices]
  const reference = useMemo(() => writingReference(material), [material])
  const article = writingArticle(material)
  const notes = playback!.notes
  const toolMaterial = useMemo(() => writingSourceMaterial(material), [material])
  const [imageUploads, setImageUploads] = useState<string[]>([])
  const sourcePlan = useDraftPlan(draft, imageUploads.length > 0)
  useEffect(() => {
    if (!imageUploads.length) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [imageUploads.length])
  const studio = useRef<HTMLElement>(null)
  const [plainReference, setPlainReference] = useState('')
  useBreakdownSourceLocation({ owner: studio, materialId: current, version: Number(material?.version), body: reference.body,
    reveal: trigger => {
      setPlainReference(current)
      if (sourceMode) {
        playback?.switchMode('original')
        window.dispatchEvent(new CustomEvent(BREAKDOWN_REVEAL_EVENT, { detail: { trigger } }))
      } else setTab('播放器')
    }, readRoot: () => {
      const owner = sourceMode ? studio.current?.closest('#creation-workspace')?.querySelector('.cw-left') : studio.current
      return owner?.querySelector<HTMLElement>('[data-breakdown-reading-root]') || null
    } })
  const [commentNotice, setCommentNotice] = useState('')
  const comments = useOriginalComments({ studio, material, notes, active: hasSource && tab === '爆款评论' && !adding, mounted: true, frozen, notify: setCommentNotice })
  const analysis = reference.analysis
  const detail = useMemo(() => sourceAnalysisDetail(reference.recognition, reference.body, reference.originalPublication, reference.sourceRef), [reference])
  const browse = (id: string, nextTab?: string) => {
    setSelected(id); setPreview(!refs.some(ref => ref.materialId === id)); setAdding(false)
    setTab(visibleTabs.find(value => value === nextTab) || visibleTabs[0])
  }
  const sourceUrl = studioSafeUrl(material?.sourceUrl || material?.canonicalUrl || material?.url || material?.video_url)
  const plan = sourcePlan.plan
  const planText = sourcePlanText(plan)
  const bundledOpening = object(analysis.opening)
  const hasBundledOpening = Array.isArray(bundledOpening.stages) && bundledOpening.stages.length > 0
  const opening = hasBundledOpening ? bundledOpening : object(object(toolMaterial?.sourceWorkspace).opening)
  const openingStages = Array.isArray(opening.stages) ? opening.stages.map(object) : []
  const evidence = useMemo(() => sourceOpeningEvidence(toolMaterial || {}), [toolMaterial])
  const staleOpening = hasBundledOpening ? analysis.stale === true : !!openingStages.length && (opening.inputBody !== reference.body || evidence.some(item => {
    const saved = openingStages.find(row => row.seconds === item.seconds)
    return !saved || saved.quote !== item.quote || saved.precision !== item.precision || saved.limitation !== item.limitation
  }))
  const stalePlan = !!plan && plan.inputBody !== input.body
  const storedPlan = sourcePlan.raw
  const storedShots = Array.isArray(storedPlan.shots) ? storedPlan.shots.map(object) : []
  const tabKeys = { '播放器': 'player', '爆款拆解': 'insight', '爆款评论': 'comments', '开场分析': 'opening', '话题与标签': 'tags', '画面规划': 'visuals', '我的笔记': 'notes' }
  return <>
    {adding && <StudioWritingSourceFeed close={() => setAdding(false)} choose={browse} defaultTopic={defaultTopic} onAdopt={onAdopt} onChanged={() => { reload(); onChanged?.() }} />}
    <section ref={studio} className={`studio-column ${playbackStyles.references}`} id="studioColumn" hidden={adding}>
      <div className="studio-header" hidden={tab === '画面规划'}>
        <div className="studio-header-left">
          <div className="studio-meta-bar">
            <span id="stBadges">{material && platformLabel(text(material.platform))}</span>
            <span id="stCreator" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{material && creatorName(text(material.author))}</span>
            {material && <span>·</span>}
            <span id="stPubTime">{material && dateLabel(material.publishedAt || material.createdAt)}</span>
            {material && <span>·</span>}
            <span id="stDuration">{!article && !!material?.durationSeconds && originalDuration(material.durationSeconds)}</span>
          </div>
          <div className="cw-reference-picker">
            <h1 className="studio-video-title" id="stTitle">{materialTitle(material?.title, hasSource ? '正在读取参考作品…' : '还没有采纳素材')}</h1>
            <select id="cw-source-select" aria-label={sourceMode ? '切换参考作品' : '切换参考素材，已采纳 ' + refs.length + ' 篇'} value={current} onChange={event => { setSelected(event.target.value); setPreview(false) }} disabled={!options.length}>
              {!options.length && <option value="">还没有参考素材</option>}
              {options.map((item, i) => <option key={item.id} value={item.id}>{materialTitle(item.title, '参考素材 ' + (i + 1))}</option>)}
            </select>
          </div>
        </div>
        <div className="studio-header-actions">
          {material && <StudioReadState key={current} material={material as RecordItem}
            enabled={!loading && !detailQuery.error && !material.summaryOnly} />}
          {material && <StudioKnowledgeCapture material={material as RecordItem} enabled={!loading && !detailQuery.error}
            blockedReason={frozen ? '当前操作完成后可以沉淀。' : !notes.ready || notes.dirty || notes.busy || notes.error ? '请先保存当前笔记后再沉淀。' : ''} />}
          {sourceUrl && <a className="btn ghost" id="stOrigLink" href={sourceUrl} target="_blank" rel="noreferrer" style={article ? { color: 'var(--ui-text)' } : undefined}>{article ? '查看原文 ↗' : '原链接 ↗'}</a>}
          <button className="btn" id="stBtnAdopt" disabled={frozen || !material} onClick={() => setAdopting(true)}>{!sourceMode && refs.some(ref => ref.materialId === current) ? '已采纳 · 更换选题' : '采纳到选题'}</button>
          <button className="btn ghost" id="cw-find" onClick={() => setAdding(true)} disabled={frozen}>＋ 找素材</button>
        </div>
      </div>
      <header className="cw-plan-head" hidden={tab !== '画面规划'}>
        <div><span className="cw-plan-label">当前稿件</span><h2 id="cw-plan-title">{input.title || '我的稿件'}</h2></div>
        <div className="cw-plan-actions"><button className="btn" id="cw-plan-generate" disabled={frozen || draftPending || sourcePlan.pending || !!sourcePlan.error && !!plan || imageUploads.length > 0 || !input.body.trim() || !!plan && !stalePlan} onClick={() => void sourcePlan.start(input.body)}>{sourcePlan.starting ? '正在分段…' : plan ? '更新文案分段' : '开始规划'}</button><button className="btn ghost" id="cw-plan-copy" disabled={!plan?.shots.length} onClick={() => void copy(planText)}>复制规划</button></div>
      </header>
      <div className={`studio-tabs-bar ${playbackStyles.referenceTabs}`}>
        <div className="studio-tabs" role="tablist" aria-label="参考内容">
          {visibleTabs.map((label, index) => <button className={'studio-tab' + (tab === label ? ' active' : '') + (['爆款评论', '开场分析', '话题与标签', '画面规划'].includes(label) ? ' cw-analysis-tab' : '') + (label === '我的笔记' ? ' preview-note-tab' : '')} data-tab={tabKeys[label]} key={label} id={'reference-tab-' + index} role="tab" aria-selected={tab === label} tabIndex={tab === label ? 0 : -1} onClick={() => setTab(label)} onKeyDown={event => {
            const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            if (!offset) return
            event.preventDefault()
            const next = (index + offset + visibleTabs.length) % visibleTabs.length
            setTab(visibleTabs[next]); document.getElementById('reference-tab-' + next)?.focus()
          }}>{article && label === '播放器' ? '阅读原文' : article && label === '开场分析' ? '开篇分析' : label}</button>)}
        </div>
      </div>
      {/* Empty references must not hide the workspace header or its tools. */}
      {hasSource && tab === '爆款评论' && <div className={styles.commentActions}>
        <span>可查看已保存的评论。</span>
        {['not_collected', 'failed'].includes(String(comments.snapshot?.status)) && <button type="button" className="btn" disabled={frozen || comments.busy}
          onClick={() => void comments.collect()}>{comments.busy ? '正在提交…' : comments.snapshot?.status === 'failed' ? '重新读取或重试评论' : '获取评论'}</button>}
        {comments.error && <p role="alert">{comments.error}</p>}
      </div>}
      <div className="cw-reference-empty" id="cw-reference-empty" hidden={hasSource || tab === '画面规划'}>
        <strong>还没有采纳素材</strong>
        <button className="btn" id="cw-find-empty" disabled={frozen} onClick={() => setAdding(true)}>从情报流选取</button>
        <button className="btn ghost" id="cw-plan-empty" onClick={() => setTab('画面规划')}>画面规划</button>
      </div>
      {error && <p role="alert">{error}<button className="btn ghost" onClick={reload}>重试</button></p>}
      <StudioReferenceReader visible={hasSource && tab === '播放器' && !adding} body={reference.body} notes={notes}
        plainText={plainReference === current} onRichArticle={() => setPlainReference('')}
        originalUrl={text(object(material?.sharedReference).url || material?.url)} version={typeof material?.version === 'number' ? material.version : undefined}
        disabled={frozen || loading} article={article} sourceMode={sourceMode} />
      <div className="studio-body pane-insight" id="paneInsight" hidden={!hasSource || tab !== '爆款拆解'}><div className={styles.breakdownContent}>
        {!article && <PreparationMessage />}
        {parentMaterial?.id === current ? analysisContent : <p>正在读取参考作品…</p>}
      </div></div>
      <section className="cw-analysis-detail" id="cw-analysis-detail" hidden={!hasSource || !['开场分析', '话题与标签'].includes(tab)}>
        <div className="cw-analysis-heading"><h2>{article && tab === '开场分析' ? '开篇分析' : tab}</h2>{tab === '开场分析' && <button type="button" className="btn" onClick={() => setTab('爆款拆解')}>{article || openingStages.length ? '查看爆款拆解' : '随爆款拆解一起生成'}</button>}</div>
        {tab === '开场分析' && article && <StudioArticleOpening analysis={analysis} />}
        {tab === '开场分析' && !article && <>
        {staleOpening && <p role="status">原文或时间证据已更新，以下为旧版开场分析，请重新生成。</p>}
        <div className="cw-opening-stages">{detail.stages.map((stage, index) => <section className="cw-opening-stage" key={stage.time}>
          <header><span title={text((staleOpening ? openingStages.find(row => row.seconds === evidence[index]?.seconds) : evidence[index])?.limitation)}>{stage.time}</span></header>
          <dl><div><dt>原文</dt><dd>{text((staleOpening ? openingStages.find(row => row.seconds === evidence[index]?.seconds) : evidence[index])?.quote) || '未取得可定位到该时段的原文。'}</dd></div></dl>
          {openingStages.find(row => row.seconds === evidence[index]?.seconds)?.analysis ? <dl><div><dt>开场分析</dt><dd>{text(openingStages.find(row => row.seconds === evidence[index]?.seconds)?.analysis)}</dd></div></dl> : <p>暂无开场分析</p>}
        </section>)}</div></>}
        {tab === '话题与标签' && <StudioSourcePublication publication={detail.original} />}
      </section>
      <section className="cw-visual-plan" id="cw-visual-plan" hidden={tab !== '画面规划'}>
        <div className="cw-plan-meta"><span>按文案安排画面 · 时段为预估</span><span id="cw-plan-state" role="status">{stalePlan ? '稿件已修改，请更新文案分段' : draftPending ? '等待稿件保存…' : sourcePlan.status}</span></div>
        {stalePlan && <p>更新分段会保留相同文案的画面与图片，旧规划可在稿件版本历史中查看。</p>}
        {sourcePlan.error && <p role="alert">{sourcePlan.error}{plan && <button className="btn ghost" onClick={() => void sourcePlan.save()}>重试保存</button>}<button className="btn ghost" onClick={() => void sourcePlan.reload()}>重新读取</button></p>}
        <div id="cw-plan-shots">
          {plan?.shots.length ? plan.shots.map((shot, i) => <article className="cw-plan-shot" key={shot.id}>
            <header><span className="cw-plan-time">{shot.time}</span><span>{shot.id}</span></header>
            <div className="cw-plan-speech"><span className="cw-plan-label">对应文案</span><p>{shot.speech}</p></div>
            <div className="cw-plan-fields"><label>画面安排<textarea data-shot={i} data-field="visual" value={shot.visual} maxLength={6000} disabled={frozen || stalePlan} onChange={event => sourcePlan.edit(i, 'visual', event.target.value)} onBlur={() => void sourcePlan.save()} aria-label={shot.id + ' 画面安排'} spellCheck={false} /></label><label>素材需求<textarea data-shot={i} data-field="assets" value={shot.assets} maxLength={6000} disabled={frozen || stalePlan} onChange={event => sourcePlan.edit(i, 'assets', event.target.value)} onBlur={() => void sourcePlan.save()} aria-label={shot.id + ' 素材需求'} spellCheck={false} /></label></div>
            {tab === '画面规划' && <StudioSourceImages key={draft.id + '/' + text(storedPlan.planId) + '/' + shot.id} draftId={draft.id} planId={text(storedPlan.planId)} shotId={shot.id} images={storedShots.find(row => row.id === shot.id)?.images}
              disabled={frozen || draftPending || stalePlan || sourcePlan.pending || !!sourcePlan.error} onChanged={() => void sourcePlan.refetch()}
              onBusy={(key, busy) => setImageUploads(previous => busy ? [...new Set([...previous, key])] : previous.filter(value => value !== key))} />}
          </article>) : <p className="cw-plan-empty">{input.body.trim() ? '点击“开始规划”，按稿件分段填写画面安排、素材需求，也可以上传或粘贴图片。' : '先在左侧写下稿件，再在这里安排画面。'}</p>}
        </div>
      </section>
      <section className={noteStyles.writingNotes} hidden={!hasSource || tab !== '我的笔记'}>
        <MaterialNotesPanel notes={notes} disabled={frozen || loading} textareaLabel="作品笔记" />
      </section>
      {hasSource && tab === '爆款评论' && (notes.error || commentNotice) && <p role={notes.error ? 'alert' : 'status'}>{notes.error || commentNotice}</p>}
    </section>
    {adopting && material && <StudioAdoptDialog material={material as RecordItem} defaultTopic={defaultTopic} close={() => setAdopting(false)} onSaved={async topic => { await onAdopt?.(topic); setAdopting(false); reload(); onChanged?.() }} />}
  </>
}
