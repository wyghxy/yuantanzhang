import type { WritingInput } from '../studio-writing-model'

const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) :
  value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, ordered(child)])) : value
const equal = (a: unknown, b: unknown) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b))

/** JSONB key order is not an edit. Arrays retain their meaningful order. */
export const serializeWritingInput = (value: WritingInput) => JSON.stringify(ordered(value))

/** Three-way merge: remote association updates must not erase local typing. */
export function rebaseWritingInput(base: WritingInput, local: WritingInput, remote: WritingInput): WritingInput | null {
  const result = { ...local }
  for (const key of ['title', 'body', 'templateKey', 'config', 'references'] as const) {
    if (equal(local[key], remote[key]) || equal(base[key], remote[key])) continue
    if (!equal(base[key], local[key])) return null
    Object.assign(result, { [key]: remote[key] })
  }
  return result
}
