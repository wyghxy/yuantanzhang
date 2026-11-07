'use client'
import { assertPersonalAction } from './personal-actions'
import { studioRequest } from './studio-request'
import { invalidateStudioQueries, studioCachedRead, studioFreshRead } from './studio-query-cache'
export type RecordData = Record<string, unknown>
export type RecordItem = RecordData & { id: string; version: number; createdAt?: string; updatedAt?: string }
export const object = (v: unknown): RecordData => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordData : {}
export const text = (v: unknown, fallback = ''): string => typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback
export const list = (v: unknown): RecordItem[] => Array.isArray(v) ? v as RecordItem[] : []
export const platforms: Record<string, string> = { douyin:'抖音', bili:'B站', bilibili:'B站', xiaohongshu:'小红书', youtube:'YouTube', tiktok:'TikTok', wechat_official:'公众号', wechat_channels:'视频号', kuaishou:'快手', local:'本地素材' }
export const statusNames: Record<string, string> = { queued:'排队中',running:'处理中',succeeded:'已完成',failed:'失败',blocked:'需配置或人工处理',cancelled:'已停止',ready:'可研读',pending:'待处理',draft:'草稿',finalized:'已定稿',archived:'已归档',idea:'灵感',adopted:'已采纳',writing:'写作中',published:'已发布' }
export class StudioClientError extends Error { constructor(message: string, public status: number, public data: RecordData) { super(message) } }
export async function api(path: string, method = 'GET', body?: RecordData, signal?: AbortSignal): Promise<RecordData> {
  if (method.toUpperCase() === 'GET') return studioCachedRead(path, shared => apiRequest(path, method, body, shared), signal)
  const result = await apiRequest(path, method, body, signal)
  await invalidateStudioQueries(path)
  return result
}
export function apiFresh(path: string, signal?: AbortSignal): Promise<RecordData> {
  return studioFreshRead(path, fresh => apiRequest(path, 'GET', undefined, fresh), signal)
}
export async function apiRequest(path: string, method = 'GET', body?: RecordData, signal?: AbortSignal): Promise<RecordData> {
  const resource=path.split('?')[0]
  if(method.toUpperCase()==='GET' && resource==='capabilities')return { platforms:[], model:null,asr:null,media:null,storage:null }
  if(method.toUpperCase()==='GET' && resource==='dispatch'){
    const accounts=await api('accounts?projection=summary&limit=200&sample=all', 'GET', undefined,signal)
    return {platforms:Object.keys(platforms).filter(p=>p!=='local'&&p!=='bilibili').map(platform=>({platform,accountCount:list(accounts.items).filter(a=>a.platform===platform).length,status:'未接入',mode:'local'}))}
  }
  if(method.toUpperCase()==='GET' && resource==='schedule')return {enabled:false,version:1,accounts:[],completeCollection:true}
  if(method.toUpperCase()!=='GET' && resource==='schedule')throw new Error('当前版本未接入此项外部处理能力。')
  assertPersonalAction(path, method, body)
  signal?.throwIfAborted()
  const prefix = '/api/workspace/studio/'
  return studioRequest(prefix + path, { method, signal, cache:'no-store', ...(body ? { headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : {}) }, async response => {
    const data = await response.json() as RecordData
    if (!response.ok) throw new StudioClientError(text(data.error,`请求未完成（${response.status}）`), response.status, data)
    return data
  })
}
export const errorText = (e: unknown) => e instanceof Error ? e.message : '操作未完成，请重试'
export const dateLabel = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}) : '日期未知'
export const isSample = (v: RecordData) => v.sample === true || v.isSample === true || v.source === 'sample'
export const transcriptSourceLabel = (value: unknown) => ({manual:'人工输入',user_text:'人工输入',knowledge_snapshot:'知识库快照',platform_subtitles:'平台字幕',subtitle:'平台字幕',asr:'语音转写'}[text(value)] || text(value,'等待原文'))
export async function downloadStudio(path: string, name: string) {
  const blob = await studioRequest('/api/workspace/studio/' + path, {}, async response => {
    if (!response.ok) { const value = await response.json().catch(() => ({})); throw new Error(value.error || '下载失败') }
    return response.blob()
  })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000)
}
