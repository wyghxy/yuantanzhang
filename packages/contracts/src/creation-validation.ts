import { HttpError } from './http-error'

export type ScriptStatement = { text: string; sourceItemIds: number[] }
export interface MasterScriptInput {
  title: string; body: string; facts: ScriptStatement[]; inferences: ScriptStatement[]
  disputes: ScriptStatement[]; timelinessRisk: string | null
}
export const PROJECT_STATUSES = ['opportunity', 'master_script', 'producing', 'ready_to_publish', 'published', 'reviewed', 'archived', 'abandoned'] as const

export function requiredText(value: unknown, label: string, max: number, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `${label}须为 ${min}–${max} 字`)
  }
  return value.trim()
}

export function optionalText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.trim().length > max) throw new HttpError(400, `${label}须为不超过 ${max} 字的文本`)
  return value.trim() || null
}

export function parseStatements(value: unknown, label: string, requireSources = false): ScriptStatement[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, `${label}须为不超过 100 条的列表`)
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new HttpError(400, `${label}第 ${index + 1} 条格式无效`)
    const item = entry as Record<string, unknown>
    const text = requiredText(item.text, `${label}第 ${index + 1} 条`, 3000)
    if (!Array.isArray(item.sourceItemIds) || item.sourceItemIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new HttpError(400, `${label}第 ${index + 1} 条来源 ID 无效`)
    }
    const sourceItemIds = [...new Set(item.sourceItemIds as number[])]
    if (sourceItemIds.length > 30 || (requireSources && sourceItemIds.length === 0)) throw new HttpError(400, `${label}每条须关联 ${requireSources ? '1' : '0'}–30 个来源`)
    return { text, sourceItemIds }
  })
}

export function parseMasterScript(input: Record<string, unknown>): MasterScriptInput {
  return {
    title: requiredText(input.title, '母稿标题', 240),
    body: requiredText(input.body, '母稿正文', 20000, 50),
    facts: parseStatements(input.facts, '事实', true),
    inferences: parseStatements(input.inferences, '推断'),
    disputes: parseStatements(input.disputes, '争议'),
    timelinessRisk: optionalText(input.timelinessRisk, '时效风险', 3000),
  }
}

export function parseExpectedVersion(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HttpError(400, 'expectedVersion 须为非负整数')
  return value
}

export function collectSourceIds(script: Pick<MasterScriptInput, 'facts' | 'inferences' | 'disputes'>) {
  return [...new Set([...script.facts, ...script.inferences, ...script.disputes].flatMap((item) => item.sourceItemIds))]
}

export function assertScriptSources(script: Pick<MasterScriptInput, 'facts' | 'inferences' | 'disputes'>, sources: { id: number; workspaceId: number; status: string }[], workspaceId: number, confirming = false) {
  const lookup = new Map(sources.filter((source) => source.workspaceId === workspaceId).map((source) => [source.id, source]))
  for (const id of collectSourceIds(script)) if (!lookup.has(id)) throw new HttpError(404, `来源 #${id} 不存在于当前工作空间`)
  if (confirming && script.facts.length === 0) throw new HttpError(409, '人工确认前请至少填写一条有来源的事实')
  for (const fact of script.facts) {
    if (!fact.sourceItemIds.length || fact.sourceItemIds.some((id) => lookup.get(id)?.status !== 'verified')) {
      throw new HttpError(409, '事实只能引用当前仍为已核实状态的来源')
    }
  }
}

export function parseProjectPatch(input: Record<string, unknown>) {
  const patch: { title?: string; status?: string; notes?: string | null; finalVideoUrl?: string | null; dueAt?: Date | null } = {}
  if ('title' in input) patch.title = requiredText(input.title, '项目标题', 240)
  if ('status' in input) {
    if (typeof input.status !== 'string' || !PROJECT_STATUSES.some((status) => status === input.status)) throw new HttpError(400, '制作状态无效')
    patch.status = input.status
  }
  if ('notes' in input) patch.notes = optionalText(input.notes, '素材与制作说明', 20000)
  if ('finalVideoUrl' in input) {
    patch.finalVideoUrl = optionalText(input.finalVideoUrl, '成片链接', 2048)
    if (patch.finalVideoUrl) {
      let url: URL
      try { url = new URL(patch.finalVideoUrl) } catch { throw new HttpError(400, '成片链接须为有效的 HTTP(S) 地址') }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new HttpError(400, '成片链接须为不含账号密码的 HTTP(S) 地址')
    }
  }
  if ('dueAt' in input) {
    if (input.dueAt === null || input.dueAt === '') patch.dueAt = null
    else {
      if (typeof input.dueAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.dueAt)) throw new HttpError(400, '截止时间须为含时区的 ISO 时间')
      const date = new Date(input.dueAt)
      const day = input.dueAt.slice(0, 10)
      if (!Number.isFinite(date.getTime()) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new HttpError(400, '截止时间无效')
      patch.dueAt = date
    }
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, '请提供需要更新的项目字段')
  return patch
}
