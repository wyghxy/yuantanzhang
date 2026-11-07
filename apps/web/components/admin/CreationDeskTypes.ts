export type { CreationOpportunity, CreationSource, CreationCluster, CreationProjectSummary } from '@ytz/contracts/creation-page'






export async function creationRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  let data: T & { error?: string }
  try { data = await response.json() } catch { throw new Error('服务器未返回有效响应，请重试') }
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`)
  return data
}
