/** One reading document has one active excerpt surface. Draft buffers stay in
 * their own hooks; changing ownership never moves anchors or thoughts. */
export const emptyExcerptOwner = { enabled: false, owner: null as symbol | null }
export function createTranscriptExcerptOwner() {
  let snapshot = emptyExcerptOwner
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    isCurrent: (value: typeof snapshot, owner: symbol) => snapshot === value && snapshot.owner === owner,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener); if (!listeners.size) snapshot = emptyExcerptOwner }
    },
    activate: (owner: symbol, revealCheckboxes = false, renew = false) => {
      const enabled = snapshot.enabled || revealCheckboxes
      if (!renew && snapshot.enabled === enabled && snapshot.owner === owner) return
      snapshot = { enabled, owner }
      for (const listener of listeners) listener()
    },
    close: () => {
      if (!snapshot.enabled && snapshot.owner === null) return
      snapshot = emptyExcerptOwner
      for (const listener of listeners) listener()
    },
  }
}
const documents = new WeakMap<Document, ReturnType<typeof createTranscriptExcerptOwner>>()
const server = createTranscriptExcerptOwner()
export function transcriptExcerptOwner() {
  if (typeof document === 'undefined') return server
  let value = documents.get(document)
  if (!value) { value = createTranscriptExcerptOwner(); documents.set(document, value) }
  return value
}
