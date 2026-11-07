import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify, stripVTControlCharacters } from 'node:util'
import { mkdtemp, realpath, readdir, unlink, rmdir } from 'node:fs/promises'
import { resolve, join, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { assertLoopbackApi } from './demo-cleanup.integration'

const execute = promisify(execFile)
const root = resolve(__dirname, '..')
export const localWebOrigin = () => process.env.WEB_ORIGIN || 'http://127.0.0.1:' + (process.env.WEB_PORT || '3310')

// Use the native HTTP client so a hostile Host header reaches the API exactly as specified.
type BootstrapReply = { status: number; setCookie: string; data: { user?: {id: string}; workspace?: {id: string} } }
export async function localRequest(base: string, headers: Record<string, string> = { origin: localWebOrigin() }) {
  assertLoopbackApi(base)
  return new Promise<BootstrapReply>((ok, no) => {
    const req = request(base + '/api/auth/local', { method: 'POST', headers, timeout: 10_000 }, response => {
      let text = ''
      response.setEncoding('utf8').on('data', chunk => { text += chunk }).on('error', no).on('end', () => {
        try { ok({status: response.statusCode || 0, setCookie: response.headers['set-cookie']?.[0] || '', data: JSON.parse(text)}) }
        catch { no(new Error('会话端点没有返回 JSON')) }
      })
    })
    req.on('error', no).on('timeout', () => req.destroy(new Error('会话请求超时')))
    req.end()
  })
}
export async function localSession(base: string) {
  const reply = await localRequest(base)
  assert.equal(reply.status, 200)
  assert.ok(reply.data.user?.id && reply.data.workspace?.id)
  assert.ok(/HttpOnly/i.test(reply.setCookie) && /SameSite=Strict/i.test(reply.setCookie), '应设置受保护的会话 Cookie')
  return { cookie: reply.setCookie.split(';')[0], workspaceId: reply.data.workspace.id, userId: reply.data.user.id }
}

async function freePort() {
  const listener = createServer()
  await new Promise<void>((ok, no) => { listener.once('error', no); listener.listen(0, '127.0.0.1', ok) })
  const address = listener.address()
  assert.ok(address && typeof address === 'object')
  await new Promise<void>((ok, no) => listener.close(e => e ? no(e) : ok()))
  return address.port
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((ok,no) => {
    const timer=setTimeout(()=>no(new Error('隔离 API 未按时退出')),10_000)
    child.once('exit',()=>{clearTimeout(timer);ok()})
    child.kill('SIGTERM')
  })
}
export type IsolatedApi = { base: string; web: string; user: string; password: string; start(mode:'password'|'local'): Promise<void> }
export async function withIsolatedApi(name:'auth'|'collector', run:(fixture:IsolatedApi)=>Promise<void>) {
  const temp = await mkdtemp(join(await realpath(tmpdir()), 'ytz-'+name+'-test-'))
  const file = join(temp, 'fixture.db')
  const user = 'fixture-' + randomUUID(), password = randomBytes(32).toString('hex')
  const secret = randomBytes(48).toString('hex')
  const apiPort = await freePort(), webPort = await freePort()
  const base='http://127.0.0.1:'+apiPort, web='http://127.0.0.1:'+webPort
  const env={...process.env, DATABASE_URL:'file:'+file, PERSONAL_USERNAME:user, PERSONAL_PASSWORD:password, SESSION_SECRET:secret,
    API_PORT:String(apiPort), WEB_PORT:String(webPort), API_HOST:'127.0.0.1', API_ORIGIN:base, WEB_ORIGIN:web, COOKIE_SECURE:'false',
    UPLOAD_DIR:join(temp,'uploads'), TSX_TSCONFIG_PATH:join(root,'apps/api/tsconfig.json')}
  let child: ChildProcess | undefined
  try {
    const setup={cwd:root,env:{...env,PERSONAL_AUTH_MODE:'password'},timeout:60_000,maxBuffer:256*1024}
    await execute(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',join(root,'prisma/schema.prisma')],setup)
    await execute(process.execPath,['--import','tsx','scripts/init-personal.ts'],setup)
    const start=async (mode:'password'|'local')=>{
      if(child){await stop(child);child=undefined}
      child=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...env,PERSONAL_AUTH_MODE:mode},stdio:['ignore','pipe','pipe']})
      let tail=''
      const record=(chunk:Buffer)=>{tail=(tail+chunk.toString()).slice(-1600)}
      child.stdout!.on('data',record);child.stderr!.on('data',record)
      const diagnostics=()=>stripVTControlCharacters([user,password,secret].reduce((s,value)=>s.replaceAll(value,'[redacted]'),tail))
      let started=false
      const deadline=Date.now()+60_000
      while(Date.now()<deadline){
        if(child.exitCode!==null || child.signalCode!==null)throw new Error('隔离 API 未启动，退出码 '+child.exitCode+' '+diagnostics())
        const response=await fetch(base+'/api/health',{redirect:'error',signal:AbortSignal.timeout(600)}).catch(()=>null)
        if(response?.ok){started=true;break}
        await delay(200)
      }
      assert.ok(started,'隔离 API 未就绪：'+diagnostics())
    }
    await run({base, web, user, password, start})
  } finally {
    if(child)await stop(child)
    const actual=await realpath(temp)
    assert.equal(dirname(actual),await realpath(tmpdir()));assert.ok(basename(actual).startsWith('ytz-'+name+'-test-'));assert.match(basename(actual),/^ytz-(?:auth|collector)-test-[a-zA-Z0-9]{6}$/)
    for(const name of await readdir(actual)) {
      assert.match(name,/^fixture\.db(?:-journal|-wal|-shm)?$/)
      await unlink(join(actual,name))
    }
    await rmdir(actual)
  }
}

