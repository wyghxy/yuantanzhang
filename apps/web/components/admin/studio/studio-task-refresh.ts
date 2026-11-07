type Clock = { schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void }

/** Coalesce SSE bursts without adding a permanent polling loop or overlapping reads. */
export function studioTaskRefreshScheduler({ refresh, onError, delay = 2000, clock = {
  schedule: (callback, milliseconds) => setTimeout(callback, milliseconds),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
} }: { refresh: () => Promise<void>; onError: (error: unknown) => void; delay?: number; clock?: Clock }) {
  let timer: unknown = null, running = false, requested = false, disposed = false
  function arm() {
    if (disposed || running || timer !== null || !requested) return
    timer = clock.schedule(() => { timer = null; void run() }, delay)
  }
  async function run() {
    if (disposed || running || !requested) return
    requested = false; running = true
    try { await refresh() } catch (error) { if (!disposed) onError(error) }
    finally { running = false; arm() }
  }
  return {
    request() { if (!disposed) { requested = true; arm() } },
    dispose() { disposed = true; requested = false; if (timer !== null) clock.cancel(timer); timer = null },
  }
}
