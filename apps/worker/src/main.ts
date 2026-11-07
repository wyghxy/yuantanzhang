import { resolve } from 'node:path'
import { config } from 'dotenv'
import { Worker } from 'bullmq'
import { Prisma, PrismaClient } from '@prisma/client'
config({path:resolve(__dirname,'../../..','.env'),quiet:true})
const db=new PrismaClient(), redis=new URL(process.env.REDIS_URL||'redis://127.0.0.1:6397')
const obj=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const txt=(value:unknown)=>typeof value==='string'?value:''
const worker=new Worker('personal-local-text',async job=>{
 if(job.name!=='word-count')throw Error('未知任务')
 const {workspaceId,ownerId,taskId}=job.data||{}
 if(![workspaceId,ownerId,taskId].every(v=>typeof v==='string'&&v))throw Error('无效任务范围')
 const task=await db.studioRecord.findFirst({where:{id:taskId,kind:'local_tasks',workspaceId,workspace:{ownerId},deletedAt:null}})
 if(!task)throw Error('工作区或任务不存在')
 const data=obj(task.data);if(data.status==='succeeded'||data.status==='cancelled')return
 async function update(patch:Record<string,unknown>){await db.studioRecord.updateMany({where:{id:taskId,workspaceId,workspace:{ownerId},deletedAt:null},data:{data:{...data,...patch} as Prisma.InputJsonObject}})}
 try{
  const id=String(data.targetId||''),kind=String(data.targetKind||'')
  if(!['materials','drafts'].includes(kind))throw Error('无效记录类型')
  const target=await db.studioRecord.findFirst({where:{id,kind,workspaceId,workspace:{ownerId},deletedAt:null}})
  if(!target||target.version!==data.targetVersion)throw Error('记录已修改或删除，请重新统计')
  await update({status:'running'})
  const raw=obj(target.data),transcript=obj(raw.transcript)
  const body=kind==='drafts'?txt(raw.body):txt(transcript.corrected)||txt(transcript.raw)||txt(raw.text)||txt(raw.content)
  const characters=Array.from(body.replace(/\s/g,'')).length
  await update({status:'succeeded',characters,finishedAt:new Date().toISOString()});return {characters}
 }catch(error){await update({status:'failed',error:error instanceof Error?error.message:'任务未完成'});throw error}
},{connection:{host:redis.hostname,port:Number(redis.port)||6379,username:redis.username||undefined,password:redis.password||undefined,db:Number(redis.pathname.slice(1))||0,maxRetriesPerRequest:null},concurrency:1})
worker.on('error',error=>console.error('本地队列不可用：'+error.name))
worker.waitUntilReady().then(()=>console.log('个人工作台本地文字任务已就绪')).catch(()=>{process.exitCode=1})
async function stop(){await worker.close();await db.$disconnect();process.exit(0)}
process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop())
