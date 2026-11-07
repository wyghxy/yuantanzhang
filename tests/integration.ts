import 'dotenv/config'
import assert from 'node:assert/strict'
import { personalDatabase } from '../prisma/sqlite-runtime.cjs'
import { assertLoopbackApi, assertPersonalSqlite, deleteOwnFixtures } from './demo-cleanup.integration'
import { mkdir, writeFile } from 'node:fs/promises'

const origin = process.env.API_ORIGIN || 'http://127.0.0.1:3311'
const db = personalDatabase()
let cookie = '', workspaceId = ''
const assetIds: string[] = []
const checks: string[] = []
type Data = Record<string, unknown>
const object = (v: unknown) => v as Data
const createdRecords: Array<{ kind: string; id: string }> = []
async function call(path: string, method = 'GET', body?: Data, authenticated = true) {
  const response = await fetch(origin + path, { method, headers: {
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(authenticated && cookie ? { cookie } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json() as Data
  return { response, data }
}
const api = (path: string, method = 'GET', body?: Data) => call('/api/workspace/studio/' + path, method, body)

async function main() {
assertLoopbackApi(origin)
await assertPersonalSqlite(db)
checks.push('Prisma opened the intended local SQLite file')
assert.equal((await call('/api/workspace/studio/accounts', 'GET', undefined, false)).response.status, 401)
checks.push('unauthenticated data request rejected')
assert.equal((await call('/api/auth/login', 'POST', { username: process.env.PERSONAL_USERNAME, password: 'invalid-password' }, false)).response.status, 401)
const login = await call('/api/auth/login', 'POST', { username: process.env.PERSONAL_USERNAME, password: process.env.PERSONAL_PASSWORD }, false)
assert.equal(login.response.status, 200)
workspaceId = String(object(login.data.workspace).id)
assert.ok(await db.workspace.findUnique({ where: { id: workspaceId } }), 'HTTP 会话与测试必须连接相同的工作区')
const setCookie = login.response.headers.get('set-cookie') || ''
assert.match(setCookie, /HttpOnly/i)
assert.match(setCookie, /SameSite=Strict/i)
cookie = setCookie.split(';')[0]
assert.ok(cookie)
checks.push('personal login and protected session')
const accounts = await api('accounts?sample=all&limit=100')
assert.equal(accounts.response.status, 200)
assert.ok(Array.isArray(accounts.data.items))
assert.ok((accounts.data.items as Data[]).some(item => item.sample === true))
checks.push('clearly marked sample records present')
const account = await api('accounts', 'POST', { name: '集成验证账号', platform: 'local', note: '本地验证', autoResolve: false })
assert.equal(account.response.status, 201)
const accountItem = object(account.data.item)
assert.ok(accountItem.id)
createdRecords.push({ kind: 'accounts', id: String(accountItem.id) })
const material = await api('materials', 'POST', { title: '集成验证正文', platform: 'local', text: '这是本地手工收录的原文。', accountId: accountItem.id, autoProcess: false })
assert.equal(material.response.status, 201)
const materialItem = object(material.data.item)
assert.ok(materialItem.id)
createdRecords.push({ kind: 'materials', id: String(materialItem.id) })
const saved = await api(`materials/${materialItem.id}`, 'PATCH', { title: '已保存的验证正文', expectedVersion: materialItem.version })
assert.equal(saved.response.status, 200)
const updated = object(saved.data.item)
assert.equal(updated.title, '已保存的验证正文')
assert.equal(Number(updated.version), Number(materialItem.version) + 1)
const stale = await api(`materials/${materialItem.id}`, 'PATCH', { title: '不得覆盖', expectedVersion: materialItem.version })
assert.equal(stale.response.status, 409)
assert.equal(object((await api(`materials/${materialItem.id}`)).data.item).title, '已保存的验证正文')
checks.push('local import, association, durable save and version conflict')
const draft = await api('drafts', 'POST', { title: '验证草稿', materialId: materialItem.id })
assert.equal(draft.response.status, 201)
const draftItem = object(draft.data.item)
assert.ok(draftItem.id)
createdRecords.push({ kind: 'drafts', id: String(draftItem.id) })
const tasks = await api('tasks?status=active')
assert.equal(tasks.response.status, 200)
assert.ok(!(tasks.data.items as Data[]).some(task => createdRecords.some(row => row.id === task.targetId)))
checks.push('creating local records does not enqueue online processing')
assert.equal((await api('materials/missing-record')).response.status, 404)
const invalidReference = await api('materials', 'POST', { title: '错误引用', platform: 'local', accountId: '00000000-0000-4000-8000-000000000001', autoProcess: false })
assert.equal(invalidReference.response.status, 400, JSON.stringify(invalidReference.data))
assert.equal(invalidReference.data.code, 'invalid_reference')
checks.push('invalid object and invalid association rejected')
const crossSite = await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { cookie, origin: 'https://example.invalid', 'content-type': 'application/json' }, body: '{}' })
assert.equal(crossSite.status, 403)
assert.equal((await call('/api/admin/studio/connections')).response.status, 404)
checks.push('cross-site writes and platform management routes rejected')
const upload = await fetch(origin + '/api/workspace/studio/uploads', { method: 'POST', headers: { cookie, 'content-type': 'text/plain', 'x-studio-filename': encodeURIComponent('验证原文.txt') }, body: '独立上传验证正文，保存后可以读回。' })
assert.equal(upload.status, 200)
const uploaded = await upload.json() as { material: Data; assetKey: string; task: unknown }
createdRecords.push({ kind: 'materials', id: String(uploaded.material.id) })
assetIds.push(uploaded.assetKey)
assert.equal(uploaded.task, null)
const downloaded = await fetch(origin + '/api/workspace/studio/assets/' + uploaded.assetKey + '/download', { headers: { cookie } })
assert.equal(downloaded.status, 200)
assert.equal(await downloaded.text(), '独立上传验证正文，保存后可以读回。')
checks.push('authenticated local upload and download without processing task')
const removedMaterial = await api(`materials/${materialItem.id}`, 'DELETE', { expectedVersion: updated.version })
assert.equal(removedMaterial.response.status, 200)
const restored = await api(`materials/${materialItem.id}/restore`, 'POST', { expectedVersion: object(removedMaterial.data.item).version })
assert.equal(restored.response.status, 200)
assert.equal(object(restored.data.item).title, '已保存的验证正文')
checks.push('trash restore preserves actual content')
for (const item of [{ kind: 'drafts', value: draftItem }, { kind: 'materials', value: object(restored.data.item) }, { kind: 'materials', value: uploaded.material }, { kind: 'accounts', value: accountItem }]) {
  const removed = await api(`${item.kind}/${item.value.id}`, 'DELETE', { expectedVersion: item.value.version })
  assert.equal(removed.response.status, 200)
  assert.equal((await api(`${item.kind}/${item.value.id}`)).response.status, 404)
}
checks.push('deletion hides records and dependent edits stay scoped')
await call('/api/auth/logout', 'POST', {})
assert.equal((await api('accounts')).response.status, 401)
cookie = ''
checks.push('logout invalidates server session')
await mkdir('test-results', { recursive: true })
await writeFile('test-results/integration.json', JSON.stringify({ ok: true, checks }, null, 2))
console.log(JSON.stringify({ ok: true, checks }, null, 2))
}
void main().finally(async () => {
  try {
    await deleteOwnFixtures(db, workspaceId, createdRecords.map(record => record.id), assetIds)
    if (cookie) await call('/api/auth/logout', 'POST', {})
  } finally { await db.$disconnect() }
}).catch(error => {
  console.error(error); process.exitCode = 1
})
