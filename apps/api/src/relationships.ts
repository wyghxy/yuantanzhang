import {createHash} from 'node:crypto'
import {db,obj,txt,record,show,json,conflict,fail,type Scope,type Data} from './shared'
import { change } from './records'
const sha=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex')
const scopeWhere=(s:Scope)=>({workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},deletedAt:null})
export async function groups(s:Scope,id:string,action:string,method:string,b:Data,q:URLSearchParams){
 if(!id&&method==='GET'){const rows=await db.studioRecord.findMany({where:{...scopeWhere(s),kind:'groups'}});return {items:rows.map(show),groups:rows.map(show),total:rows.length}}
 if(id==='suggestions'&&method==='GET'){const target=await record(db,s,'materials',String(q.get('materialId')||'')),d=obj(target.data);const rows=await db.studioRecord.findMany({where:{...scopeWhere(s),kind:'materials',NOT:{id:target.id}},orderBy:{updatedAt:'desc'},take:100});const suggestions=rows.filter(r=>{const x=obj(r.data);return x.accountId&&x.accountId===d.accountId||x.title===d.title}).slice(0,10).map(r=>({...show(r),materialId:r.id,reason:'同一作者或相同标题'}));return {suggestions}}
 if(method!=='POST')fail(405,'invalid_method','不支持此关联操作')
 const revoke=action?.startsWith('revoke')||b.operation==='revoke',confirm=id==='confirm'||action==='revoke'
 if(!(id==='preview'||id==='confirm'||action==='revoke-preview'||action==='revoke'))fail(404,'not_found','关联操作不存在')
 return db.$transaction(async tx=>{
  const groupId=action?.startsWith('revoke')?id:txt(b.groupId), group=revoke?await record(tx,s,'groups',groupId):null
  const ids=group?obj(group.data).materialIds:b.materialIds
  if(!Array.isArray(ids)||ids.length<2||ids.length>12||new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'))fail(400,'invalid_members','需选择 2 至 12 条不同素材')
  const primary=group?txt(obj(group.data).primaryMaterialId):txt(b.primaryMaterialId)
  if(!ids.includes(primary))fail(400,'invalid_primary','主素材必须在所选素材内')
  const rows=[];for(const key of ids){const row=await record(tx,s,'materials',key);if(!group&&obj(row.data).materialAssociation)fail(409,'already_linked','素材已经有关联，请先解除当前关系');rows.push(row)}
  const operation=revoke?'revoke':'link',versions=rows.map(r=>({id:r.id,version:r.version})),digest=sha([operation,primary,versions,groupId])
  const preview={operation,groupId:groupId||null,materialIds:ids,primaryMaterialId:primary,versions,digest}
  if(!confirm)return {preview}
  if(b.confirmed!==true||b.digest!==digest)conflict()
  const link=group||await tx.studioRecord.create({data:{workspaceId:s.workspaceId,kind:'groups',data:json({...preview,title:'关联素材'})}})
  for(const r of rows){const association=revoke?null:{id:link.id,primaryMaterialId:primary,materialIds:ids};await change(tx,s,'materials',r.id,{expectedVersion:r.version},'save',{materialAssociation:association})}
  if(revoke)await tx.studioRecord.update({where:{id:link.id},data:{deletedAt:new Date()}})
  return {ok:true,group:show(link),materialIds:ids}
 })
}
export async function profile(s:Scope,b?:Data){
 const id='profile-'+s.workspaceId, current=await db.studioRecord.findFirst({where:{id,...scopeWhere(s),kind:'profile'}})
 const defaults={positioning:'',audience:'',cases:'',expressions:'',avoidExpressions:''}
 if(!b)return {...defaults,...obj(current?.data),version:current?.version||0}
 if(Number(b.expectedVersion)!==(current?.version||0))conflict()
 const data={...defaults,...obj(current?.data)};for(const key of Object.keys(defaults) as (keyof typeof defaults)[])if(key in b)data[key]=txt(b[key]).slice(0,20000)
 if(current){const changed=await db.studioRecord.updateMany({where:{id,...scopeWhere(s),version:current.version},data:{version:{increment:1},data:json(data)}});if(!changed.count)conflict()}
 else {try{await db.studioRecord.create({data:{id,workspaceId:s.workspaceId,kind:'profile',data:json(data)}})}catch(error){if(obj(error).code==='P2002')conflict();throw error}}
 return {...data,version:(current?.version||0)+1}
}
