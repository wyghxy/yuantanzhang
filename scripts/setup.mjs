import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
if (!existsSync(envPath)) {
  writeFileSync(envPath, [
    'DATABASE_URL="file:../data/yuantanzhang.db"',
    'API_PORT=3311', 'WEB_PORT=3310', 'API_ORIGIN=http://127.0.0.1:3311',
    'PERSONAL_USERNAME=owner', `PERSONAL_PASSWORD=${randomBytes(24).toString('hex')}`,
    `SESSION_SECRET=${randomBytes(48).toString('hex')}`, 'UPLOAD_DIR=./data/uploads', ''
  ].join('\n'), { mode: 0o600, flag: 'wx' })
  console.log('已生成本机专用 .env 配置和随机个人登录密码。')
}
config({ path: envPath, quiet: true })
const configured = process.env.DATABASE_URL || ''
if (!configured.startsWith('file:') || configured.startsWith('file://')) {
  throw new Error('此版本使用本地 SQLite；已有数据库配置不会被覆盖。v0.2.0 PostgreSQL 用户请先阅读 docs/migrating-from-browser-edition.md。')
}
const filename = configured.slice(5).split('?')[0]
if (!filename || filename === ':memory:') throw new Error('请选择用于持久保存数据的本机 SQLite 文件。')
if (!(process.env.SESSION_SECRET || '').length || (process.env.SESSION_SECRET || '').length < 32) {
  throw new Error('请在 .env 设置至少 32 个字符的 SESSION_SECRET。')
}
mkdirSync(dirname(resolve(root, 'prisma', filename)), { recursive: true })
mkdirSync(resolve(root, process.env.UPLOAD_DIR || './data/uploads'), { recursive: true })
function run(args) {
  const cli = process.env.npm_execpath
  const result = cli
    ? spawnSync(process.execPath, [cli, ...args], { cwd: root, env: process.env, stdio: 'inherit' })
    : spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd: root, env: process.env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (args[0] === 'db:migrate') console.error('迁移未完成。请先停止该实例的 Web、API 和 Worker，再重试 pnpm run setup；保留现有数据库和 WAL 文件。')
    process.exit(result.status || 1)
  }
}
run(['db:generate'])
run(['db:migrate'])
run(['personal:init'])
run(['demo:seed'])
console.log('元探长已初始化。运行 pnpm dev，然后打开 http://127.0.0.1:' + (process.env.WEB_PORT || '3310'))
console.log('用户名和首次随机密码请在本机 .env 查看 PERSONAL_USERNAME / PERSONAL_PASSWORD。请勿上传或分享此文件。')
