import { Queue } from 'bullmq'
import { db,record,fail,show,json,type Scope,type Data,obj } from './shared'
const redis = new URL(process.env.REDIS_URL||'redis://127.0.0.1:6397')
function connection(){const url=new URL(process.env.REDIS_URL||redis.href);return {host:url.hostname,port:Number(url.port)||6379,username:url.username||undefined,password:url.password||undefined,db:Number(url.pathname.slice(1))||0,maxRetriesPerRequest:1}}
let queue:Queue|undefined
export async function localCount(s:Scope,body:Data){
  const kind=body.kind==='materials'?'materials':body.kind==='drafts'?'drafts':fail(400,'invalid_kind','只能统计素材或草稿')
  const target=await record(db,s,kind,String(body.id||''))
  const data={title:'统计正文字数',type:'word_count',status:'queued',targetId:target.id,targetKind:kind,targetVersion:target.version}
  const task=await db.studioRecord.create({data:{workspaceId:s.workspaceId,kind:'local_tasks',data:json(data)}})
  try{queue??=new Queue('personal-local-text',{connection:connection()});await queue.add('word-count',{taskId:task.id,workspaceId:s.workspaceId,ownerId:s.ownerId},{jobId:task.id,attempts:2,backoff:{type:'fixed',delay:500},removeOnComplete:{count:100},removeOnFail:{count:100}})}catch{await db.studioRecord.update({where:{id:task.id},data:{data:json({...data,status:'failed',error:'本地任务队列不可用'})}});fail(503,'queue_unavailable','本地任务队列不可用')}
  return {task:show(task)}
}
export async function jobs(s:Scope,id:string|undefined,action:string|undefined,q:URLSearchParams){
  if(id){const item=show(await record(db,s,'local_tasks',id));if(action==='events'||action==='logs')return {events:[{id:item.id,status:obj(item).status,createdAt:item.updatedAt}],logs:[]};return {task:item,item}}
  const all=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},kind:'local_tasks',deletedAt:null},orderBy:{createdAt:'desc'},take:200})
  const status=q.get('status'),items=all.filter(r=>!status||status==='all'||(status==='active'||status==='work_queue'?['queued','running'].includes(String(obj(r.data).status)):status===obj(r.data).status)).map(show)
  return {items,tasks:items,total:items.length,hasMore:false,nextCursor:null}
}
