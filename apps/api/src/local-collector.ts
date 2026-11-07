import { HttpException } from '@nestjs/common'
import { request, type IncomingMessage } from 'node:http'
import { create } from './records'
import { conflict, db, fail, json, obj, record, show, txt, version, type Data, type Scope } from './shared'

const maxBytes = 2 * 1024 * 1024
const invalidEndpoint = () => fail(400, 'invalid_collector_endpoint', '请输入本机 HTTP 地址；不接受凭据、查询参数或片段')
const invalidResult = () => fail(502, 'invalid_collector_result', '本机采集器须返回有效 JSON、最多 20 条含来源、标题和正文的素材')

function endpointFor(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return invalidEndpoint()
  const input = value.trim()
  if (!input) return ''
  // Check the literal authority first: URL parsers also accept shorthand, hex and integer IPv4.
  const match = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::([0-9]{1,5}))?(?:\/[^?#]*)?$/i.exec(input)
  if (!match || /[\\\s]/.test(input) || Array.from(input).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return invalidEndpoint()
  if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535)) return invalidEndpoint()
  let target: URL
  try { target = new URL(input) } catch { return invalidEndpoint() }
  if (target.hostname === 'localhost') target.hostname = '127.0.0.1'
  return target.href
}

function sourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192) return
  const raw = value.trim()
  if (!/^https?:\/\//i.test(raw) || /[\\\s]/.test(raw) || Array.from(raw).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return
  try {
    const url = new URL(raw)
    if (!url.hostname || url.username || url.password) return
    return url.href
  } catch { return }
}

async function settings(s: Scope) {
  return db.workspace.findFirstOrThrow({ where: { id: s.workspaceId, ownerId: s.ownerId }, select: { preferences: true, preferenceVersion: true } })
}

export async function collectorSettings(s: Scope, body?: Data) {
  const ws = await settings(s)
  const data = { ...obj(ws.preferences) }
  if (!body) {
    const endpoint = endpointFor(data.localCollectorEndpoint ?? '')
    return { configured: !!endpoint, endpoint, version: ws.preferenceVersion }
  }
  const expected = version(body.expectedVersion)
  if (expected !== ws.preferenceVersion) conflict()
  const endpoint = endpointFor(body.endpoint)
  if (endpoint) data.localCollectorEndpoint = endpoint
  else delete data.localCollectorEndpoint
  const changed = await db.workspace.updateMany({
    where: { id: s.workspaceId, ownerId: s.ownerId, preferenceVersion: expected },
    data: { preferences: json(data), preferenceVersion: { increment: 1 } },
  })
  if (!changed.count) conflict()
  return { configured: !!endpoint, endpoint, version: expected + 1 }
}

async function callCollector(endpoint: string, payload: Data): Promise<unknown> {
  const body = Buffer.from(JSON.stringify(payload))
  const signal = AbortSignal.timeout(12_000)
  let response: IncomingMessage | undefined
  try {
    // Direct connection to a validated loopback literal: no redirects, proxy, cookies or auth headers.
    response = await new Promise<IncomingMessage>((resolve, reject) => {
      const outbound = request(endpoint, {
        method: 'POST', agent: false, signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': body.length, 'Accept-Encoding': 'identity' },
      }, resolve)
      outbound.on('error', reject)
      outbound.end(body)
    })
    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300)
      fail(502, 'collector_response_error', '本机采集器未返回成功状态；工作台不跟随跳转')
    const type = response.headers['content-type']?.split(';')[0].trim().toLowerCase()
    if (!type || !/^application\/(?:json|[a-z0-9.+-]+\+json)$/.test(type)) invalidResult()
    const encoding = response.headers['content-encoding']
    if (encoding && encoding.toLowerCase() !== 'identity') invalidResult()
    if (Number(response.headers['content-length']) > maxBytes) invalidResult()
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of response) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > maxBytes) invalidResult()
      chunks.push(bytes)
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))) }
    catch { return invalidResult() }
  } catch (err) {
    if (signal.aborted) fail(504, 'collector_timeout', '本机采集器超时，未导入任何素材')
    if (err instanceof HttpException) throw err
    fail(502, 'collector_unavailable', '无法连接本机采集器或响应中断，未导入任何素材')
  } finally { response?.destroy() }
}

