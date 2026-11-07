export const STUDIO_FEED_DEFAULT_RANGE = 'all'

export function studioFeedRange(value: string | null) {
  return value && ['today', '3d', '7d', 'all'].includes(value) ? value : STUDIO_FEED_DEFAULT_RANGE
}

/** Keep relative ranges logical in the cache key. Resolve the clock on the server
 * when a request actually runs, never during a React render. */
export function studioFeedPath(filters: Record<string, string>) {
  return 'materials?' + new URLSearchParams({ range: STUDIO_FEED_DEFAULT_RANGE, ...filters, collectionView: 'library', projection: 'summary', listMode: 'feed', limit: '30' })
}
