import 'dotenv/config'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.WEB_PORT || '3310'
const children = []
let stopping = false
function launch(args) {
  const child = spawn('pnpm', args, { cwd: root, env: process.env, stdio: 'inherit' })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 0) })
}
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  process.exitCode = code
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop())
launch(['exec', 'tsx', '--tsconfig', 'apps/api/tsconfig.json', 'apps/api/src/main.ts'])
launch(['exec', 'tsx', '--tsconfig', 'apps/worker/tsconfig.json', 'apps/worker/src/main.ts'])
launch(['--filter', '@ytz/web', 'exec', 'next', 'dev', '--webpack', '-H', '127.0.0.1', '-p', port])
