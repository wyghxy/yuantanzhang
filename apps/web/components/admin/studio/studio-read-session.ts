import type { RecordItem } from './studio-client'

export type ReadState = 'read' | 'unread'
type Save = (item: RecordItem, state: ReadState) => Promise<RecordItem>
type Snapshot = { pending: boolean; saved?: RecordItem; error: string; retryState?: ReadState }

/** One opened reader, not one render. Manual unread wins until the reader is reopened. */
export class StudioReadSession {
  private attempted = false
  private snapshot: Snapshot = { pending: false, error: '' }
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  private update(value: Snapshot) { this.snapshot = value; this.listeners.forEach(listener => listener()) }
  current(item: RecordItem) { return this.snapshot.saved && this.snapshot.saved.version >= item.version ? this.snapshot.saved : item }
  async opened(item: RecordItem, eligible: boolean, save: Save) {
    if (!eligible || this.attempted) return
    this.attempted = true
    if (this.current(item).readState !== 'read') await this.change(item, 'read', save)
  }
  async change(item: RecordItem, state: ReadState, save: Save) {
    if (this.snapshot.pending) return
    this.attempted = true
    const current = this.current(item)
    this.update({ ...this.snapshot, pending: true, error: '', retryState: undefined })
    try { this.update({ pending: false, error: '', saved: await save(current, state) }) }
    catch (cause) { this.update({ ...this.snapshot, pending: false, error: cause instanceof Error ? cause.message : '阅读状态保存失败', retryState: state }) }
  }
}
