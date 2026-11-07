'use client'

import { useEffect, useRef, useState } from 'react'
import StudioCollectionCard from './StudioCollectionCard'
import { api, errorText, list, object, type RecordItem } from './studio-client'
import StudioAdoptDialog from './StudioAdoptDialog'
import StudioDeleteDialog from './StudioDeleteDialog'
import StudioMaterialRecovery from './StudioMaterialRecovery'
import { useStudioPrivacy } from './StudioPrivacy'
import { originalPlatforms } from './original-studio-model'
import { studioCollectionSubmissionFeedback } from './studio-collection-feedback'
import { studioCollectionCount, studioListPage } from './studio-list-navigation'
import StudioCollectionDetail from './StudioCollectionDetail'
import StudioCollectionEmpty from './StudioCollectionEmpty'
import { useStudioResource, useStudioSearch } from './StudioQueryProvider'
import StudioCollectionActivity from './StudioCollectionActivity'
import StudioCollectionRefreshButton from './StudioCollectionRefreshButton'
import headerStyles from './StudioCollectionHeader.module.css'
import StudioCollectionCompleteBatch from './StudioCollectionCompleteBatch'
import { StudioLibraryAccessNotice, useStudioLibraryAccess } from './useStudioLibraryAccess'

type Facets = { deliveryCounts?: { complete: number; incomplete: number }; total: number; coveredCreators: number; platforms: Record<string, number>; creators: { accountId: string; author: string; count: number }[] }
const pageSize = 20

