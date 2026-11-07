import { object, text, type RecordItem } from './studio-client'

export const originalNavigation = [['overview','情报中心'],['topics','创作中心'],['accounts','对标账号'],['works','采集仓库']] as const
export const originalPlatforms = [['douyin','抖音','dy','抖'],['bili','B站','bili','B'],['xiaohongshu','小红书','xhs','红'],['youtube','YouTube','yt','YT'],['tiktok','TikTok','tk','TK'],['wechat_official','公众号','wechat','公'],['wechat_channels','视频号','channels','视'],['kuaishou','快手','kuaishou','快']] as const
export function originalLocation(params: Pick<URLSearchParams, 'get'>, preview = false) {
  const aliases: Record<string,string> = { dashboard:'overview',creators:'accounts',videos:'works',home:'schedule',logs:'tasks' }
  const requested=params.get('view')||'overview', view=preview&&['skills','islands'].includes(requested)?'overview':aliases[requested]||requested
  
  return { view:params.get('draft')?'drafts':params.get('material')?(view==='works'?'works':'feed'):['overview','feed','topics','accounts','works','drafts','tasks','pending','schedule','reports','capabilities'].includes(view)?view:'overview', material:params.get('material')||'', draft:params.get('draft')||'' }
}
export function originalRangeStart(range:string, now=Date.now()) {
  if(range==='all')return ''
  if(range==='today')return new Date(`${new Date(now+8*3600000).toISOString().slice(0,10)}T00:00:00+08:00`).toISOString()
  return new Date(now-(range==='3d'?3:7)*86400000).toISOString()
}
export function originalDuration(value:unknown) {
  const seconds=Number(value);if(!Number.isFinite(seconds)||seconds<=0)return ''
  const whole=Math.round(seconds),minutes=Math.floor(whole/60)
  return minutes>=60?`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}:${String(whole%60).padStart(2,'0')}`:`${minutes}:${String(whole%60).padStart(2,'0')}`
}
export function originalFeedGroups(items:RecordItem[]) {
  const groups=new Map<string,RecordItem[]>()
  for(const row of items){
    const value=row.expandable_topics??object(row.analysis).expandableTopics??object(row.analysis).topics
    let topics:unknown[]=[]
    if(Array.isArray(value))topics=value
    else if(typeof value==='string'){try{const parsed:unknown=JSON.parse(value);topics=Array.isArray(parsed)?parsed:[value]}catch{topics=value.split(/[,，\n]/)}}
    const first=topics[0],topic=typeof first==='string'?first:text(object(first).title)
    const key=topic?.trim()||text(row.author||row.creator_name,'未标注话题')
    groups.set(key,[...(groups.get(key)||[]),row])
  }
  return [...groups]
}
