import { writingInput, type WritingDraft, type WritingInput } from '../studio-writing-model'
import { rebaseWritingInput, serializeWritingInput } from './writing-rebase'

export interface WritingSaveSnapshot {
  draft: WritingDraft | null
  input: WritingInput
  blocked: boolean
}
interface Options {
  read: () => WritingSaveSnapshot
  write: (input: WritingInput, version: number, keepalive: boolean) => Promise<WritingDraft>
  acquire: () => boolean
  release: () => void
  accept: (draft: WritingDraft, input: WritingInput) => void
  failed: (cause: unknown) => void
}
const same = (a: WritingInput, b: WritingInput) =>
  serializeWritingInput(a) === serializeWritingInput(b)

/** One accepted write at a time. A retry is allowed only after a confirmed 409. */
export function createWritingSaveController(options: Options) {
  let pending: Promise<boolean> | null = null
  const dirty = () => {
    const value = options.read()
    return !!value.draft && !same(value.input, writingInput(value.draft))
  }
  async function flush(keepalive = false): Promise<boolean> {
    if (pending) return pending
    if (!dirty()) return !options.read().blocked
    if (options.read().blocked || !options.acquire()) return false
    const work = async () => {
      try {
        // Do not hold the UI forever while the user continues typing.
        for (let turn = 0; turn < (keepalive ? 1 : 3); turn++) {
          const before = { ...options.read() }
          if (!before.draft || before.blocked) return false
          if (!dirty()) return true
          const id = before.draft.id
          const submitted = JSON.parse(JSON.stringify(before.input)) as WritingInput
          let saved: WritingDraft
          try {
            saved = await options.write(submitted, before.draft.version, keepalive)
          } catch (cause) {
            const error = cause as { status?: number; current?: WritingDraft }
            if (error?.status !== 409 || error.current?.id !== id) throw cause
            const remote = writingInput(error.current)
            const merged = rebaseWritingInput(writingInput(before.draft), submitted, remote)
            if (!merged) throw cause
            // A previously ambiguous response may already have saved this exact input.
            saved = same(merged, remote)
              ? error.current
              : await options.write(merged, error.current.version, keepalive)
          }
          const current = options.read()
          if (current.draft?.id !== id) return false
          if (
            saved.id !== id ||
            !Number.isSafeInteger(saved.version) ||
            saved.version <= before.draft.version
          )
            throw new Error('保存回执版本无效，当前输入已保留，请核对服务器状态')
          if (current.draft.version > saved.version) continue
          const input = rebaseWritingInput(submitted, current.input, writingInput(saved))
          if (!input) {
            throw Object.assign(new Error('保存期间正文又有更新，当前输入已保留，请比较后保存'), {
              status: 409,
              current: saved,
            })
          }
          options.accept(saved, input)
          if (!dirty()) return true
        }
        return false
      } catch (cause) {
        options.failed(cause)
        return false
      } finally {
        options.release()
      }
    }
    // Assign before invoking callbacks, including adapters that throw synchronously.
    pending = Promise.resolve().then(work)
    const current = pending
    try {
      return await current
    } finally {
      if (pending === current) pending = null
    }
  }
  return {
    flush,
    dirty,
    get pending() {
      return pending !== null
    },
  }
}
