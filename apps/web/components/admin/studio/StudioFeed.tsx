'use client'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { RefreshCw } from 'lucide-react'
import { studioCollectedMetadata, studioCollectionBodyState } from './studio-collection-state'
import { useStudioPrivacy } from './StudioPrivacy'
import { object, dateLabel, type RecordItem } from './studio-client'
import { originalDuration, originalFeedGroups, originalPlatforms } from './original-studio-model'
import StudioCollectionRecovery from './StudioCollectionRecovery'

function hasFeedTextSelection(card: HTMLElement) {
  const selection = card.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed) return false
  for (let index = 0; index < selection.rangeCount; index++)
    if (selection.getRangeAt(index).intersectsNode(card)) return true
  return false
}

type Set<T> = Dispatch<SetStateAction<T>>
type Props = {
  total: number | null; feedMode: string; setFeedMode: Set<string>; range: string; setRange: Set<string>
  keyword: string; setKeyword: Set<string>; status: string; setStatus: Set<string>
  offset: number; setOffset: Set<number>; sample: string; setSample: Set<string>
  author: string; setAuthor: Set<string>; accounts: RecordItem[]; items: RecordItem[]
  error: string; loading: boolean; changed: () => void; setImportText: Set<string | null>
  selectView: (view: string) => void; openMaterial: (id: string, tab?: string) => void
  onAdopt: (item: RecordItem) => void; headerAction?: ReactNode; referenceBrowser?: boolean
}
export default function StudioFeed({ total, feedMode, setFeedMode, range, setRange, keyword, setKeyword, status, setStatus, offset, setOffset, sample, setSample, author, setAuthor, accounts, items, error, loading, changed, setImportText, selectView, openMaterial, onAdopt, headerAction, referenceBrowser }: Props) {
  const { platformLabel, creatorName, materialTitle } = useStudioPrivacy()
  const authorLabel = author === 'all' ? '' : creatorName(accounts.find(row => row.id === author)?.name, '已选作者')
  const groups = feedMode === 'cluster' ? originalFeedGroups(items) : [['', items] as [string, RecordItem[]]]
  const platformInfo = (value: unknown) => originalPlatforms.find(([key]) => key === value || key === 'bili' && value === 'bilibili')
  return <aside className="feed-column" id="feedColumn" aria-label="情报流">
    <div className="feed-header">
      <div className="feed-header-top">
        <h2 className="feed-title" id="feedColTitle">情报流 <span className="cw-result-count">{total ?? '—'}</span></h2>
        <div className="cw-feed-header-actions">
          <div className="view-mode-toggle" role="group" aria-label="情报展示方式">
            <button className={`view-mode-btn${feedMode === 'stream' ? ' active' : ''}`} aria-pressed={feedMode === 'stream'} onClick={() => setFeedMode('stream')}>流式</button>
            <button className={`view-mode-btn${feedMode === 'cluster' ? ' active' : ''}`} aria-pressed={feedMode === 'cluster'} onClick={() => setFeedMode('cluster')}>话题</button>
          </div>
          <button className="feed-refresh-btn" id="btnReloadFeed" aria-label="刷新情报流" onClick={changed}><RefreshCw size={18}/></button>
          {headerAction}
        </div>
      </div>
      <div className="feed-tools">
        <input id="feedKeyword" type="search" aria-label="搜索情报" value={keyword} onChange={event => { setKeyword(event.target.value); setOffset(0) }} placeholder="搜索标题、博主或话题…"/>
        <select id="feedRange" aria-label="筛选情报时间范围" value={range} onChange={event => { setRange(event.target.value); setOffset(0) }}>
          <option value="today">今天</option><option value="3d">近3天</option><option value="7d">近7天</option><option value="all">不限时间</option>
        </select>
        <select id="feedTranscriptFilter" aria-label="筛选正文状态" value={status} onChange={event => { setStatus(event.target.value); setOffset(0) }}>
          <option value="all">全部状态</option><option value="ready">正文就绪</option><option value="missing">正文未就绪</option>
        </select>
      </div>
    </div>
    <div className="feed-list" id="feedList" role="region" aria-label="情报列表" tabIndex={0}>
      {error && <p role="alert" className="original-error">{error}<button className="btn ghost" onClick={changed}>重试</button></p>}
      {!items.length && loading ? <div className="cw-empty">正在读取情报…</div>
        : !items.length ? !error && <div className="cw-empty">当前范围没有素材。<button className="btn ghost" onClick={() => setImportText('')}>添加素材</button></div>
        : groups.map(([topic, rows]) => <div key={topic} style={feedMode === 'cluster' ? { marginBottom: 12 } : { display: 'contents' }}>
          {topic && <div className="feed-cluster-label"># {topic} ({rows.length} · 本页)</div>}
          {rows.map(row => { const body = studioCollectionBodyState(row); return <article key={row.id} className="feed-card" onClick={event => {
            const target = event.target
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
                !(target instanceof Node) || !event.currentTarget.contains(target)) return
            const element = target instanceof Element ? target : target.parentElement
            if (!element || element.closest('button,a,input,select,textarea,label,summary,dialog,[role="dialog"],[role="button"],[role="link"],[contenteditable]') ||
                hasFeedTextSelection(event.currentTarget)) return
            openMaterial(row.id)
          }}>
            <div className="cw-feed-content">
              <div className="feed-card-meta">
                <span className={`badge ${platformInfo(row.platform)?.[2] || 'dy'}`}>{platformLabel(row.platform, platformInfo(row.platform)?.[1] || '文本')}</span>
                <span className="feed-card-creator">{creatorName(studioCollectedMetadata(row).author)}</span>
                <span className="feed-card-time">{dateLabel(row.publishedAt || row.createdAt)}</span>
              </div>
              <h3 className="feed-card-title"><button className="cw-feed-title" onClick={event => {
                const card = event.currentTarget.closest<HTMLElement>('.feed-card')
                if (event.detail && card && hasFeedTextSelection(card)) return
                openMaterial(row.id)
              }}>{materialTitle(studioCollectedMetadata(row).title, '未命名素材')}</button></h3>
              <div className="feed-card-foot">
                <span className={`t-status-tag ${body.complete ? 'ok' : 'missing'}`} title={body.hint}><span className="dot"/>{body.label}</span>
                <span style={{ marginLeft: 'auto' }}>{originalDuration(row.durationSeconds || row.duration || object(row.transcript).durationSeconds)}</span>
              </div>
            </div>
            <div className="cw-row-actions cw-feed-actions" role="group" aria-label="素材操作">
              <StudioCollectionRecovery item={row} changed={changed} />
              <button className="btn ghost" onClick={() => openMaterial(row.id, '爆款拆解')}>爆款拆解</button>
              <button className="btn ghost" onClick={() => openMaterial(row.id)}>去二创</button>
              <button className="btn cw-action-primary" onClick={() => onAdopt(row)}>采纳到选题</button>
            </div>
          </article> })}
        </div>)}
    </div>
    <div className="feed-pagination cw-draft-footer">
      <button className="btn ghost" aria-label="上一页素材" disabled={loading || !offset} onClick={() => setOffset(value => Math.max(0, value - 30))}>‹</button>
      <span>{total === null ? '—' : total ? `${offset + 1}—${Math.min(offset + 30, total)} / ${total}` : '0 / 0'}</span>
      <button className="btn ghost" aria-label="下一页素材" disabled={loading || total === null || offset + 30 >= total} onClick={() => setOffset(value => value + 30)}>›</button>
      <details className="feed-filter-menu"><summary aria-label={authorLabel ? `当前作者：${authorLabel}，更多素材筛选` : '更多素材筛选'} title={authorLabel ? `当前作者：${authorLabel}` : undefined} style={{maxWidth:'10em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{authorLabel ? '作者：' + authorLabel : '更多筛选'}</summary><div>
        <label>样例范围<select value={sample} onChange={event => { setSample(event.target.value); setOffset(0) }}><option value="exclude">我的真实素材</option><option value="only">试用样例</option><option value="all">全部（含样例）</option></select></label>
        <label>对标作者<select value={author} onChange={event => { setAuthor(event.target.value); setOffset(0) }}><option value="all">全部作者</option>{accounts.map(row => <option key={row.id} value={row.id}>{creatorName(row.name)}</option>)}</select></label>
        {!referenceBrowser && <button className="btn ghost" onClick={() => selectView('drafts')}>查看已保存稿件</button>}
      </div></details>
    </div>
  </aside>
}
