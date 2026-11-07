import { api, list, object, text, type RecordItem } from './studio-client'

// Imported source titles may exceed the draft limit; only bound the new copy.
function draftTitle(title: unknown) {
  if (typeof title !== 'string' || title.length <= 240) return title
  // The server counts UTF-16 units. Keep the last character whole at that boundary.
  return title.slice(0, 240).replace(/[\uD800-\uDBFF]$/, '')
}

export async function openStudioTopicDraft(topic: RecordItem, signal?: AbortSignal) {
  const data = await api(`drafts?projection=summary&limit=1&sample=all&topicId=${encodeURIComponent(topic.id)}`, 'GET', undefined, signal)
  signal?.throwIfAborted()
  const existing = list(data.items)[0]
  if (existing) return existing.id
  // Once submitted, let the one write settle. Navigation cancels the intent to
  // open its result, not the accepted write, and must never replay it.
  const created = await api('drafts', 'POST', { title: draftTitle(topic.title), topicId: topic.id })
  return text(object(created.item).id)
}

export async function openStudioMaterialDraft(id: string, signal?: AbortSignal) {
  const data = await api(`drafts?projection=summary&directOnly=1&limit=1&sample=all&materialId=${encodeURIComponent(id)}`, 'GET', undefined, signal)
  signal?.throwIfAborted()
  const existing = list(data.items).find(draft => !draft.topicId)
  if (existing) return existing.id
  const source = object((await api(`materials/${encodeURIComponent(id)}`, 'GET', undefined, signal)).item)
  signal?.throwIfAborted()
  const created = await api('drafts', 'POST', { title: draftTitle(source.title), materialId: id })
  return text(object(created.item).id)
}