async function passwordFixture() {
  await withIsolatedApi('auth',async({base,web,user,password,start})=>{
    const post=(path:string,body:unknown, cookie?:string) => fetch(base+'/api/'+path,
      {method:'POST',headers:{origin:web,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body),redirect:'error'})
    await start('local')
    const local=await localRequest(base,{origin:web})
    assert.equal(local.status,200)
    const oldCookie=local.setCookie.split(';')[0]
    assert.ok(oldCookie)
    await start('password')
    assert.equal((await fetch(base+'/api/workspace/studio/accounts',{headers:{cookie:oldCookie}})).status,401,'本机模式 cookie 不能绕过密码模式')
    const denied=await localRequest(base,{origin:web})
    assert.equal(denied.status,403);assert.equal(denied.setCookie,'')
    const failed=await post('auth/login',{username:user,password:randomBytes(32).toString('hex')})
    assert.equal(failed.status,401);assert.ok(!failed.headers.has('set-cookie'))
    const login=await post('auth/login',{username:user,password})
    assert.equal(login.status,200)
    const header=login.headers.get('set-cookie')||''
    assert.ok(/HttpOnly/i.test(header)&&/SameSite=Strict/i.test(header))
    const cookie=header.split(';')[0], me=(await login.json()).user
    const protectedReply=await fetch(base+'/api/workspace/studio/accounts',{headers:{cookie}})
    assert.equal(protectedReply.status,200);assert.ok(me.id)
    assert.equal((await post('auth/register',{username:'unused'})).status,404)
    assert.equal((await post('auth/logout',{},cookie)).status,200)
    assert.equal((await fetch(base+'/api/workspace/studio/accounts',{headers:{cookie}})).status,401)
  })
  console.log('隔离认证通过：模式切换拒绝旧本机会话；密码模式禁止自动建会话、拒绝错误密码、正确密码可访问、退出后会话失效；无注册入口。')
}
if(resolve(process.argv[1]||'')===__filename) void passwordFixture().catch(error=>{console.error(error instanceof Error?error.message:'认证验收失败');process.exitCode=1})