export default function StudioCollection({ initialReadState, initialMaterialId = '', explicitRecoveryId = '', platform, accountId, accounts, onAccount, onPlatform, onReadState, onMaterial, onSelection, onTopic, onDraft, onTasks, onChanged, notify }: {
  revision: number; initialReadState: string; initialMaterialId?: string; explicitRecoveryId?: string; platform: string; onPlatform: (value: string) => void
  onReadState: (value: string) => void; onMaterial: (id: string, tab?: string) => void; onTopic: (id: string) => void; onDraft: (id: string) => void
  onSelection?: (id: string) => void
  onChanged: () => void; onImport: () => void; onTasks: () => void; notify: (message: string) => void
  accountId: string; accounts: RecordItem[]; onAccount: (value: string) => void
}) {
  const { creatorName, platformLabel } = useStudioPrivacy()
  const schedule = useStudioResource('schedule')
  const completeMode = schedule.data?.completeCollection !== false, defaultDelivery = completeMode ? 'complete' : 'all'
  const [query, setQuery] = useState(''), [deliveryChoice, setDeliveryChoice] = useState({ mode: completeMode, value: null as string | null })
  const modeReady = !!schedule.data || !!schedule.error
  const delivery = completeMode ? 'complete' : deliveryChoice.mode === completeMode ? deliveryChoice.value ?? 'all' : 'all'
  if (modeReady && deliveryChoice.mode !== completeMode) setDeliveryChoice({ mode: completeMode, value: null })
  const setDelivery = (value: string | null) => setDeliveryChoice({ mode: completeMode, value })
  const [contentType, setContentType] = useState('all'), [author, setAuthor] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false), [deleting, setDeleting] = useState<RecordItem | null>(null), [restoring, setRestoring] = useState('')
  const restoreBusy = useRef(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterBar = useRef<HTMLDivElement>(null), filterToggle = useRef<HTMLButtonElement>(null), section = useRef<HTMLElement>(null)
  const search = useStudioSearch(query)
  // Loading the saved default must not close an explicitly opened material.
  const filterKey = JSON.stringify([platform, accountId, author, initialReadState, search, delivery, completeMode, contentType, deleted])
  const [selection, setSelection] = useState({ request: initialMaterialId, scope: filterKey, id: initialMaterialId, open: !!initialMaterialId, mode: modeReady ? completeMode : null as boolean | null })
  const activeSelection = selection.request !== initialMaterialId ? { request: initialMaterialId, scope: filterKey, id: initialMaterialId, open: !!initialMaterialId, mode: completeMode }
    : selection.scope === filterKey && (!modeReady || selection.mode !== null) ? selection
      : { ...selection, scope: filterKey, mode: modeReady ? completeMode : null, ...(selection.mode === null ? {} : { id: '', open: false }) }
  if (activeSelection !== selection) setSelection(activeSelection)
  const [pagination, setPagination] = useState({ scope: filterKey, offset: 0 })
  const currentPage = studioListPage(pagination, filterKey, pageSize), offset = currentPage.offset
  if (currentPage !== pagination) setPagination(currentPage)
  const params = new URLSearchParams({ projection: 'summary', limit: String(pageSize), offset: String(offset), sample: 'all', platform, accountId,
    q: search, collectionView: 'library', deliveryStatus: delivery, contentType, readState: initialReadState, listMode: 'cards' })
  if (author !== null) params.set('author', author)
  if (deleted) { for (const key of [...params.keys()]) if (!['projection', 'limit', 'offset'].includes(key)) params.delete(key); params.set('deleted', '1') }
  const result = useStudioResource('materials?' + params, deleted || modeReady)
  const facetParams = new URLSearchParams(params); facetParams.delete('offset'); facetParams.delete('limit'); facetParams.set('view', 'facets')
  const facetQuery = useStudioResource('materials?' + facetParams, !deleted && modeReady && !!result.data && !result.isPlaceholderData)
  const items = list(result.data?.items), total = Number(result.data?.total || 0)
  // Facets are an independent read. Filtered totals cannot stand in for the whole library.
  const facets = facetQuery.data?.facets as Facets | undefined
  const facetError = facetQuery.error ? errorText(facetQuery.error) : ''
  const loading = result.isPending || result.isPlaceholderData, displayOffset = Number(result.data?.offset ?? offset), error = result.error ? errorText(result.error) : ''
  const authorsLoading = !deleted && !facets && (result.isFetching || facetQuery.isFetching)
  // Read-state updates can remove a row from "unread" without closing the reader.
  // An explicit filter change still clears the selection.
  const selected = activeSelection.id
  useEffect(() => { onSelection?.(activeSelection.open ? selected : '') }, [selected, activeSelection.open, onSelection])
  const { access, pendingSelection, detailAllowed } = useStudioLibraryAccess({ selected, inPage: items.some(row => row.id === selected), completeMode, modeReady, active: activeSelection.open, deleted, explicitRecoveryId })
  const detailOpen = activeSelection.open && !!selected && detailAllowed
  const detail = useStudioResource('materials/' + encodeURIComponent(selected), !!selected && detailOpen && !deleted, true)
  const [collecting, setCollecting] = useState(false), [adopting, setAdopting] = useState<RecordItem | null>(null)
  const [collectionFeedback, setCollectionFeedback] = useState({ message: '', error: false })
  const [repairing, setRepairing] = useState<RecordItem | null>(null)
  const collectionRequest = useRef<{ scope: string; key: string; expectedVersion?: number } | null>(null)
  const collectionBusy = useRef(false)
  const [listingChoice, setListingChoice] = useState({ scope: '', enabled: false })
  const listingScope = JSON.stringify([platform, accountId]), listingAccount = accounts.find(row => row.id === accountId)
  const listingOnly = listingChoice.scope === listingScope && listingChoice.enabled
  const collectionAbort = useRef<AbortController | null>(null)
  useEffect(() => () => { collectionAbort.current?.abort() }, [platform, accountId, listingOnly])
  async function restore(row: RecordItem) {
    if (restoreBusy.current) return
    restoreBusy.current = true; setRestoring(row.id)
    try { await api('materials/' + encodeURIComponent(row.id) + '/restore', 'POST', { expectedVersion: row.version, restoreDeleted: true }); notify('作品已恢复，原正文保留。'); onChanged() }
    catch (cause) { notify(errorText(cause)) }
    finally { restoreBusy.current = false; setRestoring('') }
  }
  // Clamp an emptied last page before rendering it; the next render queries the valid page.
  const boundedPage = studioListPage(currentPage, filterKey, pageSize, result.data && !result.isPlaceholderData ? total : null)
  if (boundedPage !== currentPage) setPagination(boundedPage)
  useEffect(() => {
    if (!filtersOpen) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterBar.current?.contains(event.target)) setFiltersOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setFiltersOpen(false); filterToggle.current?.focus() }
    }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [filtersOpen])

  const collect = async () => {
    if (collectionBusy.current) return
    if (author !== null && accountId === 'all') {
      const message = '请先关注该作者并选择对应博主，再同步新发布作品。'
      setCollectionFeedback({ message, error: true }); notify(message); return
    }
    collectionBusy.current = true; setCollecting(true)
    setCollectionFeedback({ message: '正在准备采集…', error: false })
    const scope = JSON.stringify([platform, accountId, listingOnly])
    if (collectionRequest.current?.scope !== scope) collectionRequest.current = { scope, key: crypto.randomUUID(),
      ...(listingOnly ? { expectedVersion: listingAccount?.version } : {}) }
    const controller = new AbortController(); collectionAbort.current = controller
    try {
      const result = await api('collections', 'POST', { platform, ...(accountId !== 'all' ? { accountIds: [accountId] } : {}), collectionMode: 'incremental', collectionIntent: 'check_updates', idempotencyKey: collectionRequest.current.key,
        ...(listingOnly ? { listingOnly: true, listingPointLimit: 7, expectedVersion: collectionRequest.current.expectedVersion } : {}) }, controller.signal)
      const collection = object(result.collection)
      collectionRequest.current = null
      setListingChoice({ scope: listingScope, enabled: false })
      const feedback = studioCollectionSubmissionFeedback(collection)
      setCollectionFeedback(feedback); notify(feedback.message)
      onChanged()
    } catch (cause) {
      const status = object(cause).status
      // A confirmed rejection can be requoted; an unknown network outcome retains its original key/version.
      if (listingOnly && typeof status === 'number' && status >= 400 && status < 500) collectionRequest.current = null
      const message = errorText(cause); setCollectionFeedback({ message, error: true }); notify(message)
    }
    finally { if (collectionAbort.current === controller) collectionAbort.current = null; collectionBusy.current = false; setCollecting(false) }
  }
  // Never render a list summary as a transcript, or reuse the previous selection's detail.
  // item 是详情主键；material 仅为兼容旧响应的回退。
  const detailItem = object(detail.data?.item || detail.data?.material)
  // 详情还没回来时，先用列表里这一行的摘要渲染头部，点击后不再是一片空白。
  const listingRow = list(result.data?.items).find(row => row.id === selected)
  const detailReady = detailItem.id === selected
  const placeholderMaterial = !detailReady && detailOpen && listingRow ? listingRow : undefined
  const current = !deleted && detailAllowed
    ? (detailReady ? detailItem as RecordItem : placeholderMaterial as RecordItem | undefined) : undefined
  const selectionOpen = !deleted && activeSelection.open && !!selected
  const detailLoading = selectionOpen && ((!modeReady && selected !== explicitRecoveryId) || (detailOpen ? detail.isPending : access.isFetching))
  const detailError = selectionOpen && !detailAllowed && access.error && !access.isFetching ? errorText(access.error)
    : detailOpen && detail.error ? errorText(detail.error) : undefined
  const creatorKey = accountId !== 'all' ? 'account:' + accountId : author !== null ? 'author:' + author : 'all'
  const selectCreator = (value: string) => {
    if (value.startsWith('account:')) { onAccount(value.slice(8)); setAuthor(null) }
    else { onAccount('all'); setAuthor(value.startsWith('author:') ? value.slice(7) : null) }
  }
  const resetFilters = () => { onPlatform('all'); onAccount('all'); onReadState('all'); setAuthor(null); setQuery(''); setDelivery(null); setContentType('all'); setFiltersOpen(false) }
  const filterCount = [platform !== 'all', creatorKey !== 'all', contentType !== 'all', delivery !== defaultDelivery, initialReadState !== 'all'].filter(Boolean).length
  const filtered = filterCount > 0 || !!query
  const selectMaterial = (id: string) => { if (!deleted) setSelection({ request: initialMaterialId, scope: filterKey, id, open: true, mode: completeMode }); setFiltersOpen(false) }
  const backToList = () => { setSelection({ ...activeSelection, open: false }); requestAnimationFrame(() => section.current?.querySelector<HTMLButtonElement>('.video-card-item.selected .library-select')?.focus()) }
  const remix = (id: string) => onMaterial(id, '二创工作台')
  const creators = facets?.creators || []
  const selectedCreator = creators.find(item => item.accountId === accountId && accountId !== 'all')
  const creatorOptionKnown = creatorKey === 'all' || creators.some(item => creatorKey === (item.accountId ? 'account:' + item.accountId : 'author:' + item.author))
  const scopeLabel = creatorKey !== 'all' ? '作者：' + creatorName(author ?? (selectedCreator?.author || accounts.find(account => account.id === accountId)?.name), '已选作者')
    : platform !== 'all' ? '平台：' + platformLabel(platform) : '全部作者'
  const groups = [{ label: deleted ? '按删除时间排序' : scopeLabel + ' · 最新采集在前', rows: items }]
  const platformKeys = ['all', ...originalPlatforms.map(([key]) => key), ...Object.keys(facets?.platforms || {}).filter(key => key && !originalPlatforms.some(([value]) => value === key || value === 'bili' && key === 'bilibili'))]
  return <div className="radar-source-page"><section ref={section} className={headerStyles.collection + ' fullview-container' + (filtersOpen ? ' library-filters-open' : '') + (detailOpen && selected ? ' library-detail-open' : '')} id="view-videos" aria-labelledby="videoLibTitle">
    <div className="fullview-head">
      <div className="library-heading-group">
      <div className="library-heading"><h2 className="fullview-title" id="videoLibTitle">采集仓库</h2><p className="fullview-subtitle" id="videoLibSubtitle">{deleted ? result.data ? total : '—' : facets?.total ?? '—'} 篇{deleted ? '已删除' : delivery === 'complete' ? '已完成' : delivery === 'incomplete' ? '待完成' : '已保存'}作品</p></div>
      <div className="library-heading-status"><StudioCollectionActivity platform={platform} accountId={accountId} enabled={!deleted && author === null} onOpen={onTasks} /></div>
      </div>
      <div className="library-heading-actions" role="group" aria-label="采集仓库操作">
      {!deleted && delivery === 'incomplete' && <StudioCollectionCompleteBatch query={params.toString()} disabled={loading || !total} onChanged={onChanged} notify={notify} />}
      {!deleted && <button type="button" className="library-reset" aria-pressed={completeMode ? undefined : delivery === 'incomplete'} onClick={() => completeMode ? onTasks() : setDelivery(delivery === 'incomplete' ? 'complete' : 'incomplete')}>{completeMode ? '任务队列' : delivery === 'incomplete' ? '已完成' : '待完成'}{!completeMode && facets?.deliveryCounts ? ' ' + facets.deliveryCounts[delivery === 'incomplete' ? 'complete' : 'incomplete'] : ''}</button>}
      <button type="button" className="library-reset" aria-pressed={deleted} onClick={() => { setDeleted(value => !value); setSelection({ request: initialMaterialId, scope: filterKey, id: '', open: false, mode: completeMode }) }}>{deleted ? '返回采集仓库' : '已删除'}</button>
      <StudioCollectionRefreshButton collecting={collecting} onCollect={() => void collect()} listingOnly={listingOnly}
        listingAllowed={!deleted && accountId !== 'all' && !!listingAccount && Number.isSafeInteger(listingAccount.version)}
        onListingOnly={value => setListingChoice({ scope: listingScope, enabled: value })} />
      </div>
    </div>
    <div ref={filterBar} className="library-filter-bar" aria-label="筛选采集作品" style={deleted ? { display: 'none' } : undefined}>
      <label className="library-filter-search" htmlFor="videoSearchInput"><span className="library-filter-label">搜索作品</span><span className="library-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" id="videoSearchInput" placeholder="搜索标题或作者" autoComplete="off" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></span></label>
      <button type="button" id="libraryFilterToggle" ref={filterToggle} className="library-filter-toggle" aria-expanded={filtersOpen} aria-controls="libraryFilterOptions" onClick={() => setFiltersOpen(value => !value)}>筛选{filterCount ? ' ' + filterCount : ''}</button>
      <div id="libraryFilterOptions" className="library-filter-options">
        <label htmlFor="videoPlatTabs"><span className="library-filter-label">平台</span><select id="videoPlatTabs" value={platform === 'bilibili' ? 'bili' : platform} onChange={event => { onPlatform(event.target.value); selectCreator('all') }}>{platformKeys.map(key => <option key={key} value={key}>{key === 'all' ? '全部平台' : platformLabel(key)}</option>)}</select></label>
        <label htmlFor="videoCreatorPills"><span className="library-filter-label">作者</span><select id="videoCreatorPills" value={creatorKey} disabled={!facets} aria-busy={authorsLoading} onChange={event => selectCreator(event.target.value)}><option value="all">{!facets ? authorsLoading ? '正在读取作者…' : '作者暂不可用' : '全部作者'}</option>{!creatorOptionKnown && <option value={creatorKey}>{creatorName(author ?? accounts.find(account => account.id === accountId)?.name, '已选作者')}</option>}{creators.map(item => { const key = item.accountId ? 'account:' + item.accountId : 'author:' + item.author; return <option key={key} value={key}>{creatorName(item.author || accounts.find(account => account.id === item.accountId)?.name, '未提供')}</option> })}</select></label>
        <label htmlFor="preview-kind"><span className="library-filter-label">内容形式</span><select id="preview-kind" value={contentType} onChange={event => setContentType(event.target.value)}><option value="all">全部形式</option><option value="video">视频</option><option value="image">图文</option><option value="article">文章</option></select></label>
        {!completeMode && <label htmlFor="preview-ready"><span className="library-filter-label">采集状态</span><select id="preview-ready" value={delivery} onChange={event => setDelivery(event.target.value)}><option value="complete">已完成</option><option value="incomplete">待完成</option><option value="all">全部已保存</option></select></label>}
      </div>
    </div>
    <div className="library-workbench">
      <section className="library-main-col" aria-label="已采集作品" aria-busy={loading}>
        <div className="library-pane-head"><h3>{deleted ? '已删除' : '作品'} <small id="libraryResultCount" aria-live="polite">{studioCollectionCount(result.data ? total : null, facets?.total ?? null, !deleted && filtered)}{!deleted && initialReadState !== 'all' ? ' · ' + (initialReadState === 'unread' ? '未读' : '已读') : ''}</small></h3><button type="button" className="library-reset" id="libraryReset" hidden={!filtered || deleted} onClick={resetFilters}>清除筛选</button></div>
        <div className="video-card-list" id="videoCardList" role="region" aria-label="作品列表" tabIndex={0}>
          {schedule.error && <div className="library-read-notice" role="status"><span>采集设置读取失败，作品仍可浏览。</span><button type="button" className="btn-card-action secondary" disabled={schedule.isFetching} onClick={() => void schedule.refetch()}>重试设置</button></div>}
          {collectionFeedback.message && <div className="library-read-notice" role={collectionFeedback.error ? 'alert' : 'status'}>{collectionFeedback.message}</div>}
          <StudioLibraryAccessNotice pending={pendingSelection} error={completeMode && !!access.error && activeSelection.open} onTasks={onTasks} onRetry={() => void access.refetch()} />
          {!deleted && facetError && <div className="library-read-notice" role="alert"><span>作者与全库统计更新失败{facets ? '，保留上次结果' : ''}。</span><button type="button" className="btn-card-action secondary" disabled={facetQuery.isFetching} onClick={() => void facetQuery.refetch()}>重试统计</button></div>}
          {error && <div className="library-empty" role="alert"><h3>{items.length ? '更新失败，保留上次读取的作品' : '暂时无法读取作品'}</h3><p>{error}</p><button type="button" className="btn-card-action secondary" onClick={() => void result.refetch()}>重试</button></div>}
          {groups.filter(group => group.rows.length).map(group => <section className="video-section-group" key={group.label} aria-label={group.label}><h4 className="video-section-title">{group.label} · 本页 {group.rows.length} 篇</h4>{group.rows.map(row => <StudioCollectionCard key={row.id} row={row} selected={row.id === selected} deleted={deleted} restoring={restoring} onSelect={selectMaterial} onRestore={restore} onAdopt={setAdopting} onRemix={remix} onDelete={setDeleting} />)}</section>)}
          {!error && !items.length && <StudioCollectionEmpty loading={loading} deleted={deleted} filtered={filtered} completeMode={completeMode} />}
        </div>
        {total > pageSize && <nav className="feed-pagination" aria-label="作品分页"><span>{displayOffset + 1}–{Math.min(displayOffset + pageSize, total)} / {total}</span><button type="button" className="btn-card-action secondary" disabled={loading || !offset} onClick={() => setPagination({ scope: filterKey, offset: Math.max(0, offset - pageSize) })}>上一页</button><button type="button" className="btn-card-action secondary" disabled={loading || offset + pageSize >= total} onClick={() => setPagination({ scope: filterKey, offset: offset + pageSize })}>下一页</button></nav>}
      </section>
      <StudioCollectionDetail key={selected || 'empty'} active={detailOpen} material={current} placeholder={!!current && !detailReady} loading={detailLoading} error={detailError} excluded={selectionOpen && pendingSelection && !access.error} onTasks={onTasks} onRetry={() => void (detailAllowed ? detail.refetch() : access.refetch())} onBack={backToList} onAdopt={setAdopting} onRemix={remix} onDelete={setDeleting} onRepair={setRepairing} />
    </div>
    {adopting && <StudioAdoptDialog material={adopting} close={() => setAdopting(null)} onSaved={() => { setAdopting(null); onChanged(); notify('已采纳到选题，原始作品会保留。') }} />}
    {repairing && <StudioMaterialRecovery material={repairing} close={() => setRepairing(null)} onSaved={() => { void detail.refetch(); onChanged() }} notify={notify} />}
    {deleting && <StudioDeleteDialog kind="materials" record={deleting} close={() => setDeleting(null)} onReference={(kind, id) => { setDeleting(null); if (kind === 'topics') onTopic(id); else onDraft(id) }} onDeleted={() => { setDeleting(null); setSelection({ request: initialMaterialId, scope: filterKey, id: '', open: false, mode: completeMode }); onChanged(); notify('作品已删除，可在“已删除”中恢复。') }} />}
  </section></div>
}
