import type {Request,Response} from 'express'
import { db,txt,obj,show,fail,known,singular,record,type Data,type Scope } from './shared'
import { create,change,list } from './records'
import { dashboard,prefs } from './views'
import { upload,download } from './files'
import { jobs,localCount,cancel } from './local-jobs'
import {handoff} from './projects'
import {roster} from './roster'
import {images} from './attachments'
import {groups,profile} from './relationships'
import {collectorSettings,runCollector} from './local-collector'
import {recognizeLink} from './links'
function sendExport(res:Response,data:Data,format:string){
  const md=String(data.body||data.text||obj(data.transcript).corrected||data.description||'')
  res.type(format==='json'?'application/json':'text/plain; charset=utf-8');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(String(data.title||'导出文稿')+(format==='json'?'.json':'.md')))
  res.send(format==='json'?JSON.stringify(data,null,2):md)
}
export async function route(req:Request,res:Response,s:Scope){
  const path=new URL(req.originalUrl,'http://localhost'),q=path.searchParams
  const parts=path.pathname.replace(/^\/api\/workspace\/studio\/?/,'').split('/').filter(Boolean).map(x=>decodeURIComponent(x))
  const [resource,id,action]=parts,method=req.method,body=obj(req.body)
  if('workspaceId' in body||'ownerId' in body||q.has('workspaceId')||q.has('ownerId'))fail(400,'invalid_scope','工作区由已登录账号决定')
  if(resource==='dashboard'&&method==='GET')return dashboard(s)
  if(resource==='local-collector'&&parts.length===1&&['GET','PATCH'].includes(method))return collectorSettings(s,method==='PATCH'?body:undefined)
  if(resource==='local-collector'&&parts.length===2&&id==='run'&&method==='POST')return runCollector(s,body)
  if(resource==='links'&&method==='POST'&&!id)return recognizeLink(body)
  if(resource==='roster-imports')return roster(s,id,action,method,body,q)
  if(resource==='source-images'&&['POST','PATCH'].includes(method))return images(req,s,q)
  if(resource==='associations')return groups(s,id,action,method,body,q)
  if(resource==='profile'&&['GET','PATCH'].includes(method))return profile(s,method==='PATCH'?body:undefined)
  if(resource==='adoptions'&&method==='GET'){const rows=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},kind:'adoptions',deletedAt:null},orderBy:{createdAt:'desc'}});const items=rows.map(show).filter(row=>!q.has('projectId')||String(obj(row).projectId)===q.get('projectId'));return {items,adoptions:items,total:items.length}}
  if(resource==='preferences'&&['GET','PATCH'].includes(method))return prefs(s,method==='GET'?undefined:body)
  if(resource==='recommendations'&&method==='GET'){
    const {recommendations:r}=await dashboard(s), cat=q.get('category')||'recommended'
    const rows=r[cat as keyof typeof r]||r.recommended,offset=Math.max(0,Number(q.get('offset'))||0),limit=Math.min(100,Math.max(1,Number(q.get('limit'))||12))
    return {items:rows.slice(offset,offset+limit),total:rows.length,hasMore:offset+limit<rows.length}
  }
  if(resource==='tasks'&&method==='GET')return jobs(s,id,action,q)
  if(resource==='tasks'&&method==='POST'&&action==='cancel')return cancel(s,id)
  if(resource==='local-word-count'&&method==='POST'&&!id)return localCount(s,body)
  if(resource==='demo'&&((method==='DELETE'&&!id)||(id==='clear'&&method==='POST'))){
    const cleared=await db.$transaction(async tx=>{await tx.workspace.update({where:{id:s.workspaceId},data:{demoInitialized:true}});return (await tx.studioRecord.deleteMany({where:{workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},sample:true}})).count});return {cleared}
  }
  if(resource==='uploads'&&method==='POST'&&!id)return upload(s,req)
  if(resource==='assets'&&id&&method==='GET'&&(!action||action==='download')){await download(s,id,res);return}
  const k=known(resource)
  if(!id&&method==='GET'){const page=await list(s,k,q);return {...page,[k]:page.items}}
  if(!id&&method==='POST'){const item=await db.$transaction(tx=>create(tx,s,k,body));res.status(201);return {item,id:item.id,[singular[k]]:item,duplicate:false,task:null,taskError:null}}
  if(!action&&id&&method==='GET'){const item=show(await record(db,s,k,id));return {item,[singular[k]]:item,...(k==='drafts'?{cacheScope:s}:{})}}
  if(!action&&id&&['PATCH','PUT','DELETE'].includes(method)){
    const expected=body.expectedVersion??q.get('expectedVersion'),item=await db.$transaction(tx=>change(tx,s,k,id,{...body,expectedVersion:expected},method==='DELETE'?'delete':'save'))
    return {item,[singular[k]]:item,deleted:method==='DELETE'}
  }
  if(action==='restore'&&method==='POST'){const item=await db.$transaction(tx=>change(tx,s,k,id,body,'restore'));return {item,[singular[k]]:item}}
  if(action==='history'&&method==='GET'){await record(db,s,k,id,true);return {history:await db.recordVersion.findMany({where:{recordId:id},orderBy:{version:'desc'}})}}
  if(k==='materials'&&action==='drafts'&&method==='GET'){await record(db,s,k,id);const rows=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,kind:'drafts',deletedAt:null},orderBy:{updatedAt:'desc'}});const items=rows.filter(r=>obj(r.data).materialId===id||(Array.isArray(obj(r.data).references)&&(obj(r.data).references as Data[]).some(ref=>ref.materialId===id))).map(show);return {items,drafts:items,total:items.length}}
  if(k==='materials'&&['article','comments','player'].includes(action)&&method==='GET'){
    const row=await record(db,s,k,id),data=obj(row.data)
    if(action==='article'){const text=txt(obj(data.transcript).corrected,txt(obj(data.transcript).raw)),paragraphs=text.split(/\n\s*\n/).filter(Boolean),escape=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return {materialId:id,title:data.title,author:data.author||'',publishedAt:data.publishedAt||null,status:text?'ready':'unavailable',html:paragraphs.map(p=>'<p>'+escape(p).replace(/\n/g,'<br>')+'</p>').join(''),body:text,text,paragraphs,source:txt(obj(data.transcript).source,'manual')}}
    if(action==='comments'){const saved=Array.isArray(data.comments)?data.comments:[];return {materialId:id,status:saved.length?'ready':'not_collected',comments:saved,items:saved,total:saved.length}}
    const file=await db.studioFile.findFirst({where:{workspaceId:s.workspaceId,recordId:id,mediaType:{startsWith:'video/'}},orderBy:{createdAt:'desc'}})
    return {materialId:id,status:file?'ready':'unavailable',url:file?'/api/workspace/studio/assets/'+file.id+'/download':null}
  }
  if(k==='accounts'&&method==='GET'&&['top5','materials','works'].includes(action)){await record(db,s,k,id);q.set('accountId',id);const page=await list(s,action==='works'?'works':'materials',q);if(action==='top5'){const metric=q.get('metric')||'likes',ranked=page.items.filter(r=>Number.isFinite(obj(obj(r).metrics)[metric])).sort((a,b)=>Number(obj(obj(b).metrics)[metric])-Number(obj(obj(a).metrics)[metric])).slice(0,5);return {items:ranked,total:ranked.length,metric}}return {...page,[action]:page.items}}
  if(action==='candidates'&&method==='GET'){await record(db,s,k,id);const rows=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},kind:'candidates',deletedAt:null}});return {candidates:rows.filter(row=>obj(row.data).materialId===id).map(show)}}
  if(k==='materials'&&['analysis','transcript'].includes(action)&&method==='GET'){const row=await record(db,s,k,id);return {[action]:obj(row.data)[action]||null,version:row.version,sourceMaterialId:id,sourceVersion:row.version,readOnly:false}}
  if(k==='drafts'&&action==='finalize'&&method==='POST'){const item=await db.$transaction(tx=>change(tx,s,k,id,{expectedVersion:body.expectedVersion,status:'finalized'}));return {item,draft:item}}
  if(k==='drafts'&&['handoff','handoff-preview'].includes(action)&&method==='POST')return handoff(s,id,body,action==='handoff')
  if(k==='ideas'&&action==='convert'&&method==='POST'){
    return db.$transaction(async tx=>{const idea=await record(tx,s,k,id), d=obj(idea.data)
      const item=await create(tx,s,'topics',{title:d.title,description:d.description||d.body||d.content||'',status:'idea'})
      const updated=await change(tx,s,k,id,{expectedVersion:body.expectedVersion,status:'adopted',topicId:item.id});return {item,topic:item,idea:updated}})
  }
  if(action==='export'&&method==='GET'){const item=show(await record(db,s,k,id));sendExport(res,item,q.get('format')||'md');return}
  fail(404,'not_found','未找到该本地功能')
}
