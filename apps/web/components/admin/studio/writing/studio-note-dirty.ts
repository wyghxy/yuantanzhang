type DirtyEvent = 'studio-notes-dirty' | 'studio-excerpt-dirty'
const pending = new Map<DirtyEvent, Set<symbol>>()

/** A clean or unmounted reader must not clear another reader's pending input. */
export function materialNoteDirty(event: DirtyEvent, owner: symbol, dirty: boolean) {
  const owners = pending.get(event) || new Set<symbol>()
  if (dirty) owners.add(owner)
  else owners.delete(owner)
  pending.set(event, owners)
  window.dispatchEvent(new CustomEvent(event, { detail: owners.size > 0 }))
}
