import type { QueryClient } from '@tanstack/react-query'
import type { RecordItem } from './studio-client'
import { detailRecord } from './studio-detail-record'
import { studioQueryKey } from './studio-query-cache'

type Detail = { material?: RecordItem; item?: RecordItem; [key: string]: unknown }

/** A delayed PATCH or conflict refresh must not roll a newer detail back. */
export function cacheStudioReadResult(client: QueryClient, path: string, user: string, id: string, result: Detail): RecordItem {
  const received = detailRecord(result) as RecordItem | null
  if (received?.id !== id || !Number.isSafeInteger(received.version)) throw new Error('未收到阅读状态保存结果，请重试。')
  let selected = received
  client.setQueryData<Detail>(studioQueryKey(path, user), previous => {
    const cached = detailRecord(previous) as RecordItem | null
    if (cached?.id === id && Number.isSafeInteger(cached.version) && cached.version >= received.version) {
      selected = cached
      // undefined skips the cache write, preserving invalidation from the mutation.
      // Returning the same object would mark an inactive query fresh for a minute.
      return undefined
    }
    return { ...result, material: received }
  })
  return selected
}
