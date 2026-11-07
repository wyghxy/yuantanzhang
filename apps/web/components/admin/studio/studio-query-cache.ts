'use client'
import { QueryCache, QueryClient, replaceEqualDeep } from '@tanstack/react-query'
import { keepNewerStudioDetail } from './studio-query-version'
import { studioCompletionRefresh } from './studio-completion-refresh'
import { studioResourceStaleTime } from './studio-resource-refresh'

type TaskCompletion = { status?: string; attempt?: number }
type Scope = { user: string; client: QueryClient; expired: boolean; generation: number; readers: Map<string, number>; revisions: Map<string, number>; observeTask: (id: string, task?: TaskCompletion | null) => void }
let current: Scope | undefined
export const studioAuthExpired = 'studio-auth-expired'
export const studioTaskChanged = 'studio-task-changed'
function createScope(user: string): Scope {
  const settled = new Map<string, string>()
  let refreshCompleted = () => {}
  const observeTask = (id: string, task?: TaskCompletion | null) => {
    if (current !== scope || scope.expired || !id || !task?.status) return
    if (!['succeeded', 'failed', 'blocked', 'cancelled'].includes(task.status)) { settled.delete(id); return }
    const version = `${scope.generation}:${task.status}:${task.attempt ?? 0}`
    if (settled.get(id) === version) return
    settled.set(id, version)
    if (settled.size > 100) settled.delete(settled.keys().next().value!)
    refreshCompleted()
  }
  const scope: Scope = { user, expired: false, generation: 0, readers: new Map(), revisions: new Map(), observeTask, client: new QueryClient({
    queryCache: new QueryCache({ onSuccess(data, query) {
      // A queued mutation refreshes too early. Refresh persisted results when
      // polling or an SSE-triggered summary read actually observes completion.
      if (current !== scope || scope.expired || !/^tasks\/[^/]+$/.test(String(query.queryKey[2]))) return
      observeTask(String(query.queryKey[2]).slice('tasks/'.length), (data as { task?: TaskCompletion } | null)?.task)
    } }),
    defaultOptions: {
    queries: { staleTime: 60000, gcTime: 600000, refetchOnWindowFocus: false, retry: false,
      structuralSharing: (previous, incoming) => replaceEqualDeep(previous, keepNewerStudioDetail(previous, incoming)),
    },
    mutations: { retry: false },
  } }) }
  refreshCompleted = studioCompletionRefresh(scope.client, () => current === scope && !scope.expired, entry => entry.queryKey[0] === 'studio'
    && entry.queryKey[1] === user
    && (['dashboard', 'capabilities', 'materials', 'works', 'accounts', 'topics', 'drafts'].includes(String(entry.queryKey[2]))
      || /^materials\/[^/]+$/.test(String(entry.queryKey[2])) && entry.meta?.studioReadOnlyDetail === true))
  return scope
}
/** SSE and query completion share one fence; repeated terminal timestamps never reload the page. */
export function observeStudioTaskCompletion(id: string, task?: TaskCompletion | null) { current?.observeTask(id, task) }
/** Disabled observers remain mounted. Stop their old request only after all visible and imperative readers leave. */
export function cancelStudioInactiveRead(key: readonly unknown[]) {
  const scope = current
  if (!scope || scope.user !== key[1]) return
  queueMicrotask(() => {
    if (current !== scope || scope.readers.has(JSON.stringify(key))) return
    const query = scope.client.getQueryCache().find({ queryKey: key, exact: true })
    if (query && !query.isActive()) void scope.client.cancelQueries({ queryKey: key, exact: true, type: 'inactive' })
  })
}
export function studioQueryScope(user: string): Scope {
  // Server rendering must never share a client's authenticated cache across requests.
  if (typeof window === 'undefined') return createScope(user)
  if (!current || current.user !== user) {
    current?.client.clear()
    current = createScope(user)
  }
  return current
}
export function clearStudioQueries(expired = false) {
  if (current) { current.expired = expired; current.generation++; current.client.clear() }
}
export function studioQueryKey(path: string, user = current?.user || 'anonymous') {
  const url = new URL(path.replace(/^\/api\/(?:admin|workspace)\/studio\//, ''), 'https://studio.invalid/')
  url.searchParams.sort()
  return ['studio', user, url.pathname.slice(1), url.searchParams.toString()] as const
}
/** A live reader must not share observer options or incoming bodies with an editor of the same material. */
export function studioReadOnlyDetailKey(path: string, user = current?.user || 'anonymous') {
  return [...studioQueryKey(path, user), 'read-only'] as const
}
export function studioStaleTime(path: string) {
  const resource = studioQueryKey(path)[2]
  if (/^(tasks|capabilities|collections)(\/|$)/.test(resource)) return 0
  // These are task state machines, not cached material content. A retry can
  // change failed -> loading without changing the material's content version.
  if (/^materials\/[^/]+\/(prepare|player|comments)$/.test(resource)) return 0
  return resource === 'dashboard' ? 30000 : 60000
}
export function peekStudioQuery<T>(path: string): T | undefined {
  return current?.client.getQueryData<T>(studioQueryKey(path))
}
export async function invalidateStudioQueries(path: string) {
  const [resource, id] = studioQueryKey(path)[2].split('/')
  if (resource === 'tasks' && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(studioTaskChanged, { detail: { taskId: id } }))
  const scope = current
  if (!scope) return
  const related: Record<string, string[]> = {
    'local-collector': ['dashboard', 'materials', 'works', 'accounts', 'topics'],
    schedule: ['dashboard', 'materials', 'accounts'],
    materials: ['dashboard', 'accounts', 'topics', 'drafts'],
    accounts: ['dashboard', 'materials'], topics: ['dashboard', 'drafts'],
    drafts: ['dashboard', 'topics'], ideas: ['topics', 'dashboard'],
    tasks: ['dashboard', 'materials', 'drafts', 'topics', 'accounts'],
  }
  for (const kind of [resource, ...(related[resource] || [])])
    scope.revisions.set(kind, (scope.revisions.get(kind) || 0) + 1)
  const filters = { predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) => {
    const key = query.queryKey
    if (key[0] !== 'studio' || key[1] !== scope.user) return false
    const target = String(key[2]), [kind, targetId] = target.split('/')
    return (kind === resource && (!id || !targetId || id === targetId)) || (!targetId && (related[resource] || []).includes(kind))
      || resource === 'schedule' && kind === 'accounts' && /^accounts\/[^/]+\/materials$/.test(target)
      || resource === 'tasks' && /^materials\/[^/]+$/.test(target) && query.meta?.studioReadOnlyDetail === true
  } }
  // Invalidation alone does not cancel an initial GET that has no cached data.
  // Cancel it explicitly before refetch so a pre-mutation snapshot cannot win.
  await scope.client.cancelQueries(filters)
  if (current === scope && !scope.expired) void scope.client.invalidateQueries(filters)
}
/** Imperative callers and mounted query observers share one user-scoped cache. */
export async function studioCachedRead<T>(path: string, read: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal | null): Promise<T> {
  signal?.throwIfAborted()
  const scope = current
  if (!scope || typeof window === 'undefined') return read(signal || undefined)
  if (scope.expired) throw Object.assign(new Error('登录已过期，请重新登录'), { status: 401 })
  const key = studioQueryKey(path, scope.user), hash = JSON.stringify(key)
  scope.readers.set(hash, (scope.readers.get(hash) || 0) + 1)
  const promise = scope.client.fetchQuery({ queryKey: key, staleTime: studioResourceStaleTime(path, scope.client.getQueryData(key), studioStaleTime(path)), queryFn: ({ signal: shared }) => read(shared) })
  return new Promise<T>((resolve, reject) => {
    let finished = false
    const finish = (action: () => void) => {
      if (finished) return
      finished = true; signal?.removeEventListener('abort', abort)
      const count = (scope.readers.get(hash) || 1) - 1
      if (count) scope.readers.set(hash, count); else scope.readers.delete(hash)
      action()
    }
    const abort = () => {
      finish(() => reject(signal?.reason || new DOMException('Aborted', 'AbortError')))
      queueMicrotask(() => { if (!scope.readers.has(hash)) void scope.client.cancelQueries({ queryKey: key, exact: true, type: 'inactive' }) })
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    // fetchQuery returns its raw network value even when structuralSharing kept newer data.
    promise.then(value => finish(() => resolve(keepNewerStudioDetail(scope.client.getQueryData(key), value))), error => finish(() => reject(error)))
  })
}

/** Explicit refreshes must reach the server even while a cached or older GET exists. */
export async function studioFreshRead<T>(path: string, read: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted()
  const scope = current, generation = scope?.generation
  if (!scope || typeof window === 'undefined') return read(signal)
  if (scope.expired) throw Object.assign(new Error('登录已过期，请重新登录'), { status: 401 })
  const key = studioQueryKey(path, scope.user), resource = key[2].split('/')[0]
  const revision = scope.revisions.get(resource) || 0
  const value = await read(signal)
  signal?.throwIfAborted()
  if (current !== scope || scope.expired || scope.generation !== generation)
    throw new DOMException('登录状态已变化，请重新读取', 'AbortError')
  if ((scope.revisions.get(resource) || 0) !== revision)
    throw new DOMException('内容已更新，请重新读取', 'AbortError')
  scope.client.setQueryData<T>(key, previous => keepNewerStudioDetail(previous, value))
  return keepNewerStudioDetail(scope.client.getQueryData(key), value)
}
