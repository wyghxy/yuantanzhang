import { studioQueryKey } from './studio-query-cache'

/** Keep pagination stable only within the same authenticated material filter. */
export function studioListPlaceholder<T>(path: string, user: string) {
  const key = studioQueryKey(path, user)
  const params = new URLSearchParams(key[3])
  params.delete('offset')
  return (data: T | undefined, previous?: { queryKey: readonly unknown[] }): T | undefined => {
    if (key[2] !== 'materials' || params.get('projection') !== 'summary' || !previous) return undefined
    const old = previous.queryKey
    if (old.length !== key.length || old[0] !== key[0] || old[1] !== user || old[2] !== key[2]) return undefined
    const oldParams = new URLSearchParams(String(old[3] || ''))
    oldParams.delete('offset'); oldParams.sort()
    return oldParams.toString() === params.toString() ? data : undefined
  }
}
