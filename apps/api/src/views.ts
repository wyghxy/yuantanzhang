import { db,obj,txt,show,fail,conflict,version,json,type Scope,type Data } from './shared'
export async function prefs(s:Scope,body?:Data) {
  const where={id:s.workspaceId,ownerId:s.ownerId}
  let ws=await db.workspace.findFirstOrThrow({where})
  if(body){
    const data={...obj(ws.preferences)}
    if(body.quote!==undefined){if(typeof body.quote!=='string'||body.quote.length>500)fail(400,'invalid_quote','文字过长');data.quote=body.quote.trim()}
    if(body.interests!==undefined){if(!Array.isArray(body.interests)||body.interests.length>12||body.interests.some(x=>typeof x!=='string'||x.length>40))fail(400,'invalid_interests','关注方向最多 12 个，每项 40 字');data.interests=body.interests}
    const changed=await db.workspace.updateMany({where:{...where,preferenceVersion:version(body.expectedVersion)},data:{preferences:json(data),preferenceVersion:{increment:1}}});if(!changed.count)conflict()
    ws=await db.workspace.findFirstOrThrow({where})
  }
  return {quote:'',interests:[] as string[],...obj(ws.preferences),version:ws.preferenceVersion}
}
export async function dashboard(s:Scope){
  const rows=await db.studioRecord.findMany({where:{workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},deletedAt:null},orderBy:{updatedAt:'desc'}})
  const counts:Record<string,number>={accounts:0,materials:0,topics:0,drafts:0,reports:0,ready:0,finalized:0,unread:0,continuing:0,ideas:0}
  const platforms:Record<string,number>={},accountPlatforms:Record<string,number>={}
  const now=Date.now(), daily=Array.from({length:28},(_,i)=>({date:new Date(now-(27-i)*864e5).toISOString().slice(0,10),count:0,transcribed:0,platforms:{} as Record<string,number>}))
  let words=0, transcripts=0
  const mats=rows.filter(r=>r.kind==='materials'), topics=rows.filter(r=>r.kind==='topics')
  const sampleCounts:Record<string,number>={},personalCounts:Record<string,number>={}
  for(const r of rows){const group=r.sample?sampleCounts:personalCounts;group[r.kind]=(group[r.kind]||0)+1
    if(r.kind in counts)counts[r.kind]++;const d=obj(r.data),p=txt(d.platform,'local')
    if(r.kind==='accounts')accountPlatforms[p]=(accountPlatforms[p]||0)+1
    if(r.kind==='topics'&&!['archived','done'].includes(txt(d.status)))counts.continuing++
    if(r.kind==='drafts'&&d.status==='finalized')counts.finalized++
    if(r.kind!=='materials')continue
    platforms[p]=(platforms[p]||0)+1;if(d.readState!=='read')counts.unread++
    const t=obj(d.transcript),body=txt(t.corrected,txt(t.raw))
    if(body.trim()){transcripts++;counts.ready++;words+=Array.from(body.replace(/\s/g,'')).length}
    const day=daily.find(x=>x.date===r.createdAt.toISOString().slice(0,10));if(day){day.count++;day.transcribed+=Number(!!body);day.platforms[p]=(day.platforms[p]||0)+1}
  }
  const ranges=Object.fromEntries([1,3,7].map(n=>{const days=daily.slice(-n),ps:Record<string,number>={};for(const d of days)for(const [p,num] of Object.entries(d.platforms))ps[p]=(ps[p]||0)+num;return [n,{total:days.reduce((k,d)=>k+d.count,0),platforms:ps,other:0}]}))
  const pref=await prefs(s),items=mats.map(r=>({...show(r),recommendationReason:r.sample?'演示素材':'最近收录的内容'}))
  const following=items.filter(r=>pref.interests.some(w=>JSON.stringify(r).includes(w))).map(x=>({...x,recommendationReason:'匹配关注方向'}))
  const high=mats.filter(r=>Number.isFinite(obj(obj(r.data).metrics).likes)).sort((a,b)=>Number(obj(obj(b.data).metrics).likes)-Number(obj(obj(a.data).metrics).likes)).map(show)
  const recentTopics=topics.slice(0,6).map(row=>{const data=obj(row.data), refs=Array.isArray(data.references)?data.references:data.materialId?[{materialId:data.materialId}]:[],materialIds=refs.map(ref=>obj(ref).materialId).filter(Boolean);return {...show(row),references:refs,materialIds,materialCount:materialIds.length}})
  return {counts,platforms,accountPlatforms,daily,ranges,compute:{words:transcripts?words:null,durationSeconds:null,tokens:null},recentMaterials:items.slice(0,8),unreadMaterials:mats.filter(r=>obj(r.data).readState!=='read').slice(0,6).map(show),recentTopics,recent:items.slice(0,8),tasks:rows.filter(r=>r.kind==='local_tasks').slice(0,12).map(show),sampleCounts,personalCounts,recommendations:{recommended:items,highLikes:high,practical:mats.filter(r=>obj(r.data).contentType==='tutorial'||Array.isArray(obj(r.data).tags)&&(obj(r.data).tags as string[]).includes('实操')).map(show),following}}
}
