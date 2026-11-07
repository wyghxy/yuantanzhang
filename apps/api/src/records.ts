import type { Prisma } from '@prisma/client'
import { HttpException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { db, obj, txt, json, show, record, conflict, fail, version, known, type Data, type Scope, type Tx } from './shared'
const editable=new Set(('title name nickname displayName accountName platform platformId handle homepageUrl profileUrl url canonicalUrl sourceUrl sourceLink description summary notes tags status enabled body text script scriptMarkdown manuscript markdown content contentType contentKind format category priority topicId accountId identityId materialId materialIds references referenceIds draftId sourceMaterialId sourceMaterialIds sourceAccountId author creator authorName creatorName readState starred favorite pinned archived transcript analysis contentNote researchNote metrics publishedAt savedAt durationSeconds originalPublication sourceRef audience positioning tone role goal style bio targetAudience writingStyle targetDuration seconds paragraphs segments outline attachments accountType followers statistics tracking trackingNote strategicFocus reason opening hook talkingPoints direction angle memo materialType publishStatus recordType noteDocument notesDocument materialNotes videoType tagsText template styleGuide targetWords').split(/\s+/))
const within=(v:unknown,depth=0):boolean=>{
  if(depth>12)return false
  if(typeof v==='string')return v.length<=400000
  if(Array.isArray(v))return v.length<=4000&&v.every(x=>within(x,depth+1))
  if(v&&typeof v==='object')return Object.entries(v).every(([k,x])=>!['__proto__','prototype','constructor','workspaceId','ownerId'].includes(k)&&within(x,depth+1))
  return v===null||typeof v==='number'||typeof v==='boolean'
}
for(const key of ['noteAnnotations','note','accountUrl','nickname','labels','projectIdText','config','templateKey'])editable.add(key)
function payload(body:Data,old:Data,kind:string) {
  const data={...old}
  if (kind==='materials' && !body.transcript && !body.text && typeof (body.rawTranscript||body.content)==='string')
    body={...body,text:body.rawTranscript||body.content}
  for(const [key,val] of Object.entries(body))if(editable.has(key)){
    if(!within(val))fail(400,'invalid_data','字段格式或长度无效')
    if(key==='config'&&(!val||typeof val!=='object'||Array.isArray(val)))fail(400,'invalid_config','稿件设置必须是对象')
    if(key==='templateKey'&&(typeof val!=='string'||val.length>100))fail(400,'invalid_template','模板标识无效')
    if(['url','sourceUrl','sourceLink','homepageUrl','profileUrl','canonicalUrl'].includes(key)&&val){
      try { if(!['http:','https:'].includes(new URL(String(val)).protocol))throw Error() }catch{fail(400,'invalid_url','链接需要使用 http 或 https')}
    }
    if(key==='transcript'){
      const input=obj(val),prior=obj(data.transcript); const raw=txt(input.raw,txt(prior.raw)), corrected=txt(input.corrected,txt(prior.corrected,raw))
      data.transcript={...prior,raw,corrected,source:'manual',version:Number(prior.version||0)+1}
      if(prior.corrected!==corrected&&data.analysis)data.analysis={...obj(data.analysis),stale:true}
    } else data[key]=val
  }
  if(kind==='materials'&&typeof body.text==='string'&&!body.transcript){const t=body.text;data.transcript={raw:t,corrected:t,source:'manual',version:Number(obj(data.transcript).version||0)+1};if(data.analysis)data.analysis={...obj(data.analysis),stale:true}}
  if(kind==='accounts'){data.name=txt(data.name,txt(data.displayName,txt(data.nickname,txt(data.title))));data.enabled=data.enabled??true}
  if(kind==='drafts'&&body.draftPlanStart){const input=txt(obj(body.draftPlanStart).inputBody);if(!input||input!==data.body)fail(409,'plan_stale','请先保存当前正文');const paragraphs=input.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).slice(0,180);data.visualPlan={planId:randomUUID(),inputBody:input,title:'手动分镜',shots:paragraphs.map((speech,i)=>({id:'S'+String(i+1).padStart(2,'0'),speech,visual:'',assets:'',images:[],time:''}))}}
  if(kind==='drafts'&&body.draftPlanEdits){const patch=obj(body.draftPlanEdits),plan=obj(data.visualPlan);if(!plan.planId||patch.planId!==plan.planId||plan.inputBody!==data.body||!Array.isArray(plan.shots)||!Array.isArray(patch.shots))fail(409,'plan_stale','分镜规划已变化');const changes=patch.shots.map(obj);data.visualPlan={...plan,shots:plan.shots.map(item=>{const row=obj(item),edit=changes.find(x=>x.id===row.id);return edit?{...row,visual:txt(edit.visual),assets:txt(edit.assets)}:row})}}
  if(kind==='materials'&&!data.readState)data.readState='unread'
  if(!data.status)data.status=kind==='drafts'?'draft':kind==='topics'?'idea':kind==='materials'?(data.transcript?'ready':'saved'):'active'
  if(!(txt(data.title).trim()||txt(data.name).trim()||txt(data.url).trim()||txt(data.sourceUrl).trim()||txt(data.body).trim()||txt(data.text).trim()||txt(data.content).trim()))fail(400,'invalid_record','请填写标题、名称、链接或正文')
  if(!txt(data.title).trim())data.title=txt(data.name,txt(data.url,txt(data.sourceUrl,txt(data.text,txt(data.content,txt(data.body)))))).slice(0,180)
  return data
}
async function references(tx:Tx,s:Scope,d:Data){
  const refs:Array<[string,string]>=[]
  for(const [key,kind] of Object.entries({accountId:'accounts',sourceAccountId:'accounts',materialId:'materials',sourceMaterialId:'materials',topicId:'topics',draftId:'drafts',identityId:'identities'}))
    if(typeof d[key]==='string'&&d[key])refs.push([kind,String(d[key])])
  for(const key of ['materialIds','referenceIds','sourceMaterialIds'])if(Array.isArray(d[key]))for(const id of d[key] as unknown[])if(typeof id==='string')refs.push(['materials',id])
  if(Array.isArray(d.references))for(const ref of d.references){const id=obj(ref).materialId;if(typeof id==='string')refs.push(['materials',id])}
  for(const [k,id] of new Map(refs.map(r=>[r.join(':'),r])).values()){
    const target=await tx.studioRecord.findFirst({where:{id,kind:k,workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},deletedAt:null},select:{id:true}})
    if(!target)fail(400,'invalid_reference','关联的记录在当前工作区不可用')
  }
}
export async function create(tx:Tx,s:Scope,k:string,body:Data,extra:Data={}){
  const data={...payload(body,{},known(k)),...extra}; await references(tx,s,data)
  const r=await tx.studioRecord.create({data:{kind:k,workspaceId:s.workspaceId,data:json(data)}})
  await tx.recordVersion.create({data:{recordId:r.id,version:r.version,data:json(data)}});return show(r)
}
export async function change(tx:Tx,s:Scope,k:string,id:string,body:Data,operation='save',extra:Data={}){
  const expected=version(body.expectedVersion); const r=await record(tx,s,k,id,operation==='restore')
  if(expected!==r.version)throw new HttpException({error:'记录已更新，请刷新后重新保存。',code:'version_conflict',current:show(r)},409)
  let data=obj(r.data), deletedAt:Date|null=null
  if(operation==='restore' && body.restoreVersion!=null){
    const restored=await tx.recordVersion.findUnique({where:{recordId_version:{recordId:id,version:version(body.restoreVersion)}}})
    if(!restored)fail(404,'history_not_found','找不到该历史版本'); data=obj(restored.data)
  }else if(operation==='save')data={...payload(body,data,k),...extra}
  if(operation==='delete')deletedAt=new Date()
  if(operation==='save')await references(tx,s,data)
  const count=await tx.studioRecord.updateMany({where:{id,workspaceId:s.workspaceId,version:expected},data:{data:json(data),version:{increment:1},deletedAt}})
  if(!count.count)conflict()
  await tx.recordVersion.create({data:{recordId:id,version:expected+1,data:json(data),deleted:!!deletedAt}})
  return show(await record(tx,s,k,id,true))
}
export type Query = URLSearchParams
export async function list(s:Scope,k:string,q:Query){
  const trash=['1','true','only','deleted'].includes(q.get('deleted')||'')||q.get('status')==='deleted'
  const where:Prisma.StudioRecordWhereInput={workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},kind:k,deletedAt:trash?{not:null}:null}
  const filters:Prisma.StudioRecordWhereInput[]=[]
  if(['true','only','1'].includes(q.get('sample')||''))where.sample=true
  if(['false','exclude','0'].includes(q.get('sample')||''))where.sample=false
  if(q.get('ids'))where.id={in:q.get('ids')!.split(',').map(x=>x.trim()).filter(Boolean).slice(0,200)}
  for(const key of ['platform','status','accountId','topicId','materialId','identityId','contentType','recordType','readState']){const v=q.get(key);if(v&& !['all','any','deleted'].includes(v))filters.push({data:{path:[key],equals:v}})}
  const search=(q.get('q')||q.get('search')||q.get('keyword')||'').trim()
  if(search)filters.push({OR:['title','name','description','body','text','content'].map(key=>({data:{path:[key],string_contains:search,mode:'insensitive' as const}}))})
  const since=q.get('from')||q.get('dateFrom'),until=q.get('to')||q.get('dateTo')
  if(since||until){const start=since?new Date(since):null;let end=until?new Date(until):null;if((start&&!Number.isFinite(+start))||(end&&!Number.isFinite(+end)))fail(400,'invalid_date','日期无效');if(end&&until?.length===10)end=new Date(+end+86400000-1);where.createdAt={...(start?{gte:start}:{}),...(end?{lte:end}:{})}}
  if(filters.length)where.AND=filters
  const limit=Math.max(1,Math.min(200,Number(q.get('limit')||q.get('pageSize'))||50)),offset=Math.max(0,Number(q.get('offset')||q.get('cursor'))||((Math.max(1,Number(q.get('page'))||1)-1)*limit))
  const [rows,total]=await db.$transaction([db.studioRecord.findMany({where,orderBy:[{updatedAt:'desc'},{id:'asc'}],take:limit,skip:offset}),db.studioRecord.count({where})])
  return {items:rows.map(show),total,limit,offset,hasMore:offset+rows.length<total,nextCursor:offset+rows.length<total?String(offset+rows.length):null}
}
