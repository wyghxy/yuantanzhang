/* eslint-disable @typescript-eslint/no-require-imports -- Shared by the compiled CommonJS API and Worker. */
const path = require('node:path')
const { config } = require('dotenv')
const { PrismaClient } = require('@prisma/client')

function personalDatabase() {
  config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })
  const configured = process.env.DATABASE_URL || 'file:../data/yuantanzhang.db'
  if (!configured.startsWith('file:')) throw new Error('个人版只接受本地 SQLite file: 数据库地址。')
  const [filename, options = ''] = configured.slice(5).split('?')
  if (!filename || filename.startsWith('//')) throw new Error('请选择本机 SQLite 文件。')
  const params = new URLSearchParams(options)
  if (filename.toLowerCase().includes(':memory:') || params.get('mode')?.toLowerCase()==='memory' || params.get('vfs')?.toLowerCase()==='memdb')
    throw new Error('个人工作台需要可持久保存的 SQLite 文件，不支持内存数据库。')
  // SQLite pragmas belong to a connection; API and Worker each keep their own single connection.
  params.set('connection_limit','1')
  params.set('socket_timeout','5')
  const url='file:'+path.resolve(__dirname,filename).replace(/\\/g,'/')+'?'+params
  return new PrismaClient({datasourceUrl:url,transactionOptions:{maxWait:10000,timeout:15000}})
}
async function configureSqlite(db) {
  await db.$connect()
  await db.$queryRawUnsafe('PRAGMA busy_timeout = 5000')
  const mode = await db.$queryRawUnsafe('PRAGMA journal_mode = WAL')
  if (String(mode[0]?.journal_mode).toLowerCase() !== 'wal') throw new Error('SQLite 无法启用 WAL；请把数据目录放在支持文件锁的本机磁盘。')
  await db.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  const rows=await db.$queryRawUnsafe('PRAGMA foreign_keys')
  if(Number(rows[0]?.foreign_keys)!==1)throw new Error('SQLite 外键校验未启用。')
}
module.exports={ personalDatabase, configureSqlite }
