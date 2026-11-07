import { createHash,randomInt } from 'node:crypto'
import { Readable } from 'node:stream'
import type { Request } from 'express'
import type { StudioRecord } from '@prisma/client'
import { db,record,conflict,fail,txt,obj,json,type Scope,type Tx,type Data } from './shared'
import { upload } from './files'
import { change } from './records'
const newId=()=>randomInt(1,2147483647)
const items=(value:unknown):Data[]=>Array.isArray(value)?value.map(obj):[]
const pick=(d:Data,keys:string[])=>Object.fromEntries(keys.filter(k=>d[k]!==undefined).map(k=>[k,d[k]]))
const fields=['credibilityScore','relevanceScore','timelinessScore','differentiationScore','productionScore']
const numeric=(id:string)=>{const n=Number(id);if(!Number.isSafeInteger(n)||n<1)fail(404,'not_found','记录不存在');return n}
const projectId=(n:number)=>'project-'+n
const oppId=(n:number)=>'opportunity-'+n
const now=()=>new Date().toISOString()
const sourceId=(id:string)=>createHash('sha256').update(id).digest().readUInt32BE(0)+1
const wsWhere=(s:Scope)=>({workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},deletedAt:null})
async function sources(tx:Tx,s:Scope){const rows=await tx.studioRecord.findMany({where:{...wsWhere(s),kind:'materials'}});return rows.map(r=>{const d=obj(r.data);return {id:sourceId(r.id),materialId:r.id,title:txt(d.title),url:txt(d.url,txt(d.sourceUrl)),status:d.status==='verified'?'verified':'recorded',originalAt:r.createdAt,channel:txt(d.platform,'local'),summary:txt(d.description)||null,tags:d.tags||[],evidenceNotes:txt(d.notes)||null,sample:r.sample}})}
const opportunity=(r:StudioRecord)=>({...obj(r.data),id:Number(r.id.split('-')[1]),sample:r.sample,createdAt:r.createdAt,updatedAt:r.updatedAt,version:r.version})
const project=(r:StudioRecord)=>({...pick(obj(r.data),['title','status','notes','dueAt','finalVideoUrl','masterScript','opportunity','opportunityId','sourceDraftId']),id:Number(r.id.split('-')[1]),sample:r.sample,createdAt:r.createdAt,updatedAt:r.updatedAt,version:r.version,variants:[],publishRecords:[]})
async function update(tx:Tx,s:Scope,r:StudioRecord,data:Data){
  const m=await tx.studioRecord.updateMany({where:{id:r.id,...wsWhere(s),version:r.version},data:{data:json(data),version:{increment:1}}});if(!m.count)conflict()
  return tx.studioRecord.findUniqueOrThrow({where:{id:r.id}})
}
async function createProject(tx:Tx,s:Scope,b:Data) {
  const title=txt(b.title).trim();if(!title||title.length>240)fail(400,'invalid_title','请填写不超过 240 字的项目名称')
  const opportunityId=b.opportunityId?numeric(String(b.opportunityId)):null
  const op=opportunityId?await record(tx,s,'opportunities',oppId(opportunityId)):null
  const id=newId(),time=now(), body=txt(b.scriptBody)
  const master=body?{id,version:1,title,body,confirmedAt:null,facts:b.facts||[],inferences:b.inferences||[],disputes:b.disputes||[],timelinessRisk:txt(b.timelinessRisk)||null}:null
  const data={title,status:'master_script',notes:null,dueAt:null,finalVideoUrl:null,opportunityId,opportunity:op?opportunity(op):null,masterScript:master,history:master?[{id:1,version:1,snapshot:master,createdAt:time}]:[],materials:[],writingDrafts:[],sourceDraftId:b.sourceDraftId||null,
    settings:{revision:0,config:{template:'tutorial',audience:'',angle:'',ownCases:'',duration:90,style:'直接、具体',purpose:'',language:'简体中文'}},
    profile:{revision:0,config:{positioning:'',audience:'',phrases:'',avoid:'',cases:''}}}
  return tx.studioRecord.create({data:{id:projectId(id),workspaceId:s.workspaceId,kind:'projects',data:json(data)}})
}
async function setMaster(tx:Tx,s:Scope,r:StudioRecord,b:Data){
  const data=obj(r.data),master=obj(data.masterScript),v=Number(master.version)||0
  if(Number(b.expectedVersion)!==v)conflict()
  const action=txt(b.action,'save'), n=v+1
  if(!['save','confirm','unconfirm','unlock','reopen'].includes(action))fail(400,'invalid_action','不支持的母稿操作')
  if(action==='save'&&master.confirmedAt)fail(409,'master_confirmed','先撤销确认，再修改已确认的母稿')
  if(action==='confirm'&&!txt(master.body).trim())fail(400,'empty_master','母稿尚未填写正文')
  const next={id:Number(r.id.slice(8)),title:txt(data.title),body:'',facts:[],inferences:[],disputes:[],timelinessRisk:null,...master,...(action==='save'?pick(b,['title','body','facts','inferences','disputes','timelinessRisk']):{}),version:n,confirmedAt:action==='confirm'?now():null}
  const hist=[{id:n,version:n,snapshot:next,createdAt:now()},...items(data.history)]
  await update(tx,s,r,{...data,masterScript:next,history:hist});return {masterScript:next,invalidatedVariants:0}
}
async function writing(tx:Tx,s:Scope,r:StudioRecord,parts:string[],method:string,b:Data){
  const d=obj(r.data),[resource,id,operation]=parts,materials=items(d.materials),drafts=items(d.writingDrafts)
  if(!resource&&method==='GET')return {materials,drafts,jobs:[],settings:d.settings,profile:d.profile,master:d.masterScript,history:d.history,capabilities:{model:false,asr:false,modelName:null,storage:true}}
  if(['settings','profile'].includes(resource)&&method==='PATCH'){
    const prev=obj(d[resource]);if(Number(b.expectedRevision)!==prev.revision)conflict()
    const allowed=resource==='settings'?['template','audience','angle','ownCases','duration','style','purpose','language']:['positioning','audience','phrases','avoid','cases']
    const value={revision:Number(prev.revision)+1,config:{...obj(prev.config),...pick(obj(b.config),allowed)}};await update(tx,s,r,{...d,[resource]:value});return {value}
  }
  if(resource==='materials'){
    if(!id&&method==='POST'){
      const raw=txt(b.transcript,txt(b.rawTranscript)), url=txt(b.url);if(url){try{if(!['http:','https:'].includes(new URL(url).protocol))throw Error()}catch{fail(400,'invalid_url','请输入 http 或 https 链接')}}
      if(!raw.trim()&&!url&&!b.studioMaterialId)fail(400,'missing_material','请输入原文、链接或上传文件')
      const material={id:newId(),revision:1,title:txt(b.title)||url||'手动录入',url:url||null,platform:b.studioMaterialId?'upload':url?'local':'text',author:txt(b.author)||null,rawTranscript:raw,correctedTranscript:raw,transcriptSource:raw?'manual':null,status:raw?'ready':'saved',lastError:null,sourceItemId:null,sourceItem:null,analysis:null,analysisRevision:null,studioMaterialId:b.studioMaterialId||null,assetKey:b.assetKey||null}
      await update(tx,s,r,{...d,materials:[material,...materials]});return {material}
    }
    const prev=materials.find(x=>x.id===Number(id));if(!prev)fail(404,'not_found','素材不存在')
    if(Number(b.expectedRevision)!==prev.revision)conflict()
    let next
    if(!operation&&method==='PATCH')next={...prev,correctedTranscript:txt(b.correctedTranscript),revision:Number(prev.revision)+1,status:'ready',transcriptSource:'manual'}
    else if(operation==='verify'&&method==='POST'){
      if(txt(b.evidenceNotes).trim().length<5)fail(400,'missing_evidence','请填写至少 5 字的核实说明')
      next={...prev,revision:Number(prev.revision)+1,sourceItemId:prev.id,sourceItem:{id:prev.id,status:'verified',evidenceNotes:b.evidenceNotes}}
    }else fail(404,'not_found','未找到素材操作')
    await update(tx,s,r,{...d,materials:materials.map(x=>x.id===prev.id?next:x)});return {material:next}
  }
  if(resource==='drafts'&&id&&method==='PATCH'){
    const prev=drafts.find(x=>x.id===Number(id));if(!prev)fail(404,'not_found','草稿不存在')
    if(prev.revision!==Number(b.expectedRevision))conflict();const next={...prev,document:obj(b.document),revision:Number(prev.revision)+1};await update(tx,s,r,{...d,writingDrafts:drafts.map(x=>x.id===prev.id?next:x)});return {draft:next}
  }
  fail(404,'not_found','未找到该本地写作操作')
}
async function listings(tx:Tx,s:Scope){
 const all=await tx.studioRecord.findMany({where:{...wsWhere(s),kind:{in:['projects','opportunities']}},orderBy:{updatedAt:'desc'}})
 const projects=all.filter(x=>x.kind==='projects').map(project),src=await sources(tx,s)
 const opportunities=all.filter(x=>x.kind==='opportunities').map(r=>{const d=obj(r.data),o=opportunity(r),scores=fields.map(k=>d[k]).filter((v):v is number=>typeof v==='number')
   const sum=scores.length?scores.reduce((a,b)=>a+b,0):null
   return {...o,sourceItem:src.find(x=>x.id===Number(d.sourceItemId))||null,eventCluster:null,projects:projects.filter(p=>obj(p).opportunityId===o.id),ranking:{baseScore:sum,scoreCount:scores.length,strategyBonus:0,totalScore:sum,matchedRules:[],scoringMode:'manual'}}})
 return {projects,opportunities,sources:src,clusters:[]}
}
async function projectScope(req:Request,s:Scope,isOpportunity:boolean,parts:string[],b:Data) {
 const [id,resource,...rest]=parts,method=req.method
 if(!id&&method==='GET')return db.$transaction(tx=>listings(tx,s))
 return db.$transaction(async tx=>{
   if(isOpportunity){
     const current=id?await record(tx,s,'opportunities',oppId(numeric(id))):null,d={...obj(current?.data),...pick(b,['title','angle','audienceValue','reason','status','hookIdeas','sourceItemId',...fields])}
     if(!txt(d.title).trim()||!txt(d.angle).trim())fail(400,'missing_opportunity','请填写标题和创作角度')
     if(b.eventClusterId)fail(400,'invalid_reference','个人工作台不包含这个事件组')
     if(d.sourceItemId&&!(await sources(tx,s)).some(x=>x.id===Number(d.sourceItemId)))fail(400,'invalid_reference','信息来源不可用')
     d.sourceItemId=d.sourceItemId?Number(d.sourceItemId):null;d.eventClusterId=null;d.status=d.status||'proposed';d.hookIdeas=d.hookIdeas||[]
     if(!current&&method==='POST'){const row=await tx.studioRecord.create({data:{id:oppId(newId()),workspaceId:s.workspaceId,kind:'opportunities',data:json(d)}});return {opportunity:opportunity(row)}}
     if(current&&method==='PATCH')return {opportunity:opportunity(await update(tx,s,current,d))}
     fail(405,'invalid_method','不支持此机会操作')
   }
   if(!id&&method==='POST'){const r=await createProject(tx,s,b);return {project:project(r)}}
   const r=await record(tx,s,'projects',projectId(numeric(id))),d=obj(r.data)
   if(!resource&&method==='GET')return {project:project(r),sources:await sources(tx,s),mode:'manual'}
   if(!resource&&method==='PATCH'){if(b.expectedVersion!=null&&Number(b.expectedVersion)!==r.version)conflict();const data={...d,...pick(b,['title','status','notes','dueAt','finalVideoUrl'])};if(!txt(data.title).trim())fail(400,'invalid_title','项目名称不能为空');return {project:project(await update(tx,s,r,data))}}
   if(resource==='master-script'&&['POST','PUT','PATCH'].includes(method))return setMaster(tx,s,r,b)
   if(resource==='writing')return writing(tx,s,r,rest,method,b)
   fail(404,'not_found','未找到该项目功能')
 })
}
export async function projectRoute(req:Request,s:Scope){
 const url=new URL(req.originalUrl,'http://localhost'),parts=url.pathname.split('/').filter(Boolean),isOpportunity=parts[2]==='content-opportunities'
 let b=obj(req.body)
 if('ownerId' in b||'workspaceId' in b||url.searchParams.has('workspaceId'))fail(400,'invalid_scope','工作区由已登录账号决定')
 if(req.is('multipart/form-data')&&parts[4]==='writing'&&parts[5]==='materials'&&req.method==='POST'){
  await record(db,s,'projects',projectId(numeric(parts[3])))
  const buffers:Buffer[]=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>25*1024*1024)fail(413,'file_too_large','项目素材最多 25 MiB');buffers.push(Buffer.from(part))}
  const data=await new Response(Buffer.concat(buffers),{headers:{'content-type':String(req.get('content-type'))}}).formData()
  const file=data.get('file');if(!file||typeof file==='string')fail(400,'file_required','请选择文件')
  const incoming=Object.assign(Readable.from([Buffer.from(await file.arrayBuffer())]),{originalUrl:'/api/workspace/studio/uploads',headers:{'x-studio-filename':encodeURIComponent(file.name),'content-length':String(file.size)}}) as unknown as Request
  const saved=await upload(s,incoming),material=obj(saved.material)
  b={title:txt(data.get('title'),file.name)||file.name,studioMaterialId:material.id,assetKey:saved.assetKey,transcript:txt(obj(material.transcript).corrected)}
 }
 return projectScope(req,s,isOpportunity,parts.slice(3),b)
}
export async function handoff(s:Scope,id:string,body:Data,confirm:boolean){
 return db.$transaction(async tx=>{
  const r=await record(tx,s,'drafts',id),d=obj(r.data);if(Number(body.expectedVersion)!==r.version)conflict()
  if(d.status!=='finalized')fail(400,'finalize_first','请先定稿')
  const target=body.targetProjectId?await record(tx,s,'projects',projectId(numeric(String(body.targetProjectId)))):null
  const master=obj(obj(target?.data).masterScript),title=txt(d.title),content=txt(d.body),expectedMasterVersion=Number(master.version)||0
  const sourceDigest=createHash('sha256').update(JSON.stringify([id,r.version,title,content])).digest('hex')
  const preview={draftVersion:r.version,expectedMasterVersion,targetProjectId:target?Number(target.id.slice(8)):null,title,body:content,sourceDigest}
  if(!confirm)return {preview};if(!body.confirmed||body.sourceDigest!==sourceDigest||Number(body.expectedMasterVersion)!==expectedMasterVersion)conflict()
  const p=target||await createProject(tx,s,{title,sourceDraftId:id})
  await setMaster(tx,s,p,{action:'save',title,body:content,expectedVersion:expectedMasterVersion})
  const linked=Number(p.id.slice(8));await change(tx,s,'drafts',id,{expectedVersion:r.version},'save',{projectId:linked})
  await tx.studioRecord.create({data:{workspaceId:s.workspaceId,kind:'adoptions',data:{projectId:linked,draftId:id,draftVersion:r.version,sourceDigest,title,masterVersion:expectedMasterVersion+1}}});return {projectId:linked}
 })
}
