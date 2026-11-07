import {randomInt} from 'node:crypto'
import { db,obj,txt,json,version,fail,conflict,record,type Scope,type Data } from './shared'
import {create} from './records'
const source=(id:number)=>'roster-source-'+id
function savedSource(r:{id:string;version:number;data:unknown}){const d=obj(r.data);return {id:Number(r.id.slice('roster-source-'.length)),version:r.version,title:d.title,body:d.body,sourceType:'text',bindings:[]}}
const publicPreview=(r:{id:string;version:number;data:unknown})=>({...obj(r.data),id:r.id,version:r.version})
function parseLine(input:string){const u=input.match(/https?:\/\/[^\s，,]+/i)?.[0];if(!u)return null
 let address:URL;try{address=new URL(u)}catch{return null}
 const host=address.hostname, platform=host==='b23.tv'||host.endsWith('.bilibili.com')?'bili':host==='youtu.be'||host.endsWith('youtube.com')?'youtube':host.includes('xiaohongshu')||host==='xhslink.com'?'xiaohongshu':host.includes('douyin')?'douyin':host.includes('kuaishou')?'kuaishou':'local'
 return {name:input.replace(u,'').replace(/[，,;|\s]+$/,'').trim()||address.pathname.split('/').filter(Boolean).pop()||host,url:address.href,platform}
}
export async function roster(s:Scope,id:string,op:string,method:string,b:Data,q:URLSearchParams){
 if(id==='sources'&&method==='GET'){const rows=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,kind:'roster_sources',deletedAt:null,workspace:{ownerId:s.ownerId}},orderBy:{updatedAt:'desc'}}), search=txt(q.get('q')).toLowerCase(),filtered=rows.map(savedSource).filter(r=>!search||JSON.stringify([r.title,r.body]).toLowerCase().includes(search)),offset=Math.max(0,Number(q.get('offset'))||0);return {items:filtered.slice(offset,offset+25),total:filtered.length}}
 if(id==='sources'&&method==='POST'){const title=txt(b.title).trim(),body=txt(b.body).trim();if(!title||title.length>200||!body||body.length>100000)fail(400,'invalid_roster','请填写标题和最多 10 万字的本地名单');const r=await db.studioRecord.create({data:{workspaceId:s.workspaceId,id:source(randomInt(1,2147483647)),kind:'roster_sources',data:{title,body}}});return {source:savedSource(r),item:savedSource(r)}}
 if(id==='preview'&&method==='POST')return db.$transaction(async tx=>{
   const selections=b.sources;if(!Array.isArray(selections)||!selections.length||selections.length>20)fail(400,'invalid_sources','请选择 1 至 20 份本地名单');if(obj(b.mapping).mode!=='body_lines')fail(400,'invalid_mapping','个人版支持按行读取本地名单')
   const rows:Data[]=[],seen=new Map<string,string>(),accounts=await tx.studioRecord.findMany({where:{workspaceId:s.workspaceId,kind:'accounts',deletedAt:null}})
   for(const selection of selections){const spec=obj(selection),rid=Number(spec.documentId),r=await record(tx,s,'roster_sources',source(rid));if(version(spec.documentVersion)!==r.version)conflict();const d=obj(r.data)
    for(const [i,v] of txt(d.body).split(/\r?\n/).entries()){const line=v.trim();if(!line)continue;if(rows.length>=250)fail(400,'too_many_rows','单次最多 250 行')
      const account=parseLine(line),key=rid+':'+(i+1),prior=account&&accounts.find(a=>account.url===obj(a.data).url),duplicateOf=account&&seen.get(account.url),status=!account?'failure':prior||duplicateOf?'duplicate':'ready'
      rows.push({key,documentId:rid,documentVersion:r.version,sourceTitle:d.title,line:i+1,originalInput:line,status,account,existingAccountId:prior?.id||null,duplicateOf:duplicateOf||null,requiresResolution:false,error:account?null:{code:'invalid_url',message:'这一行没有可保存的 http 或 https 链接'}});if(account&&!seen.has(account.url))seen.set(account.url,key)
    }
   }
   const r=await tx.studioRecord.create({data:{workspaceId:s.workspaceId,kind:'roster_imports',data:json({status:'preview_ready',rows,results:[],defaults:{enabled:obj(b.defaults).enabled===true,notes:txt(obj(b.defaults).notes)},total:rows.length})}});return {preview:publicPreview(r)}
 })
 if(id&&method==='GET')return {preview:publicPreview(await record(db,s,'roster_imports',id))}
 if(id&&op==='confirm'&&method==='POST')return db.$transaction(async tx=>{
   const r=await record(tx,s,'roster_imports',id), d=obj(r.data)
   if(version(b.expectedVersion)!==r.version||d.status!=='preview_ready')conflict()
   const keys=b.rowKeys;if(b.confirmed!==true||!Array.isArray(keys)||!keys.length)fail(400,'select_rows','请选择并确认要保存的行')
   const rows=Array.isArray(d.rows)?d.rows.map(obj):[];if(keys.some(k=>!rows.some(x=>x.key===k&&x.status!=='failure')))fail(400,'invalid_rows','选择中包含无效行')
   const results:Data[]=[]
   for(const row of rows.filter(x=>keys.includes(x.key))){const a=obj(row.account),existing=await tx.studioRecord.findFirst({where:{workspaceId:s.workspaceId,kind:'accounts',deletedAt:null,data:{path:['url'],equals:txt(a.url)}}})
     if(existing){results.push({rowKey:row.key,status:'duplicate',accountId:existing.id});continue}
     const account=await create(tx,s,'accounts',{...a,...obj(d.defaults)});results.push({rowKey:row.key,status:'success',accountId:account.id})
   }
   const changed=await tx.studioRecord.updateMany({where:{id:r.id,workspaceId:s.workspaceId,version:r.version},data:{version:{increment:1},data:json({...d,rowKeys:keys,results,status:'completed',canRetry:false})}});if(!changed.count)conflict()
   return {preview:publicPreview(await record(tx,s,'roster_imports',id))}
 })
 fail(404,'not_found','未找到该本地名单操作')
}
