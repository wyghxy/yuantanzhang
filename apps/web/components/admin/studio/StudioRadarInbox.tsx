'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { api, apiFresh, errorText, list, type RecordItem } from './studio-client'
import { RadarMaterial } from './StudioRadarMaterial'
import s from './StudioDashboard.module.css'

const PAGE_SIZE = 20

export default function StudioRadarInbox({ revision, unread, onMaterial, onRefresh, onNavigate }: {
  revision: string; unread: number; onMaterial: (id: string) => void; onRefresh: () => void; onNavigate: (view: string) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<RecordItem[]>([]), [total, setTotal] = useState(unread)
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false), [error, setError] = useState('')
  const [localRevision, setLocalRevision] = useState(0)
  // Offset 跟随「已从服务端取回的条数」，不受下面乐观移除影响，避免翻页错位。
  const loaded = useRef(0)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const fetchPage = useCallback(async (offset: number, append: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset),
      projection: 'summary', listMode: 'feed', sample: 'all', q: query, readState: 'unread' })
    const value = await apiFresh('materials?' + params, signal)
    const page = list(value.items), count = Number(value.total) || 0
    setItems(current => append ? [...current, ...page] : page)
    setTotal(count)
    loaded.current = offset + page.length
    setHasMore(offset + page.length < count)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true); setError('')
      loaded.current = 0
      void fetchPage(0, false, controller.signal)
        .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, revision, localRevision, fetchPage])

  // 触底预加载下一页：留 120px 提前量，滚动时不会看到空白等待。
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore) return
    let busy = false
    const observer = new IntersectionObserver(entries => {
      if (busy || !entries.some(entry => entry.isIntersecting)) return
      busy = true
      setLoadingMore(true)
      void fetchPage(loaded.current, true)
        .catch(cause => setError(errorText(cause)))
        .finally(() => { busy = false; setLoadingMore(false) })
    }, { rootMargin: '120px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, fetchPage])

  // 打开即视为已读：先把它移出待读队列并进入阅读，再落库；失败则放回并提示。
  const open = (item: RecordItem) => {
    setItems(current => current.filter(entry => entry.id !== item.id))
    setTotal(current => Math.max(0, current - 1))
    setError('')
    onMaterial(item.id)
    void api('materials/' + encodeURIComponent(item.id), 'PATCH', { expectedVersion: item.version, readState: 'read' })
      .then(() => onRefresh())
      .catch(cause => {
        setItems(current => [item, ...current])
        setTotal(current => current + 1)
        setError(errorText(cause))
      })
  }

  return <section className="panel recent" aria-labelledby="recent-title">
    <header className="panel-heading">
      <div><h2 id="recent-title">待阅读作品</h2><p id="recent-caption">{total} 条待读</p></div>
      <div className="recent-actions">
        <label className="reading-search"><Search className="icon" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索待读作品" aria-label="搜索待阅读作品" /></label>
        <button className="text-link" onClick={() => onNavigate('works')}>查看全部<ArrowRight className="icon" /></button>
      </div>
    </header>
    {error && <div className={s.inlineError} role="alert">{error}<button onClick={() => setLocalRevision(value => value + 1)}>重试</button></div>}
    <div id="recent-list" className="panel-scroll-body" role="region" aria-label="待阅读作品" tabIndex={0} aria-busy={loading}>
      {items.length ? items.map(item => <RadarMaterial key={item.id} item={item} onOpen={() => open(item)} />)
        : <p className={s.empty}>{loading ? '正在读取作品…' : query ? '没有找到匹配的作品。' : '当前没有待读作品。'}</p>}
      <div ref={sentinel} className="load-more-sentinel" aria-hidden="true" />
      {loadingMore && <p className={s.muted}>正在载入更多…</p>}
    </div>
  </section>
}
