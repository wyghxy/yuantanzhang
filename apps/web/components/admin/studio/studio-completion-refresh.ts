import type { Query, QueryClient } from '@tanstack/react-query'

/** Task completion is a notification, not a user mutation: never cancel an in-flight read.
 * Drain notifications per query, including a final read after the last completion. */
export function studioCompletionRefresh(client: QueryClient, current: () => boolean, matches: (query: Query) => boolean) {
  const pending = new Set<Query>(), draining = new Set<Query>()
  const valid = (query: Query) => current() && client.getQueryCache().get(query.queryHash) === query
  async function drain(query: Query) {
    try {
      while (pending.delete(query) && valid(query)) {
        // A poll may have started before the result was persisted. Let it finish,
        // then read once for all notifications received while it was in flight.
        if (query.state.fetchStatus === 'fetching') await query.promise?.catch(() => undefined)
        pending.delete(query)
        if (!valid(query)) return
        query.invalidate()
        if (query.isActive()) await client.refetchQueries({ queryKey: query.queryKey, exact: true, type: 'active' }, { cancelRefetch: false })
      }
    } finally { pending.delete(query); draining.delete(query) }
  }
  return () => {
    if (!current()) return
    for (const query of client.getQueryCache().findAll({ predicate: matches })) {
      query.invalidate()
      if (!query.isActive()) continue
      pending.add(query)
      if (!draining.has(query)) {
        draining.add(query)
        queueMicrotask(() => { void drain(query) })
      }
    }
  }
}
