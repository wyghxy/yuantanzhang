/** Only opt-in read-only material details may poll full bodies; editors keep their own dirty-state guard. */
export function studioReadOnlyMaterialDetail(path: string, live = false) {
  return live && /^materials\/[^/]+$/.test(path.split('?')[0])
}
/** Returning to a list must recheck cached work in progress, even within its normal cache lifetime. */
export function studioResourceStaleTime(path: string, data: unknown, settledTime: number) {
  const [resource, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  if (params.get('projection') !== 'summary' || !['accounts', 'materials'].includes(resource)
    || ['picker', 'counts', 'facets'].includes(params.get('view') || '')) return settledTime
  const rows = (data as { items?: { collection?: { status?: string } }[] } | undefined)?.items
  return rows?.some(row => ['running', 'queued'].includes(row.collection?.status || '')) ? 0 : settledTime
}
/** Reading never starts provider calls. */
export function studioResourceRefreshInterval(path: string, data: unknown, live = false): number | false {
  const [resource, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  if (['picker', 'counts', 'facets'].includes(params.get('view') || '')) return false
  const summary = params.get('projection') === 'summary'
  if (!(summary && ['accounts', 'materials'].includes(resource)) && !/^accounts\/[^/]+$/.test(resource)
    && !studioReadOnlyMaterialDetail(path, live)) return false
  const result = data as { items?: { collection?: { status?: string } }[]; item?: { collection?: { status?: string } } } | undefined
  const rows = result?.items || (result?.item ? [result.item] : [])
  return rows.some(row => row.collection?.status === 'running') ? (resource === 'accounts' || /^accounts\//.test(resource) ? 3000 : 10000)
    : rows.some(row => row.collection?.status === 'queued') && (resource === 'accounts' || /^accounts\//.test(resource)) ? 3000
    : studioReadOnlyMaterialDetail(path, live) ? false : 60000
}
