'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useAdminShell } from '../AdminShell'
import { apiRequest } from './studio-client'
import { cancelStudioInactiveRead, studioAuthExpired, studioQueryKey, studioReadOnlyDetailKey, studioQueryScope, studioStaleTime } from './studio-query-cache'
import { studioResourceRefreshInterval, studioReadOnlyMaterialDetail, studioResourceStaleTime } from './studio-resource-refresh'
import { studioListPlaceholder } from './studio-list-query'

export default function StudioQueryProvider({ children }: { children: ReactNode }) {
  const { userId } = useAdminShell()
  const router = useRouter()
  const scope = useMemo(() => studioQueryScope(String(userId)), [userId])
  useEffect(() => {
    const expired = () => {
      const next = window.location.pathname + window.location.search
      router.replace('/login?next=' + encodeURIComponent(next))
    }
    window.addEventListener(studioAuthExpired, expired)
    return () => window.removeEventListener(studioAuthExpired, expired)
  }, [router])
  return <QueryClientProvider client={scope.client}>{children}</QueryClientProvider>
}
export function useStudioResource(path: string, enabled = true, live = false) {
  const { userId } = useAdminShell()
  const dashboard = live && studioQueryKey(path)[2] === 'dashboard'
  const readOnlyDetail = studioReadOnlyMaterialDetail(path, live)
  const key = useMemo(() => readOnlyDetail ? studioReadOnlyDetailKey(path, String(userId)) : studioQueryKey(path, String(userId)), [path, userId, readOnlyDetail])
  const query = useQuery<Record<string, unknown>>({
    queryKey: key,
    queryFn: ({ signal }) => apiRequest(path, 'GET', undefined, signal),
    staleTime: query => studioResourceStaleTime(path, query.state.data, studioStaleTime(path)), enabled,
    placeholderData: studioListPlaceholder<Record<string, unknown>>(path, String(userId)),
    meta: { studioReadOnlyDetail: readOnlyDetail },
    refetchOnMount: readOnlyDetail ? 'always' : true,
    // Background completion refreshes summaries and explicitly read-only details, never editors.
    refetchInterval: query => enabled ? (dashboard ? 30000 : studioResourceRefreshInterval(path, query.state.data, live)) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: Boolean(dashboard || studioResourceRefreshInterval(path, undefined, live)),
  })
  useEffect(() => {
    if (!enabled) cancelStudioInactiveRead(key)
    return () => cancelStudioInactiveRead(key)
  }, [key, enabled])
  return query
}
/** Only typed search waits; page navigation and cached results never wait for a debounce. */
export function useStudioSearch(value: string) {
  const [search, setSearch] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setSearch(value), 180); return () => clearTimeout(timer) }, [value])
  return search
}
