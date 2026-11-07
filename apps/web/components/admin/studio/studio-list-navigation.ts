export type StudioCollectionEntry = { kind: 'all' } | { kind: 'account' | 'platform'; value: string }
export function studioCollectionEntry(entry: StudioCollectionEntry) {
  return { platform: entry.kind === 'platform' ? entry.value : 'all', accountId: entry.kind === 'account' ? entry.value : 'all' }
}

export type StudioListPage = { scope: string; offset: number }
/** A page belongs to its exact filters; shrinking results also move to a valid page. */
export function studioListPage(page: StudioListPage, scope: string, pageSize: number, total?: number | null): StudioListPage {
  if (page.scope !== scope) return { scope, offset: 0 }
  if (total != null) {
    const last = Math.max(0, Math.ceil(total / pageSize) * pageSize - pageSize)
    if (page.offset > last) return { scope, offset: last }
  }
  return page
}

export function studioCollectionCount(total: number | null, all: number | null, filtered: boolean) {
  if (total === null) return '正在读取'
  return filtered ? `筛选 ${total} 篇` + (all === null ? '' : ` · 全库 ${all} 篇`) : `共 ${total} 篇`
}
