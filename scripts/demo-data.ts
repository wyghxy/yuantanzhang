import type { Prisma, PrismaClient } from '@prisma/client'

export async function clearDemoRows(transaction: Prisma.TransactionClient, workspaceId: string) {
  await transaction.workspace.update({ where: { id: workspaceId }, data: { demoInitialized: true } })
  const result = await transaction.studioRecord.deleteMany({ where: { workspaceId, sample: true } })
  return result.count
}

export async function clearDemoData(db: PrismaClient, workspaceId: string) {
  return db.$transaction(transaction => clearDemoRows(transaction, workspaceId))
}
