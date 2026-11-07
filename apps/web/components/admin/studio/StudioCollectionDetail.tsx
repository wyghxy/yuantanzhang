'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import StudioCoverImage from './StudioCoverImage'
import { studioMaterialContentType } from '@ytz/contracts/studio-radar'
import { object, text, type RecordItem } from './studio-client'
import { transcriptText } from './StudioMaterialHelpers'
import { originalDuration } from './original-studio-model'
import { studioCollectedMetadata, studioCollectionBodyState } from './studio-collection-state'
import { studioSafeUrl } from './studio-operations-utils'
import { useStudioPrivacy } from './StudioPrivacy'
import { StudioTranscriptParagraph } from './StudioTranscriptParagraph'
import { StudioArticleBody } from './StudioArticleBody'
import { writingArticle } from './studio-writing-model'
import { collectionMetricFacts, collectionMetricsObservedLabel } from './studio-material-metrics'
import StudioReadState from './StudioReadState'
import StudioKnowledgeCapture from './StudioKnowledgeCapture'
import StudioCollectionRecovery from './StudioCollectionRecovery'
import { collectionRecoveryAction } from './studio-collection-recovery'
import StudioArticleOriginal from './StudioArticleOriginal'
import { articleOriginalUrl } from './studio-article-document'
import articleStyles from './StudioArticleOriginal.module.css'

export function collectionContentType(item: RecordItem) {
  const value = studioMaterialContentType(item)
  return ({ video: '视频', image: '图文', article: '文章', text: '文章' } as Record<string, string>)[value] || value
}

export function CollectionMediaIcon({ item }: { item?: RecordItem }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{item && collectionContentType(item) === '视频'
    ? <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m10 8 6 4-6 4Z" /></>
    : <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />}</svg>
}

export function collectionBodyState(item: RecordItem) {
  const state = studioCollectionBodyState(item)
  if (state.ready && state.complete) return studioSafeUrl(item.coverUrl || item.cover_url)
    ? state
    : { ...state, label: '正文就绪 · 缺封面', hint: '正文可以阅读，封面尚未取得，收录仍有缺项。' }
  return state
}

function publishedLabel(item: RecordItem) {
  const value = text(item.publishedAt || item.published_at), date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }) : '未提供'
}

function CollectionBody({ body, focused, title, article }: { body: string; focused?: boolean; title: string; article: boolean }) {
  const region = useRef<HTMLElement>(null)
  useEffect(() => { if (focused) region.current?.focus() }, [focused])
  const paragraphs = useMemo(() => body.split(/\n+/).filter(paragraph => paragraph.trim()), [body])
  return <section className={focused ? 'library-detail-scroll library-reader' : 'library-inline-body'} ref={region} tabIndex={focused ? 0 : undefined} aria-label="作品正文">
    {!body ? <p className="library-body-message" role="status">暂未返回可阅读的正文，作品信息仍然保留。</p>
      : <>{focused && <h3 className="ctx-title">{title}</h3>}{article ? <StudioArticleBody body={body} /> : paragraphs.map((paragraph, index) => <StudioTranscriptParagraph className="transcript-p" key={index} text={paragraph} />)}</>}
  </section>
}

