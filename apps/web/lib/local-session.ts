let opening: Promise<void> | undefined

export function usesLocalSession() {
  return typeof document !== 'undefined' && document.documentElement.dataset.personalAuthMode === 'local'
}
export async function openLocalSession() {
  if (!usesLocalSession()) throw new Error('请使用已启用的个人访问方式。')
  if (!opening) {
    opening = fetch('/api/auth/local', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(15_000),
    }).then(async response => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '暂时无法打开本机工作台，请确认本地服务已经启动。')
      }
      const session = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (!session.ok) throw new Error('浏览器未保留本机会话，请允许当前站点保存数据后重试。')
    }).finally(() => { opening = undefined })
  }
  return opening
}
/** Only an explicit authentication rejection can replay a request; timeouts never retry writes. */
export async function personalFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init)
  if (response.status !== 401 || !url.startsWith('/api/workspace/') || !usesLocalSession()) return response
  await openLocalSession()
  init.signal?.throwIfAborted()
  return fetch(url, init)
}
