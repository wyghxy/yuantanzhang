import { personalFetch } from './local-session'

export class CreationRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'CreationRequestError' }
}

export async function creationRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await personalFetch(url, { cache: 'no-store', ...options })
  let result: unknown
  try { result = await response.json() } catch { throw new CreationRequestError('服务器未返回有效数据，请稍后重试', response.status) }
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : '操作失败，请稍后重试'
    throw new CreationRequestError(message, response.status)
  }
  return result as T
}

export const creationJson = (body: unknown): RequestInit => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
