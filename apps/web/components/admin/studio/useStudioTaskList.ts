'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAdminShell } from '../AdminShell'
import { apiRequest, list, type RecordData } from './studio-client'
import { cancelStudioInactiveRead, studioQueryKey } from './studio-query-cache'
import { studioTasksRefreshDelay } from './studio-task-display'

/** One visible summary observer owns both rows and total; reads never resolve or hide tasks locally. */
export function useStudioTaskList(offset: number, status: string, active: boolean) {
  const { userId } = useAdminShell()
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const changed = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  const path = `tasks?projection=summary&userTasks=true&limit=30&offset=${offset}${status ? '&status=' + status : ''}`
  const key = useMemo(() => studioQueryKey(path, String(userId)), [path, userId])
  const enabled = active && visible
  const query = useQuery<RecordData>({
    queryKey: key,
    queryFn: ({ signal }) => apiRequest(path, 'GET', undefined, signal),
    enabled,
    staleTime: 0,
    // Attention contains only stopped tasks and can become empty, but backend recovery still changes it.
    // Preserve the existing longer wait for scheduled tasks in other filters.
    refetchInterval: state => enabled
      ? status === 'attention' ? 10000 : studioTasksRefreshDelay(list(state.state.data?.items)) || 10000
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    if (!enabled) cancelStudioInactiveRead(key)
    return () => cancelStudioInactiveRead(key)
  }, [key, enabled])
  const { refetch } = query
  const refresh = useCallback(() => {
    // Mutations already invalidate this query. Join that read instead of cancelling and starting another.
    if (enabled && !document.hidden) void refetch({ cancelRefetch: false })
  }, [enabled, refetch])
  return { ...query, refresh }
}
