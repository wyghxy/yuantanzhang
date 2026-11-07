import 'dotenv/config'
import assert from 'node:assert/strict'
import { open, realpath, unlink } from 'node:fs/promises'
import { resolve, relative, basename, dirname, join } from 'node:path'
import { personalDatabase } from '../prisma/sqlite-runtime.cjs'
import type { PrismaClient } from '@prisma/client'
import { clearDemoRows } from '../scripts/demo-data'

const root = resolve(__dirname, '..')
export function assertLoopbackApi(address: string) {
  const url = new URL(address)
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, '仅允许本机个人版 HTTP 接口')
}

// Check the intended file before connecting; check the file actually opened by Prisma before any writes.
export async function assertPersonalSqlite(db: PrismaClient) {
  const setting = process.env.DATABASE_URL || ''
  assert.ok(setting.startsWith('file:') && !setting.slice(5).startsWith('//') && !/[?#%]/.test(setting), '要求项目内的 SQLite 文件')
  const expected = resolve(root, 'prisma', setting.slice(5))
  const data = resolve(root, 'data')
  assert.ok(dirname(expected) === data && /^yuantanzhang(?:[-_]test)?\.db$/.test(basename(expected)), '拒绝对其他数据库运行验收')
  assert.equal(await realpath(expected), join(await realpath(root), 'data', basename(expected)), '不得通过符号链接访问测试库')
  const f = await open(expected, 'r')
  try {
    const sig = Buffer.alloc(16)
    assert.equal((await f.read(sig, 0, sig.length, 0)).bytesRead, sig.length)
    assert.equal(sig.toString('ascii'), 'SQLite format 3\0')
  } finally { await f.close() }
  const files = await db.$queryRaw<Array<{ name: string; file: string }>>`PRAGMA database_list`
  const file = files.find(row => row.name === 'main')
  assert.ok(file)
  assert.equal(await realpath(file.file), await realpath(expected), '应用连接的数据库必须与验收目标完全相同')
}

export async function deleteOwnFixtures(db: PrismaClient, workspaceId: string, ids: string[], assetIds: string[]) {
  if (!ids.length || !workspaceId) return
  const owned = await db.studioFile.findMany({
    where: { workspaceId, id: { in: assetIds }, recordId: { in: ids }, record: { sample: false } },
    select: { id: true }
  })
  const uploads = resolve(root, process.env.UPLOAD_DIR || 'data/uploads')
  for (const { id } of owned) {
    assert.match(id, /^[0-9a-f-]{36}$/i)
    assert.match(workspaceId, /^[0-9a-f-]{36}$/i)
    const file = join(uploads, workspaceId, id)
    try {
      const actual = await realpath(file)
      assert.equal(relative(await realpath(uploads), actual), join(workspaceId, id), '只清理本次上传的原始文件')
      await unlink(actual)
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  }
  await db.studioRecord.deleteMany({ where: { workspaceId, sample: false, id: { in: ids } } })
}

async function main() {
  const db = personalDatabase()
  try {
    await assertPersonalSqlite(db)
    const workspace = await db.workspace.findFirstOrThrow({ where: { owner: { singleton: 1 } } })
    const before = await db.studioRecord.count({ where: { workspaceId: workspace.id, sample: true } })
    const rollback = new Error('expected test rollback')
    try {
      await db.$transaction(async transaction => {
        const demo = await transaction.studioRecord.create({ data: { workspaceId: workspace.id, kind: 'materials', sample: true, data: { title: '清理测试演示' } } })
        const personal = await transaction.studioRecord.create({ data: { workspaceId: workspace.id, kind: 'materials', sample: false, data: { title: '清理测试个人资料' } } })
        assert.equal(await clearDemoRows(transaction, workspace.id), before + 1)
        assert.equal(await transaction.studioRecord.findUnique({ where: { id: demo.id } }), null)
        assert.ok(await transaction.studioRecord.findUnique({ where: { id: personal.id } }))
        assert.equal((await transaction.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).demoInitialized, true)
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    }
    assert.equal(await db.studioRecord.count({ where: { workspaceId: workspace.id, sample: true } }), before)
    console.log('Demo cleanup passed: marked examples removed, personal data retained, test transaction rolled back.')
  } finally {
    await db.$disconnect()
  }
}
if (resolve(process.argv[1] || '') === __filename) void main().catch(error => { console.error(error); process.exitCode = 1 })
