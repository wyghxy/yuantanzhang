import {randomUUID} from 'node:crypto'
import {Prisma, type PrismaClient} from '@prisma/client'

export const LEASE_MS=30000
type Data=Record<string,unknown>
const object=(v:unknown):Data=>v&&typeof v==='object'&&!Array.isArray(v)?v as Data:{}
const string=(v:unknown)=>typeof v==='string'?v:''
const json=(data:Data)=>data as Prisma.InputJsonObject
type Lease={recordId:string;leaseToken:string;leaseUntil:Date;workspaceId:string;ownerId:string;data:Data}
const eligible=(now:Date):Prisma.LocalTaskWhereInput=>({OR:[{state:'queued'},{state:'running',leaseUntil:{lte:now}}],record:{is:{kind:'local_tasks',deletedAt:null}}})

/** A competing worker can see the same candidate, but only one conditional update can claim it. */
export async function claimOne(db:PrismaClient,now=new Date()):Promise<Lease|null>{
  for(let attempt=0;attempt<4;attempt++){
    const candidate=await db.localTask.findFirst({where:eligible(now),select:{recordId:true},orderBy:[{createdAt:'asc'},{recordId:'asc'}]})
    if(!candidate)return null
    const token=randomUUID(),until=new Date(now.getTime()+LEASE_MS)
    const claimed=await db.$transaction(async tx=>{
      const changed=await tx.localTask.updateMany({where:{recordId:candidate.recordId,...eligible(now)},data:{state:'running',leaseToken:token,leaseUntil:until,attempts:{increment:1}}})
      if(!changed.count)return null
      const row=await tx.studioRecord.findUniqueOrThrow({where:{id:candidate.recordId},include:{workspace:{select:{ownerId:true}},localTask:true}})
      const data={...object(row.data),status:'running',startedAt:now.toISOString(),attempts:row.localTask!.attempts}
      await tx.studioRecord.update({where:{id:row.id},data:{version:{increment:1},data:json(data)}})
      return {recordId:row.id,leaseToken:token,leaseUntil:until,workspaceId:row.workspaceId,ownerId:row.workspace.ownerId,data}
    })
    if(claimed)return claimed
  }
  return null
}

/** Lease ownership and the current source revision are rechecked before publishing any result. */
export async function executeClaim(db:PrismaClient,claim:Lease){
  const d=claim.data,kind=string(d.targetKind),id=string(d.targetId)
  return db.$transaction(async tx=>{
    // Do the conditional write first so the transaction owns the SQLite writer lock.
    const changed=await tx.localTask.updateMany({where:{recordId:claim.recordId,state:'running',leaseToken:claim.leaseToken,leaseUntil:{gt:new Date()},record:{is:{workspaceId:claim.workspaceId,workspace:{ownerId:claim.ownerId},deletedAt:null}}},data:{leaseUntil:new Date(Date.now()+LEASE_MS)}})
    if(!changed.count)return false
    const revision=Number(d.targetVersion)
    const valid=d.type==='word_count'&&['materials','drafts'].includes(kind)&&id&&Number.isSafeInteger(revision)&&revision>0
    const target=valid?await tx.studioRecord.findFirst({where:{id,kind,version:revision,workspaceId:claim.workspaceId,workspace:{ownerId:claim.ownerId},deletedAt:null}}):null
    const state=target?'succeeded':'failed',finishedAt=new Date().toISOString()
    const body=object(target?.data),transcript=object(body.transcript)
    const text=kind==='drafts'?string(body.body):string(transcript.corrected)||string(transcript.raw)||string(body.text)||string(body.content)
    const result=target?{characters:Array.from(text.replace(/\s/g,'')).length}:{error:valid?'记录已修改或删除，请重新统计':'任务参数无效'}
    await tx.localTask.update({where:{recordId:claim.recordId},data:{state,leaseToken:null,leaseUntil:null}})
    await tx.studioRecord.update({where:{id:claim.recordId},data:{version:{increment:1},data:json({...d,...result,status:state,finishedAt})}})
    return true
  })
}
export async function runOne(db:PrismaClient){
  const claim=await claimOne(db)
  if(!claim)return false
  await executeClaim(db,claim)
  return true
}
