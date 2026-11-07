import type { CatalogSelectionInput, CatalogSelectionSourceType, CatalogSelectionState } from '@ytz/contracts/knowledge-catalog'
import { studioRequest } from './studio-request'

export type SelectionRequest = (method: 'GET' | 'POST' | 'DELETE', input?: CatalogSelectionInput, signal?: AbortSignal) => Promise<CatalogSelectionState>
export type SelectionSnapshot = {
  state: CatalogSelectionState | null
  pending: 'load' | 'save' | null
  fresh: boolean
  error: string
  notice: string
  retrySelected?: boolean
}

export function canUseKnowledgeSelection(role: string, features: readonly string[]) {
  void role
  return ['knowledge', 'studio', 'reading', 'review', 'goals'].every(feature => features.includes(feature))
}

export function selectionRequest(sourceType: CatalogSelectionSourceType, sourceId: string, request: typeof studioRequest = studioRequest): SelectionRequest {
  return async (method, input, signal) => {
    return request(`/api/workspace/knowledge/catalog/selection/${sourceType}/${encodeURIComponent(sourceId)}`, {
      method, signal, cache: 'no-store', ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {}),
    }, async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || `沉淀请求未完成（${response.status}）`)
      if (data.sourceType !== sourceType || data.sourceId !== sourceId || typeof data.selected !== 'boolean'
        || typeof data.sourceVersion !== 'string' || !data.sourceVersion || !Number.isSafeInteger(data.selectionVersion) || data.selectionVersion < 0)
        throw new Error('沉淀状态与当前来源不一致，请重新读取。')
      return data as CatalogSelectionState
    })
  }
}

const message = (cause: unknown) => cause instanceof Error ? cause.message : '沉淀请求未完成，请重试。'

/** Scoped to one source and owner. Reads never select; only an explicit change can write. */
export class StudioKnowledgeSelection {
  private snapshot: SelectionSnapshot = { state: null, pending: null, fresh: false, error: '', notice: '' }
  private listeners = new Set<() => void>()
  private generation = 0
  private controller?: AbortController
  private refreshQueued = false
  constructor(private request: SelectionRequest) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.snapshot
  private update(value: SelectionSnapshot) { this.snapshot = value; this.listeners.forEach(listener => listener()) }
  cancel() {
    this.generation++; this.controller?.abort(); this.refreshQueued = false
    this.update({ ...this.snapshot, pending: null, fresh: false })
  }
  async load() {
    if (this.snapshot.pending === 'save') { this.refreshQueued = true; return }
    this.controller?.abort()
    const generation = ++this.generation, controller = this.controller = new AbortController()
    this.update({ ...this.snapshot, pending: 'load', fresh: false })
    try {
      const state = await this.request('GET', undefined, controller.signal)
      if (generation === this.generation) this.update({ ...this.snapshot, state, pending: null, fresh: true, error: '', retrySelected: undefined })
    } catch (cause) {
      if (generation === this.generation) this.update({ ...this.snapshot, pending: null, fresh: false, error: message(cause) })
    }
  }
  async change(selected: boolean) {
    if (this.snapshot.pending || !this.snapshot.fresh || !this.snapshot.state) return
    const previous = this.snapshot.state, generation = ++this.generation
    const controller = this.controller = new AbortController()
    this.update({ ...this.snapshot, pending: 'save', error: '', notice: '', retrySelected: undefined })
    try {
      const state = await this.request(selected ? 'POST' : 'DELETE', {
        expectedSourceVersion: previous.sourceVersion, expectedSelectionVersion: previous.selectionVersion,
      }, controller.signal)
      if (state.selected !== selected) throw new Error('服务器返回的沉淀状态与操作不一致。')
      if (generation === this.generation) this.update({ state, pending: null, fresh: true, error: '', notice: selected ? '已沉淀到知识星球。' : '已移出知识星球，原内容仍保留。' })
    } catch (cause) {
      if (generation !== this.generation) return
      // A lost response may already have committed. Reconcile with a read, never an automatic second write.
      try {
        const state = await this.request('GET', undefined, controller.signal)
        if (generation !== this.generation) return
        this.update({ state, pending: null, fresh: true, error: state.selected === selected ? '' : message(cause),
          notice: state.selected === selected ? '已确认服务器保存的沉淀状态。' : '', retrySelected: state.selected === selected ? undefined : selected })
      } catch (readCause) {
        if (generation === this.generation) this.update({ ...this.snapshot, pending: null, fresh: false,
          error: `${message(cause)} 尚未确认保存结果：${message(readCause)} 请先重新读取状态。`, retrySelected: selected })
      }
    } finally {
      if (generation === this.generation && this.refreshQueued) {
        this.refreshQueued = false
        // Failed writes already read back the latest state; keep their retry explanation visible.
        if (!this.snapshot.error) await this.load()
      }
    }
  }
}
