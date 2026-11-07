import { useCallback, useEffect, useEffectEvent, useRef, type RefObject } from 'react'
import { originalLocation } from './original-studio-model'
import { STUDIO_FEED_DEFAULT_RANGE } from './studio-feed-query'

type HostLocation = ReturnType<typeof originalLocation> & { href: string }
type LocationCommit = (next: HostLocation, previous: HostLocation, mode: 'original' | 'editor') => void

function replaceStudioHostLocation(url: URL, preview: boolean, previousLocation: RefObject<HostLocation>, contentChanged = true) {
  window.history.replaceState(null, '', url)
  previousLocation.current = {
    ...(contentChanged ? originalLocation(url.searchParams, preview) : previousLocation.current),
    href: url.href,
  }
}

async function synchronizeStudioHostLocation(query: Pick<URLSearchParams, 'get'>, preview: boolean, previousLocation: RefObject<HostLocation>, opening: RefObject<AbortController | null>, canLeave: () => boolean | Promise<boolean>, commit: LocationCommit, active: () => boolean) {
  const next = { ...originalLocation(query, preview), href: window.location.href }
  const previous = previousLocation.current
  const changed = next.view !== previous.view || next.draft !== previous.draft || next.material !== previous.material
  if (changed && (previous.draft || previous.view === 'islands' || next.view === 'islands')) {
    const allowed = await canLeave()
    if (!active()) return
    if (!allowed) {
      if (previous.href) window.history.replaceState(null, '', previous.href)
      return
    }
    opening.current?.abort()
    const mode = query.get('writingMode') === 'editor' ? 'editor' : 'original'
    queueMicrotask(() => {
      const current = originalLocation(new URL(window.location.href).searchParams, preview)
      if (!active() || current.view !== next.view || current.draft !== next.draft || current.material !== next.material) return
      commit(next, previous, mode)
      previousLocation.current = { ...next, href: window.location.href }
    })
    return
  }
  previousLocation.current = next
}

export function useStudioHostLocation(query: Pick<URLSearchParams, 'get'>, preview: boolean, canLeave: () => boolean | Promise<boolean>, opening: RefObject<AbortController | null>, commit: LocationCommit) {
  const previousLocation = useRef({ ...originalLocation(query, preview), href: '' })
  const syncLocation = useEffectEvent((active: () => boolean) => synchronizeStudioHostLocation(query, preview, previousLocation, opening, canLeave, commit, active))
  useEffect(() => {
    let active = true
    void syncLocation(() => active)
    return () => { active = false }
  }, [query, preview])
  return useCallback((url: URL, contentChanged = true) => replaceStudioHostLocation(url, preview, previousLocation, contentChanged), [preview])
}

type HostFilters = {
  keyword: string
  platform: string
  author: string
  status: string
  sample: string
  range: string
  feedMode: string
}

export function studioHostFilterLocation(href: string, filters: HostFilters): URL {
  const url = new URL(href)
  const parameters = [
    ['q', filters.keyword, ''],
    ['platform', filters.platform, 'all'],
    ['author', filters.author, 'all'],
    ['status', filters.status, 'all'],
    ['sample', filters.sample, 'all'],
    ['range', filters.range, STUDIO_FEED_DEFAULT_RANGE],
    ['mode', filters.feedMode, 'stream'],
  ]
  for (const [key, value, defaultValue] of parameters) {
    if (value && value !== defaultValue) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  return url
}
