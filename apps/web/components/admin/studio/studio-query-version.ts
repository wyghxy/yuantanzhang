import { detailRecord } from './studio-detail-record'
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Details from older in-flight reads cannot replace an already saved version. */
export function keepNewerStudioDetail<T>(previous: unknown, incoming: T): T {
  const cached = record(detailRecord(previous)), received = record(detailRecord(incoming))
  if (typeof cached.id === 'string' && cached.id === received.id &&
      typeof cached.version === 'number' && Number.isSafeInteger(cached.version) &&
      typeof received.version === 'number' && Number.isSafeInteger(received.version) && cached.version > received.version)
    return previous as T
  return incoming
}