type MaterialInput = { url: string; title: string; text: string; author?: string; platform?: string }
function field(v: unknown, max: number, optional = false): string | undefined {
  if (optional && v === undefined) return
  if (typeof v !== 'string' || v.length > max || (!optional && !v.trim())) return invalidResult()
  return v
}
function parseItems(input: unknown): MaterialInput[] {
  const { items } = obj(input)
  if (!Array.isArray(items) || items.length > 20) return invalidResult()
  return items.map(raw => {
    const item = obj(raw)
    const url = sourceUrl(item.url)
    if (!url) return invalidResult()
    return { url, title: field(item.title, 500)!.trim(), text: field(item.text, 400_000)!,
      author: field(item.author, 300, true)?.trim(), platform: field(item.platform, 80, true)?.trim() }
  })
}

export async function runCollector(s: Scope, body: Data) {
  const url = sourceUrl(body.url)
  if (!url) fail(400, 'invalid_source_url', '请填写完整的 HTTP 或 HTTPS 来源链接，不含用户名和密码')
  if (body.accountId !== undefined && (typeof body.accountId !== 'string' || !body.accountId || body.accountId.length > 128))
    fail(400, 'invalid_account', '绑定账号无效')
  const accountId = typeof body.accountId === 'string' ? body.accountId : undefined
  const { endpoint } = await collectorSettings(s)
  if (!endpoint) fail(409, 'collector_not_configured', '请先设置并保存本机采集器地址')
  const forwarded: Data = { version: 1, url }
  let accountPlatform = ''
  if (accountId) {
    const account = obj((await record(db, s, 'accounts', accountId)).data)
    forwarded.account = { id: accountId, name: txt(account.name, txt(account.title)).slice(0, 300) }
    accountPlatform = txt(account.platform).slice(0, 80)
    if (accountPlatform) forwarded.platform = accountPlatform
  }
  const rows = parseItems(await callCollector(endpoint, forwarded))
  return db.$transaction(async tx => {
    // Acquire the writer lock before checking existing links, so two imports cannot insert the same source.
    const locked = await tx.$executeRaw`UPDATE "Workspace" SET "preferenceVersion" = "preferenceVersion" WHERE "id" = ${s.workspaceId} AND "ownerId" = ${s.ownerId}`
    if (!locked) fail(404, 'workspace_not_found', '当前工作区不存在')
    const ws = await tx.workspace.findFirstOrThrow({ where: { id: s.workspaceId, ownerId: s.ownerId }, select: { preferences: true } })
    if (endpointFor(obj(ws.preferences).localCollectorEndpoint ?? '') !== endpoint)
      fail(409, 'collector_changed', '本机采集设置已更改，未导入旧采集器的结果')
    if (accountId) await record(tx, s, 'accounts', accountId)
    type Links = { id: string; source: unknown; url: unknown; canonical: unknown; link: unknown }
    // Read only links: existing transcripts are not needed for duplicate detection.
    const existing = await tx.$queryRaw<Links[]>`
      SELECT id, json_extract(data, '$.sourceUrl') AS source, json_extract(data, '$.url') AS url,
        json_extract(data, '$.canonicalUrl') AS canonical, json_extract(data, '$.sourceLink') AS link
      FROM StudioRecord WHERE workspaceId = ${s.workspaceId} AND kind = 'materials'
      ORDER BY (deletedAt IS NOT NULL), createdAt, id`
    const ids = new Map<string, string>()
    for (const row of existing) for (const value of [row.source, row.url, row.canonical, row.link]) {
      const normalized = sourceUrl(value)
      if (normalized && !ids.has(normalized)) ids.set(normalized, row.id)
    }
    const items = []
    let importedCount = 0, duplicateCount = 0
    for (const row of rows) {
      const same = ids.get(row.url)
      if (same) {
        items.push(show(await record(tx, s, 'materials', same, true)))
        duplicateCount++
        continue
      }
      const item = await create(tx, s, 'materials', {
        title: row.title, text: row.text, url: row.url, sourceUrl: row.url,
        ...(row.author ? { author: row.author } : {}), ...(accountId ? { accountId } : {}),
        ...(row.platform || accountPlatform ? { platform: row.platform || accountPlatform } : {}),
      }, { source: 'local_collector', transcript: { raw: row.text, corrected: row.text, source: 'local_collector', version: 1 } })
      ids.set(row.url, item.id)
      items.push(item)
      importedCount++
    }
    return { items, importedCount, duplicateCount }
  })
}
