import { db,record,fail,show,json,type Scope,type Data,obj } from './shared'

// Enqueuing is an explicit action. The queue entry and the visible task are one SQLite transaction.
export async function localCount(s:Scope,body:Data){
  const kind=body.kind==='materials'?'materials':body.kind==='drafts'?'drafts':fail(400,'invalid_kind','只能统计素材或草稿')
  const targetId=String(body.id||'')
  return db.$transaction(async tx=>{
    const target=await record(tx,s,kind,targetId)
    const data={title:'统计正文字数',type:'word_count',status:'queued',targetId:target.id,targetKind:kind,targetVersion:target.version}
    const task=await tx.studioRecord.create({data:{workspaceId:s.workspaceId,kind:'local_tasks',data:json(data),localTask:{create:{}}}})
    return {task:show(task)}
  })
}
export async function cancel(s:Scope,id:string){
  return db.$transaction(async tx=>{
    const task=await record(tx,s,'local_tasks',id)
    const changed=await tx.localTask.updateMany({where:{recordId:id,state:{in:['queued','running']}},data:{state:'cancelled',leaseToken:null,leaseUntil:null}})
    if(!changed.count){
      if(obj(task.data).status==='cancelled')return {task:show(task)}
      return fail(409,'task_finished','任务已经结束')
    }
    const latest=await tx.studioRecord.update({where:{id},data:{version:{increment:1},data:json({...obj(task.data),status:'cancelled',finishedAt:new Date().toISOString()})}})
    return {task:show(latest)}
  })
}
export async function jobs(s:Scope,id:string|undefined,action:string|undefined,q:URLSearchParams){
  if(id){
    const item=show(await record(db,s,'local_tasks',id))
    if(action==='events'||action==='logs'){
      const data=obj(item),events=[{id:id+':queued',status:'queued',createdAt:item.createdAt}]
      if(typeof data.startedAt==='string')events.push({id:id+':started',status:'running',createdAt:new Date(data.startedAt)})
      if(typeof data.finishedAt==='string')events.push({id:id+':finished',status:String(data.status),createdAt:new Date(data.finishedAt)})
      return {events,logs:events}
    }
    return {task:item,item}
  }
  const status=q.get('status'),states=status==='active'||status==='work_queue'?['queued','running']:status&&status!=='all'?[status]:null
  const where={workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},kind:'local_tasks',deletedAt:null,...(states?{localTask:{is:{state:{in:states}}}}:{})}
  const limit=Math.min(200,Math.max(1,Math.floor(Number(q.get('limit'))||200))),offset=Math.max(0,Math.floor(Number(q.get('offset'))||0))
  const [rows,total]=await db.$transaction([db.studioRecord.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip:offset}),db.studioRecord.count({where})])
  const items=rows.map(show),hasMore=offset+items.length<total
  return {items,tasks:items,total,hasMore,nextCursor:hasMore?String(offset+items.length):null}
}
