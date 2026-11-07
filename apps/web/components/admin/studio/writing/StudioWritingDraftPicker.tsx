'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { api, errorText, list, text, type RecordItem } from '../studio-client'
import { writingPickerTitle } from './writing-editor-model'
import { useStudioPrivacy } from '../StudioPrivacy'
import styles from './StudioWritingDraftPicker.module.css'

const MORE = '__studio_picker_more__', SEARCH = '__studio_picker_search__', RETRY = '__studio_picker_retry__'

type PickerProps = {
  id: string; title: string; mode: 'topic' | 'source' | 'draft'; entityId: string
  onSwitch?: (id: string) => void; onPick?: (kind: 'topic' | 'source', id: string) => void
}

export function StudioWritingDraftPicker(props: PickerProps) {
  return <StudioWritingDraftPickerMenu key={props.mode} {...props} />
}

function StudioWritingDraftPickerMenu({ id, title, mode, entityId, onSwitch, onPick }: PickerProps) {
  const { materialTitle } = useStudioPrivacy()
  const displayTitle = (value: unknown, fallback = '未命名作品') => mode === 'source' ? materialTitle(value, fallback) : text(value) || fallback
  const [items, setItems] = useState<RecordItem[]>([]), [error, setError] = useState('')
  const [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false)
  const loadedOnce = useRef(false), [searchVisible, setSearchVisible] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [query, setQuery] = useState(''), [search, setSearch] = useState('')
  const request = useRef<AbortController | null>(null), failed = useRef({ offset: 0, query: '' })
  const select = useRef<HTMLSelectElement>(null), panel = useRef<HTMLDivElement>(null)
  const searchOpen = useRef(false), searchId = useId()

  function cancel() {
    request.current?.abort()
    request.current = null
    setLoading(false)
  }
  async function load(offset = 0, keyword = query) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    failed.current = { offset, query: keyword }
    setLoading(true); setError('')
    try {
      const value = await api((mode === 'topic' ? 'topics' : mode === 'source' ? 'materials' : 'drafts') + '?' + new URLSearchParams({
        limit: '20', offset: String(offset), sample: 'all', projection: 'summary', ...(mode === 'source' ? { collectionView: 'library' } : {}), ...(keyword ? { q: keyword } : {}),
      }), 'GET', undefined, controller.signal)
      if (controller.signal.aborted || request.current !== controller) return false
      const next = value.hasMore ? Number(value.nextOffset) : null
      if (value.hasMore && (!Number.isSafeInteger(next) || next === null || next <= offset)) throw new Error('切换列表读取未完成，请重试')
      const rows = list(value.items)
      setItems(previous => Array.from(new Map([...(offset ? previous : []), ...rows].map(item => [item.id, item])).values()))
      setNextOffset(next); setQuery(keyword); loadedOnce.current = true; setLoaded(true)
      return true
    } catch (cause) {
      if (!controller.signal.aborted && request.current === controller) setError(errorText(cause))
      return false
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false) }
    }
  }
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])
  const value = mode === 'draft' ? id : entityId
  const label = mode === 'topic' ? '正在编辑的选题' : mode === 'source' ? '正在二创的作品' : '正在编辑的稿件'
  function showSearch() {
    cancel(); setSearch(query); searchOpen.current = true; setSearchVisible(true)
    const menu = panel.current, trigger = select.current
    if (!menu || !trigger) return
    const rect = trigger.getBoundingClientRect()
    menu.style.width = `${Math.min(Math.max(rect.width, 260), window.innerWidth - 16)}px`
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - parseFloat(menu.style.width) - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 180))}px`
    menu.showPopover()
    menu.querySelector('input')?.focus()
  }
  return <div className="cw-current-fields"><label id="cw-current-label" htmlFor={mode === 'source' ? 'cw-rewrite-select' : 'cw-topic-select'}>{label}</label><select ref={select} id={mode === 'source' ? 'cw-rewrite-select' : 'cw-topic-select'} aria-label={mode === 'topic' ? '切换创作选题' : mode === 'source' ? '切换二创作品' : '切换稿件'} aria-busy={loading} value={value} disabled={mode === 'draft' ? !onSwitch : !onPick}
    onFocus={() => { if (!loadedOnce.current && !request.current) void load(0, '') }}
    onBlur={() => { if (!searchOpen.current) cancel() }}
    onChange={event => {
      const picked = event.target.value
      event.target.value = value
      if (picked === MORE) { if (!loading && nextOffset !== null) void load(nextOffset); return }
      if (picked === RETRY) { if (!loading) void load(failed.current.offset, failed.current.query); return }
      if (picked === SEARCH) { showSearch(); return }
      cancel()
      if (mode === 'draft') onSwitch?.(picked)
      else onPick?.(mode, picked)
    }}>
    <option value={value}>{mode === 'source' ? materialTitle(items.find(item => item.id === value)?.title || title) : writingPickerTitle(mode, title, items.find(item => item.id === value)?.title)}</option>
    {items.filter(item => item.id !== value).map(item => <option key={item.id} value={item.id}>{displayTitle(item.title)}</option>)}
    {loaded && !loading && !items.length && <option disabled>没有匹配的结果</option>}
    {loading && <option disabled>正在读取切换列表…</option>}
    {error && <option value={RETRY}>读取失败，重试</option>}
    {nextOffset !== null && <option value={MORE} disabled={loading}>加载更多…</option>}
    <option value={SEARCH}>搜索{mode === 'topic' ? '选题' : mode === 'source' ? '作品' : '稿件'}…</option>
  </select>{error && !searchVisible && <small role="alert">{error}</small>}
    <div ref={panel} id={searchId} popover="auto" className={styles.search} onToggle={event => {
      const open = (event as unknown as { newState: string }).newState === 'open'
      searchOpen.current = open; setSearchVisible(open)
      if (!open) cancel()
    }}>
      <form onSubmit={event => {
        event.preventDefault()
        void load(0, search.trim()).then(success => {
          if (success) { panel.current?.hidePopover(); select.current?.focus({ preventScroll: true }) }
        })
      }}>
        <label htmlFor={`${searchId}-input`}>搜索标题或作者</label>
        <input id={`${searchId}-input`} value={search} maxLength={200} onChange={event => { cancel(); setSearch(event.target.value) }} placeholder="输入关键词；留空查看全部" />
        {error && <small role="alert">{error}</small>}
        <div><button type="button" onClick={() => panel.current?.hidePopover()}>取消</button><button type="submit" disabled={loading}>{loading ? '搜索中…' : '搜索'}</button></div>
      </form>
    </div>
  </div>
}
