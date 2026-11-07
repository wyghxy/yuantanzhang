import {randomUUID} from 'node:crypto'
import {mkdir,unlink,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {Request} from 'express'
import {db,obj,txt,record,fail,type Data,type Scope} from './shared'
import {change} from './records'
import {directory} from './files'
const arr=(v:unknown)=>Array.isArray(v)?v.map(obj):[]
export async function images(req:Request,s:Scope,q:URLSearchParams){
 const draft=q.get('draftId'), target=draft||q.get('materialId'),kind=draft?'drafts':'materials',shotId=q.get('shotId'),id=q.get('id')||''
 if(!target||!shotId||!/^[a-f0-9-]{36}$/i.test(id))fail(400,'invalid_target','请选择当前分镜上的图片')
 const current=await record(db,s,kind,target),d=obj(current.data),plan=obj(draft?d.visualPlan:obj(d.sourceWorkspace)['visual-plan'])
 if((draft?plan.planId:plan.taskId)!==(draft?q.get('planId'):q.get('taskId')) || (draft&&plan.inputBody!==d.body))fail(409,'plan_changed','文案或分镜已更新，请重新打开')
 const shots=arr(plan.shots),shot=shots.find(x=>x.id===shotId);if(!shot)fail(404,'shot_missing','分镜不存在')
 const images=arr(shot.images),existing=images.find(x=>x.id===id)
 let image:Data, disk='',saved=false,bytes:Buffer|undefined,mediaType='',assetKey='',name=''
 if(req.method==='PATCH'){
  if(!existing)fail(404,'image_missing','图片不存在')
  const action=q.get('action');if(!['remove','restore'].includes(action||''))fail(400,'invalid_action','请选择移除或恢复')
  image={...existing,deletedAt:action==='remove'?new Date().toISOString():null}
 }else if(req.method==='POST'){
  if(!['paste','upload'].includes(q.get('kind')||''))fail(400,'invalid_image','仅接受本地上传或粘贴的图片')
  if(existing)return {material:{...d,id:current.id,version:current.version},image:existing,duplicate:true}
  const blocks:Buffer[]=[];let size=0;for await(const raw of req){size+=raw.length;if(size>12*1024*1024)fail(413,'too_large','图片最多 12 MiB');blocks.push(Buffer.from(raw))}
  bytes=Buffer.concat(blocks);if(bytes.length<12)fail(400,'invalid_image','图片文件不完整')
  mediaType=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':''
  if(!mediaType)fail(400,'invalid_image','仅支持 PNG、JPEG 和 WebP 文件')
  assetKey=randomUUID();name=txt(q.get('filename'),'图片').split(/[\\/]/).pop()!.slice(0,160)
  image={id,kind:q.get('kind'),assetKey,filename:name,mediaType,bytes:size,shotId,createdAt:new Date().toISOString()}
 }else fail(404,'not_found','未找到此图片操作')
 const all=existing?images.map(x=>x.id===id?image:x):[...images,image], next={...plan,shots:shots.map(x=>x.id===shot.id?{...x,images:all}:x)}
 const extra=draft?{visualPlan:next}:{sourceWorkspace:{...obj(d.sourceWorkspace),'visual-plan':next}}
 try{
  if(bytes){const dir=join(directory(),s.workspaceId);await mkdir(dir,{recursive:true,mode:0o700});disk=join(dir,assetKey);await writeFile(disk,bytes,{flag:'wx',mode:0o600})}
  const material=await db.$transaction(async tx=>{const row=await change(tx,s,kind,target,{expectedVersion:current.version},'save',extra)
    if(bytes){await tx.studioFile.create({data:{id:assetKey,workspaceId:s.workspaceId,recordId:target,name,size:bytes.length,mediaType}});if(row.sample){await tx.studioRecord.update({where:{id:target},data:{sample:false}});return {...row,sample:false,isSample:false}}}return row})
  saved=true;return {material,image,duplicate:false}
 }finally{if(disk&&!saved)await unlink(disk).catch(()=>{})}
}
