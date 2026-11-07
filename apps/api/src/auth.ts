import { randomBytes, createHmac } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Request,Response } from 'express'
import { db,fail,txt } from './shared'
const cookie='ytz_personal_session'
const days=7*24*60*60*1000
function secret(){const key=process.env.SESSION_SECRET || ''; if(key.length<32) throw Error('SESSION_SECRET 至少需要 32 个字符'); return key}
const digest=(token:string)=>createHmac('sha256',secret()).update(token).digest('hex')
export function checkSecret(){secret()}
const tokenFor=(r:Request)=>String(r.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1) || ''
export async function identity(req:Request){
  const token=tokenFor(req); if(!/^[a-f0-9]{64}$/.test(token))fail(401,'login_required','请先登录个人工作台')
  const result=await db.loginSession.findUnique({where:{digest:digest(token)},include:{owner:{include:{workspace:true}}}})
  if(!result||result.expiresAt<=new Date()||!result.owner.workspace)fail(401,'login_required','登录已失效，请重新登录')
  return {user:{id:result.owner.id,username:result.owner.username},workspace:{id:result.owner.workspace.id,name:result.owner.workspace.name}}
}
export async function scope(req:Request){const {user,workspace}=await identity(req); return {ownerId:user.id,workspaceId:workspace.id}}
const cookieOptions=(req:Request)=>({httpOnly:true,sameSite:'strict' as const,path:'/',secure:process.env.COOKIE_SECURE==='true'||req.secure})
const recent=new Map<string,{start:number,count:number}>()
const idleHash=bcrypt.hashSync(randomBytes(32).toString('hex'),10)
export async function login(req:Request,res:Response){
  const username=txt(req.body?.username).trim(),password=txt(req.body?.password)
  const now=Date.now(),key=req.socket.remoteAddress || 'local'
  for(const [k,v] of recent) if(now-v.start>10*60*1000)recent.delete(k)
  const attempts=recent.get(key)||{start:now,count:0}; if(attempts.count>=15)fail(429,'try_later','尝试次数过多，请稍后再试')
  if(password.length>160 || username.length>100)fail(400,'invalid_input','登录信息过长')
  const owner=await db.personalUser.findFirst({where:{singleton:1},include:{workspace:true}})
  const ok=await bcrypt.compare(password,owner?.passwordHash||idleHash)
  if(!owner?.workspace||username!==owner.username||!ok){attempts.count++;recent.set(key,attempts);fail(401,'invalid_login','用户名或密码不正确')}
  recent.delete(key); const token=randomBytes(32).toString('hex'), expiresAt=new Date(now+days)
  await db.$transaction([db.loginSession.deleteMany({where:{expiresAt:{lt:new Date(now)}}}),db.loginSession.create({data:{digest:digest(token),ownerId:owner.id,expiresAt}})])
  res.cookie(cookie,token,{...cookieOptions(req),maxAge:days}); return {user:{id:owner.id,username:owner.username},workspace:{id:owner.workspace.id,name:owner.workspace.name}}
}
export async function logout(req:Request,res:Response){
  const token=tokenFor(req);if(token)await db.loginSession.deleteMany({where:{digest:digest(token)}})
  res.clearCookie(cookie,cookieOptions(req));return {ok:true}
}
