import type {PrismaClient} from '@prisma/client'
export function personalDatabase(): PrismaClient
export function configureSqlite(db:PrismaClient): Promise<void>