export default function StudioCollectionDetail({ material, active = true, loading, error, excluded = false, placeholder = false, onTasks, onRetry, onBack, onAdopt, onRemix, onDelete, onRepair }: {
  material: RecordItem | undefined; active?: boolean; loading?: boolean; error?: string; excluded?: boolean
  /** 当前 material 只是列表摘要，正文仍在加载。 */ placeholder?: boolean
  onTasks?: () => void; onRetry?: () => void
  onBack: () => void; onAdopt: (item: RecordItem) => void; onRemix: (id: string) => void; onDelete?: (item: RecordItem) => void; onRepair?: (item: RecordItem) => void
}) {
  const [reading, setReading] = useState(false)
  const { creatorName, platformLabel, materialTitle } = useStudioPrivacy()
  const readButton = useRef<HTMLButtonElement>(null)
  const metadata = material ? studioCollectedMetadata(material) : null
  const title = materialTitle(metadata?.title)
  const body = material ? collectionBodyState(material) : null
  const shared = object(material?.sharedReference)
  const transcript = transcriptText(Object.keys(shared).length ? shared.transcript : material?.transcript).trim()
  const sourceUrl = studioSafeUrl(material?.url || material?.sourceUrl || material?.video_url)
  const articleUrl = articleOriginalUrl(shared.url || sourceUrl)
  const richArticle = !!material && writingArticle(material) && !!articleUrl
  const cover = studioSafeUrl(material?.coverUrl || material?.cover_url)
  const description = text(material?.originalDescription || material?.original_description || material?.description)
  const duration = material ? originalDuration(material.durationSeconds ?? material.duration ?? object(material.transcript).durationSeconds) : ''
  const metricsObserved = collectionMetricsObservedLabel(material?.metricsObservedAt)
  return <aside className="library-context-panel" id="videoPreviewPanel" aria-label="作品详情">
    <div className="library-pane-head">{reading ? <><button type="button" className="library-reader-back" onClick={() => { setReading(false); requestAnimationFrame(() => readButton.current?.focus()) }}>‹ 作品详情</button><h3>正文</h3></>
      : <><button type="button" className="library-detail-back" aria-label="返回作品列表" onClick={onBack}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>返回</button><h3>作品详情</h3></>}
      {(articleUrl || sourceUrl) && <a className="library-original-link" href={articleUrl || sourceUrl} target="_blank" rel="noreferrer">查看原文 ↗</a>}
      {active && material && <StudioReadState key={material.id} material={material} enabled={!loading && !error && !material.summaryOnly} className="btn-card-action secondary" />}
    </div>
    {material && error && <div className="library-read-notice" role="alert"><span>更新失败，保留上次读取的正文。</span>{onRetry && <button type="button" className="btn-card-action secondary" onClick={onRetry}>重新读取</button>}</div>}
    {material && metadata && body ? <>
      {reading ? richArticle ? <StudioArticleOriginal materialId={material.id} version={material.version} originalUrl={articleUrl} active={active} />
        : <CollectionBody body={transcript} focused title={title} article={writingArticle(material)} /> : <div className="library-detail-scroll" tabIndex={0} role="region" aria-label="作品详情内容">
        <div className="ctx-cover-wrap"><StudioCoverImage src={cover} version={material.version} className="ctx-cover-img" alt="作品封面" width={640} height={360} icon={<CollectionMediaIcon item={material} />} /></div>
        <h3 className="ctx-title">{title}</h3>
        <dl className="library-facts"><dt>平台</dt><dd>{platformLabel(material.platform) || '未提供'}</dd><dt>作者</dt><dd>{creatorName(metadata.author, '未提供')}</dd><dt>发布</dt><dd>{publishedLabel(material)}</dd><dt>形式</dt><dd>{collectionContentType(material) || '未提供'}{collectionContentType(material) === '视频' && duration ? ' · ' + duration : ''}</dd></dl>
        <dl className="library-facts" aria-label="互动数据（采集快照）" title="各项最近有效采集值，悬停可查看该项采集时间；不会自动请求刷新，— 表示来源未提供。">
          {collectionMetricFacts({ platform: material.platform, metrics: material.metrics, metricsObservedAt: material.metricsObservedAt, metricsObservedTimes: material.metricsObservedTimes }).map(fact => <Fragment key={fact.key}><dt>{fact.label}</dt><dd title={fact.observedLabel ? `采集时间：${fact.observedLabel}` : undefined}>{fact.value}</dd></Fragment>)}
          {metricsObserved && <><dt>数据时间</dt><dd>{metricsObserved}</dd></>}
        </dl>
        {description && <section className="library-source-description"><h4>作品描述</h4><p>{description}</p></section>}
        {onRepair && <div className="library-body-entry"><div><strong>补充素材</strong><p>补充正文或上传原视频，继续处理这篇作品。</p></div><button type="button" className="btn-card-action secondary" onClick={() => onRepair(material)}>补充素材</button></div>}
        <div className="library-body-entry"><div><strong>{body.complete ? '正文' : body.label}</strong>{!body.complete && <p>{body.hint}</p>}</div>{body.ready && <button type="button" ref={readButton} className="btn-card-action secondary" onClick={() => setReading(true)}>专注阅读</button>}</div>
        {active && collectionRecoveryAction(material) && <div className="library-body-entry"><StudioCollectionRecovery key={material.id} item={material} changed={onRetry} className="btn-card-action primary" /></div>}
        {placeholder ? <section className="library-inline-body"><p className="library-body-message" role="status">正在载入正文…</p></section>
          : richArticle ? <div className={articleStyles.inline}><StudioArticleOriginal materialId={material.id} version={material.version} originalUrl={articleUrl} active={active} /></div>
          : body.ready && <CollectionBody body={transcript} title={title} article={writingArticle(material)} />}
      </div>}
      {active && <StudioKnowledgeCapture material={material} enabled={!loading && !error} panel className="btn-card-action secondary" />}
      <div className="library-detail-footer"><button type="button" className="btn-card-action secondary" onClick={() => onAdopt(material)}>采纳到选题</button><button type="button" className="btn-card-action primary" onClick={() => onRemix(material.id)}>开始二创</button>{onDelete && <button type="button" className="btn-card-action secondary" onClick={() => onDelete(material)}>删除</button>}</div>
    </> : <div className="library-detail-scroll"><div className="library-empty" role={error ? 'alert' : loading || excluded ? 'status' : undefined}><CollectionMediaIcon /><h3>{loading ? '正在读取作品…' : error ? '暂时无法读取作品' : excluded ? '此作品不在当前已完成列表' : '选择一篇作品'}</h3><p>{error || (loading ? '正在读取作品详情与正文状态。' : excluded ? '可前往任务队列查看进度与记录。' : '查看来源与正文，或将作品用于创作。')}</p>{error && onRetry && <button type="button" className="btn-card-action secondary" onClick={onRetry}>重新读取</button>}{excluded && !loading && !error && onTasks && <button type="button" className="btn-card-action secondary" onClick={onTasks}>查看任务队列</button>}</div></div>}
  </aside>
}
