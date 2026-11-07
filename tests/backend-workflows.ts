import 'dotenv/config'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {resolve,join} from 'node:path'
import {unlink} from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'

const base=process.env.API_ORIGIN||'http://127.0.0.1:3311', db=new PrismaClient()
type Data=Record<string,unknown>
const obj=(v:unknown)=>v as Data, rows=(v:unknown)=>v as Data[]
const marker='验证-'+randomUUID(), own=new Set<string>(),ownFiles=new Set<string>()
let cookie='',wid=''
const ownId=(id:unknown)=>{assert.equal(typeof id,'string');own.add(id as string);return id as string}
const checks:string[]=[]
async function request(path:string,method='GET',body?:Data,expect=200){
 const r=await fetch(base+'/api/'+path,{method,headers:{cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
 const data=obj(await r.json());assert.equal(r.status,expect,path+' '+r.status+' '+String(data.error||''));return data
}
const studio=(p:string,m='GET',b?:Data,e=200)=>request('workspace/studio/'+p,m,b,e)
async function add(kind:string,data:Data){const item=obj((await studio(kind,'POST',{title:marker,...data},201)).item);ownId(item.id);return item}
async function main(){
 assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'仅允许本机验收')
 const dbUrl=new URL(process.env.DATABASE_URL||'');assert.ok(['127.0.0.1','localhost'].includes(dbUrl.hostname)&&['/ytz_personal_test','/ytz_personal'].includes(dbUrl.pathname),'仅允许专用个人版本机数据库')
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:process.env.PERSONAL_USERNAME,password:process.env.PERSONAL_PASSWORD})})
 assert.equal(login.status,200);cookie=(login.headers.get('set-cookie')||'').split(';')[0];assert.ok(cookie)
 wid=String(obj(obj(await login.json()).workspace).id)
 const a=await add('accounts',{name:marker}),m=await add('materials',{text:'一段<不能当作HTML>的手写原文。',accountId:a.id}),n=await add('materials',{text:'第二份手写素材。'})
 const article=await studio('materials/'+m.id+'/article');assert.match(String(article.html),/&lt;不能当作HTML&gt;/)
 const topic=await add('topics',{references:[{materialId:m.id}]}), draft=await add('drafts',{materialId:m.id,topicId:topic.id,body:'第一段写场景。\n\n第二段进行观察。'})
 const config={manuscriptDocument:{type:'doc',content:[{type:'paragraph',attrs:{id:'paragraph-1'},content:[{type:'text',text:'第一段写场景。',marks:[{type:'bold'}]}]}]}}
 const rich=obj((await studio('drafts/'+draft.id,'PATCH',{expectedVersion:draft.version,title:draft.title,body:draft.body,templateKey:'case',config})).draft)
 const reloaded=obj((await studio('drafts/'+draft.id)).draft);assert.equal(reloaded.templateKey,'case');assert.deepEqual(reloaded.config,config)
 assert.equal(obj(await studio('drafts/'+draft.id+'/export?format=json')).id,draft.id)
 const notes=obj((await studio('materials/'+m.id,'PATCH',{expectedVersion:1,notes:'手写笔记',noteAnnotations:[]})).item)
 const archive=obj((await studio('materials/'+n.id,'DELETE',{expectedVersion:1})).item);await studio('materials/'+n.id,'GET',undefined,404)
 const back=obj((await studio('materials/'+n.id+'/restore','POST',{expectedVersion:archive.version})).item);assert.equal(back.deletedAt,null)
 const noteHistory=await studio('materials/'+m.id+'/history');assert.ok(rows(noteHistory.history).find(x=>x.version===2))
 checks.push('手填原文与 HTML 转义、关联选题草稿、历史/回收站/导出')
 const preview=obj((await studio('associations/preview','POST',{materialIds:[m.id,n.id],primaryMaterialId:m.id})).preview)
 const linked=obj((await studio('associations/confirm','POST',{...preview,confirmed:true})).group);ownId(linked.id)
 const revoke=obj((await studio('associations/'+linked.id+'/revoke-preview','POST',{})).preview);await studio('associations/confirm','POST',{...revoke,confirmed:true})
 assert.equal(obj((await studio('materials/'+m.id)).item).materialAssociation,null);assert.ok(notes.notes)
 const planDraft=obj((await studio('drafts/'+draft.id,'PATCH',{expectedVersion:rich.version,draftPlanStart:{inputBody:draft.body}})).draft),plan=obj(planDraft.visualPlan), shot=rows(plan.shots)[0]
 const imageId=randomUUID(),picture=new URLSearchParams({draftId:String(draft.id),planId:String(plan.planId),shotId:String(shot.id),id:imageId,kind:'upload',filename:'test.png'})
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFkQAAAAASUVORK5CYII=','base64')
 const imageResponse=await fetch(base+'/api/workspace/studio/source-images?'+picture,{method:'POST',headers:{cookie,'content-type':'image/png'},body:png});assert.equal(imageResponse.status,200)
 const imagePayload=obj(await imageResponse.json()),assetKey=String(obj(imagePayload.image).assetKey);assert.match(assetKey,/^[a-f0-9-]{36}$/);ownFiles.add(assetKey)
 const range=await fetch(base+'/api/workspace/studio/assets/'+assetKey+'/download',{headers:{cookie,range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8)
 const privateFile=await fetch(base+'/api/workspace/studio/assets/'+assetKey+'/download');assert.equal(privateFile.status,401)
 picture.set('action','remove');await studio('source-images?'+picture,'PATCH',{})
 picture.set('action','restore');const restored=obj(await studio('source-images?'+picture,'PATCH',{}));assert.equal(obj(restored.image).deletedAt,null)
 checks.push('素材关联预览/确认/撤销，个人分镜图片上传、Range、鉴权、移除恢复')
 const source=obj((await studio('roster-imports/sources','POST',{title:marker,body:marker+' https://example.invalid/'+marker+'\n错误行'})).source);ownId('roster-source-'+source.id)
 const roster=obj((await studio('roster-imports/preview','POST',{sources:[{documentId:source.id,documentVersion:source.version}],mapping:{mode:'body_lines'},defaults:{enabled:false}})).preview);ownId(roster.id)
 const good=rows(roster.rows).find(x=>x.status==='ready');assert.ok(good);assert.ok(rows(roster.rows).some(x=>x.status==='failure'))
 const confirmed=obj((await studio('roster-imports/'+roster.id+'/confirm','POST',{expectedVersion:roster.version,confirmed:true,rowKeys:[good.key]})).preview)
 const newAccount=rows(confirmed.results)[0];assert.equal(newAccount.status,'success');ownId(newAccount.accountId)
 checks.push('纯文本名单逐行预览、非法行拒绝、本地保存账号')
 const opp=obj((await request('workspace/content-opportunities','POST',{title:marker,angle:'观察微小变化'})).opportunity);ownId('opportunity-'+opp.id)
 const pj=obj((await request('workspace/content-projects','POST',{title:marker,opportunityId:opp.id,mode:'writing'})).project);ownId('project-'+pj.id)
 const prefix='workspace/content-projects/'+pj.id
 const master=obj((await request(prefix+'/master-script','PATCH',{action:'save',title:marker,body:'观察、记录与比较。'.repeat(8),expectedVersion:0,facts:[],inferences:[],disputes:[]})).masterScript)
 await request(prefix+'/master-script','PATCH',{action:'save',body:'禁止覆盖',expectedVersion:0},409)
 const wm=obj((await request(prefix+'/writing/materials','POST',{title:marker,transcript:'项目内原文。'})).material)
 const corrected=obj((await request(prefix+'/writing/materials/'+wm.id,'PATCH',{expectedRevision:wm.revision,correctedTranscript:'项目内已校正文。'})).material);assert.equal(corrected.correctedTranscript,'项目内已校正文。')
 const state=await request(prefix+'/writing');assert.equal(obj(state.master).version,master.version);assert.ok(rows(state.history).length);assert.ok(rows(state.materials).length)
 const f=obj((await studio('drafts/'+draft.id)).draft),finalized=obj((await studio('drafts/'+draft.id+'/finalize','POST',{expectedVersion:f.version})).draft)
 const hand=obj((await studio('drafts/'+draft.id+'/handoff-preview','POST',{expectedVersion:finalized.version,targetProjectId:pj.id})).preview)
 await studio('drafts/'+draft.id+'/handoff','POST',{...hand,expectedVersion:finalized.version,confirmed:true})
 const adoptions=rows((await studio('adoptions?projectId='+pj.id)).items);assert.equal(adoptions.length,1);ownId(adoptions[0].id)
 assert.equal(obj(obj((await request(prefix)).project).masterScript).body,draft.body)
 checks.push('内容机会/项目、本地写作素材、母稿历史冲突、定稿交接及回执')
 if(process.env.VERIFY_PERSONAL_WORKER==='1'){
   const task=obj((await studio('local-word-count','POST',{kind:'drafts',id:draft.id})).task);ownId(task.id)
   let status:Data={}
   for(let i=0;i<45;i++){status=obj((await studio('tasks/'+task.id)).task);if(status.status==='succeeded'||status.status==='failed')break;await new Promise(r=>setTimeout(r,150))}
   assert.equal(status.status,'succeeded');assert.equal(status.characters,Array.from(String(draft.body).replace(/\s/g,'')).length)
   const {Queue}=await import('bullmq'),url=new URL(process.env.REDIS_URL||'redis://127.0.0.1:6397')
   const queue=new Queue('personal-local-text',{connection:{host:url.hostname,port:Number(url.port)||6379,username:url.username||undefined,password:url.password||undefined,db:Number(url.pathname.slice(1))||0}})
   try{await queue.remove(String(task.id))}finally{await queue.close()}
   checks.push('显式本地字数任务经 Redis/BullMQ 进入 Worker，结果按当前草稿版本保存')
 }
 console.log(JSON.stringify({ok:true,checks},null,2))
}
void main().finally(async()=>{
 try{
   if(wid&&own.size){await db.studioRecord.deleteMany({where:{workspaceId:wid,sample:false,id:{in:[...own]}}})
     for(const key of ownFiles)if(/^[a-f0-9-]{36}$/.test(key)&&/^[a-f0-9-]{36}$/.test(wid)){await unlink(join(resolve(process.env.UPLOAD_DIR||'data/uploads'),wid,key)).catch(()=>{})}
   }
   if(cookie)await request('auth/logout','POST',{})
 }finally{await db.$disconnect()}
}).catch(e=>{console.error(e instanceof Error?e.message:'工作流验证失败');process.exitCode=1})
