'use client'

export default function StudioCollectionRefreshButton({ collecting, onCollect, listingOnly = false, listingAllowed = false, onListingOnly }: {
  collecting: boolean; onCollect: () => void; listingOnly?: boolean; listingAllowed?: boolean; onListingOnly?: (value: boolean) => void
}) {
  return <>{onListingOnly && <button type="button" className="library-reset" aria-pressed={listingOnly}
    disabled={collecting || !listingAllowed} title={listingAllowed ? '只续查此博主当前剩余的一页列表，不改变自动计划' : '请先选择一个已关注博主'}
    onClick={() => onListingOnly(!listingOnly)}>{listingOnly ? '仅本次查列表 · 只读取账号作品列表' : '仅本次查列表'}</button>}
    <button type="button" className="library-refresh" title={listingOnly ? '续查当前博主剩余的一页列表' : '检查当前筛选范围内已关注博主的最新作品'} disabled={collecting} onClick={onCollect}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.8-1L20 9M4 15l2.1 3A7 7 0 0 0 17.9 17" /></svg>{collecting ? '处理中…' : listingOnly ? '续查本页' : '立即采集'}</button></>
}
