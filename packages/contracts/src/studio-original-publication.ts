type Data = Record<string, unknown>
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const names = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(item => text(item, 200)).filter(Boolean))].slice(0, 50) : []
const publicationTopics = (title: string, description: string) => {
  // Read the publisher's literal hashtags; never generate topics or use editable library fields.
  const source = (title + '\n' + description).replace(/https?:\/\/\S+/gu, '')
  return [...source.matchAll(/[#＃]([\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*(?:\.[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*)*)/gu)].map(match => match[1])
}

/** Original publication facts are distinct from editable library metadata and AI suggestions. */
export function originalPublication(value: unknown, sourceRef?: unknown) {
  const input = object(value)
  if (input.provenance !== 'provider_metadata' || !text(input.sourceRef, 300) ||
      (typeof sourceRef === 'string' && sourceRef && input.sourceRef !== sourceRef)) return null
  const title = text(input.title, 2000), description = text(input.description, 20000)
  return { sourceRef: text(input.sourceRef, 300), platform: text(input.platform, 40), provenance: 'provider_metadata' as const,
    title, description, topics: names([...names(input.topics), ...publicationTopics(title, description)]), tags: names(input.tags) }
}

/** A sparse list response must not erase facts acquired from the work detail. */
export function mergeOriginalPublication(previous: unknown, incoming: unknown, sourceRef?: unknown) {
  const old = originalPublication(previous, sourceRef), next = originalPublication(incoming, sourceRef)
  if (!next) return old
  if (!old || old.sourceRef !== next.sourceRef || old.platform !== next.platform) return next
  return { ...next, title: next.title || old.title, description: next.description || old.description,
    topics: next.topics.length ? next.topics : old.topics, tags: next.tags.length ? next.tags : old.tags }
}
