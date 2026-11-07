import 'dotenv/config'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { clearDemoRows } from '../scripts/demo-data'

async function main() {
  const url = new URL(process.env.DATABASE_URL || '')
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && ['/ytz_personal', '/ytz_personal_test'].includes(url.pathname), '仅允许隔离的本机验证库')
  const db = new PrismaClient()
  try {
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
void main().catch(error => { console.error(error); process.exitCode = 1 })
