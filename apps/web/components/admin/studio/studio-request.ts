import { assertPersonalAction } from './personal-actions'
import { clearStudioQueries, studioAuthExpired } from './studio-query-cache'
/** Bounded UI requests. A timeout must never replay a write whose result is unknown. */
export async function studioRequest<T>(
  url: string, init: RequestInit, read: (response: Response) => Promise<T>, timeoutMs = 30000,
): Promise<T> {
  const timeout = new AbortController()
  const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal
  const timer = setTimeout(() => timeout.abort(new DOMException('请求超时', 'TimeoutError')), timeoutMs)
  try {
    signal.throwIfAborted()
    if(url.startsWith('/api/workspace/studio/')) assertPersonalAction(url.slice('/api/workspace/studio/'.length), init.method || 'GET')
    const response = await fetch(url, { ...init, signal })
    if (response.status === 401 && typeof window !== 'undefined') {
      clearStudioQueries(true)
      window.dispatchEvent(new Event(studioAuthExpired))
    }
    const value = await read(response)
    signal.throwIfAborted()
    return value
  } catch (error) {
    if (timeout.signal.aborted && !init.signal?.aborted) {
      const readonly = !init.method || ['GET', 'HEAD'].includes(init.method.toUpperCase())
      throw new Error(readonly ? '读取超时，请重试' : '暂未收到操作结果，请先刷新确认状态，避免重复提交')
    }
    throw error
  } finally { clearTimeout(timer) }
}
