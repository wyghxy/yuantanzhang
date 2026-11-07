import { randomBytes, createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import bcrypt from 'bcryptjs'
import type { Request,Response } from 'express'
import { db,fail,txt } from './shared'
const cookie='ytz_personal_session'
const days=7*24*60*60*1000
function secret(){const key=process.env.SESSION_SECRET || ''; if(key.length<32) throw Error('SESSION_SECRET 至少需要 32 个字符'); return key}
export function authenticationMode(): 'local' | 'password' {
  const mode=process.env.PERSONAL_AUTH_MODE??'local'
  if(mode!=='local' && mode!=='password')throw Error('PERSONAL_AUTH_MODE 只接受 local 或 password')
  return mode
}
// Retain password-mode session compatibility; local grants must not survive a switch to password mode.
const digest=(token:string)=>createHmac('sha256',secret()).update(authenticationMode()==='local'?'local-v1:'+token:token).digest('hex')
export function checkSecret(){secret()}
const tokenFor=(r:Request)=>String(r.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1) || ''
async function current(req:Request){
  const token=tokenFor(req); if(!/^[a-f0-9]{64}$/.test(token))return null
  const result=await db.loginSession.findUnique({where:{digest:digest(token)},include:{owner:{include:{workspace:true}}}})
  if(!result||result.expiresAt<=new Date()||!result.owner.workspace)return null
  return {user:{id:result.owner.id,username:result.owner.username},workspace:{id:result.owner.workspace.id,name:result.owner.workspace.name}}
}
export async function identity(req:Request){return await current(req)??fail(401,'login_required','请先进入个人工作台')}
export async function scope(req:Request){const {user,workspace}=await identity(req); return {ownerId:user.id,workspaceId:workspace.id}}
const cookieOptions=(req:Request)=>({httpOnly:true,sameSite:'strict' as const,path:'/',secure:process.env.COOKIE_SECURE==='true'||req.secure})
const recent=new Map<string,{start:number,count:number}>()
const idleHash=bcrypt.hashSync(randomBytes(32).toString('hex'),10)
type Owner={id:string;username:string;workspace:{id:string;name:string}}
async function issueSession(req:Request,res:Response,owner:Owner){
  const now=Date.now(),token=randomBytes(32).toString('hex'),expiresAt=new Date(now+days)
  await db.$transaction([db.loginSession.deleteMany({where:{expiresAt:{lt:new Date(now)}}}),db.loginSession.create({data:{digest:digest(token),ownerId:owner.id,expiresAt}})])
  res.cookie(cookie,token,{...cookieOptions(req),maxAge:days});return {user:{id:owner.id,username:owner.username},workspace:{id:owner.workspace.id,name:owner.workspace.name}}
}
const localDenied=()=>fail(403,'local_request_required','本机自动登录仅接受来自本机工作台的请求')
function loopback(value:string|undefined){
  if(!value)return false
  if(isIP(value)===4)return value.startsWith('127.')
  if(isIP(value)!==6||value.includes('%'))return false
  const canonical=new URL('http://['+value+']/').hostname.toLowerCase()
  return canonical==='[::1]' || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(canonical)
}
function localHosts(port:string){const hosts=['127.0.0.1','localhost','[::1]'];return new Set(hosts.flatMap(h=>port==='80'?[h,h+':80']:[h+':'+port]))}
export function requireLocalRequest(req:Request){
  if(!loopback(req.socket.remoteAddress))localDenied()
  const apiHosts=localHosts(process.env.API_PORT||'3311'), webPort=process.env.WEB_PORT||'3310', webHosts=localHosts(webPort)
  const rawHost=req.headers.host?.toLowerCase()
  if(!rawHost||!apiHosts.has(rawHost))localDenied()
  const origins=['localhost','127.0.0.1'].map(host=>new URL('http://'+host+':'+webPort).origin)
  if(typeof req.headers.origin!=='string'||!origins.includes(req.headers.origin))localDenied()
  const fetchSite=req.headers['sec-fetch-site']
  if(fetchSite!==undefined && (typeof fetchSite!=='string'||!['same-origin','same-site','none'].includes(fetchSite)))localDenied()
  const seen=new Set<string>()
  for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(['host','origin','sec-fetch-site'].includes(name)){if(seen.has(name))localDenied();seen.add(name)}}
  // Next rewrites set their own X-Forwarded-Host before proxying to the API.
  // Proxy metadata can veto these checks, never substitute for the raw TCP peer, Host or Origin.
  const forwardedHost=req.headers['x-forwarded-host'],forwardedFor=req.headers['x-forwarded-for']
  if(forwardedHost!==undefined && (typeof forwardedHost!=='string'||![...webHosts,...apiHosts].includes(forwardedHost.toLowerCase())))localDenied()
  if(forwardedFor!==undefined && (typeof forwardedFor!=='string'||!forwardedFor.split(',').every(ip=>loopback(ip.trim()))))localDenied()
  if(req.headers.forwarded!==undefined || (req.headers['x-forwarded-proto']!==undefined && req.headers['x-forwarded-proto']!=='http'))localDenied()
}
export async function localLogin(req:Request,res:Response){
  if(authenticationMode()!=='local')fail(403,'local_auth_disabled','当前工作台需要密码登录')
  requireLocalRequest(req)
  const active=await current(req);if(active)return active
  const owner=await db.personalUser.findUnique({where:{singleton:1},include:{workspace:true}})
  if(!owner?.workspace)fail(503,'personal_not_initialized','个人工作区尚未初始化，请先运行 pnpm run setup')
  return issueSession(req,res,{id:owner.id,username:owner.username,workspace:owner.workspace})
}
export async function login(req:Request,res:Response){
  if(authenticationMode()!=='password')fail(403,'password_auth_disabled','当前工作台使用本机自动登录')
  const username=txt(req.body?.username).trim(),password=txt(req.body?.password)
  const now=Date.now(),key=req.socket.remoteAddress || 'local'
  for(const [k,v] of recent) if(now-v.start>10*60*1000)recent.delete(k)
  const attempts=recent.get(key)||{start:now,count:0}; if(attempts.count>=15)fail(429,'try_later','尝试次数过多，请稍后再试')
  if(password.length>160 || username.length>100)fail(400,'invalid_input','登录信息过长')
  const owner=await db.personalUser.findFirst({where:{singleton:1},include:{workspace:true}})
  const ok=await bcrypt.compare(password,owner?.passwordHash||idleHash)
  if(!owner?.workspace||username!==owner.username||!ok){attempts.count++;recent.set(key,attempts);fail(401,'invalid_login','用户名或密码不正确')}
  recent.delete(key);return issueSession(req,res,{id:owner.id,username:owner.username,workspace:owner.workspace})
}
export async function logout(req:Request,res:Response){
  const token=tokenFor(req);if(token)await db.loginSession.deleteMany({where:{digest:digest(token)}})
  res.clearCookie(cookie,cookieOptions(req));return {ok:true}
}
