import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { Prisma,PrismaClient } from '@prisma/client'
import { clearDemoData } from './demo-data'
const db=new PrismaClient()
const examples=[
  {label:'巷口的晨光',account:'巷口观察簿',cover:'morning-light',platform:'douyin',title:'上班前，我在同一条巷子拍了三次晨光',topic:'同一个机位，如何用光线讲一个故事',notes:'以具体时间作为线索，把微小变化留给观众自己观察。',paragraphs:['七点十分，巷口还没有直射光。我在门框上记下机位，让第一张照片留下阴影的边界。','七点二十七分，第一束光先碰到蓝色窗沿。我没有换位置，而是等路过的自行车穿过亮处。','第三次按下快门时，半面墙已经亮了。把三张照片并排，时间就有了形状。'],draft:['明早出门时，选一处你每天都经过的墙。','别急着找新角度。把手机留在同一个位置，等光向前走一步。','拍下第一张和最后一张。把它们放在一起，你会看见这一刻改变了什么。']},
  {label:'窗台种植',account:'窗台小实验',cover:'balcony-herbs',platform:'xiaohongshu',title:'一把小葱，七天后长高了多少？',topic:'记录比印象更可靠：一次窗台观察',notes:'先交代测量办法，再比较前后两次记录，避免把一次观察写成普遍规律。',paragraphs:['第一天，我把重新生根的小葱放在窗边，用纸条标出叶尖的位置。','第四天，我发现最长的一根朝玻璃弯过去。只看照片，很容易把弯曲当成变矮。','第七天我用同一把尺再量了一次。它比第一天高了两厘米，这是这盆小葱的记录。'],draft:['把冰箱里带根的小葱留下一根，插进小杯。','每天只做一件事：在同一个角度拍张照。','七天过去了，把第一张和第七张并排，再决定你想说什么。']},
  {label:'读书笔记',account:'散页读书室',cover:'reading-notes',platform:'bili',title:'读书会散场以后，我只留下三行笔记',topic:'把一场读书会写成别人能读的短稿',notes:'先描述散场后的困惑，再把三个问题落在可复用的写作结构上。',paragraphs:['读书会散场的时候，我的笔记密密麻麻，却没有一句话说清自己被什么打动了。','我另起一页，只写三个问题：哪句话让我停下来？谁的理解跟我不同？我还想查哪件事？','第二天我只看这一页，就能把讨论讲给没到场的朋友。三行不是结论，而是回去读的入口。'],draft:['昨晚听了两个小时的讨论，回家却不知道怎么复述。','我划掉一串书名，留下三句话：记得什么，不同意什么，还想弄明白什么。','下次带走的不是更厚的笔记，而是一条能接着读的问题。']},
]
async function main(){
 const w=await db.workspace.findFirst({where:{owner:{singleton:1}}});if(!w)throw Error('请先初始化个人账号')
 if(process.argv.includes('--clear')){
   console.log(`已清除 ${await clearDemoData(db,w.id)} 条演示资料，个人资料保留。`)
   return
 }
 await db.$transaction(async tx=>{
   const changed=await tx.workspace.updateMany({where:{id:w.id,demoInitialized:false},data:{demoInitialized:true}})
   if(!changed.count){console.log('工作区已初始化，保留现有数据。');return}
   const add=async(kind:string,data:Prisma.InputJsonObject)=>{
     const id=randomUUID(), row=await tx.studioRecord.create({data:{id,kind,workspaceId:w.id,sample:true,data}})
     await tx.recordVersion.create({data:{recordId:id,version:1,data}});return row.id
   }
   const identity=await add('identities',{name:'演示 · 生活观察者',title:'演示 · 生活观察者',positioning:'用实物和场景讲清一件小事',audience:'喜欢观察日常细节的读者',tone:'直接、具体、温和',status:'active'})
   for(const e of examples){const image='/demo/'+e.cover+'.svg',title='演示 · '+e.title
     const account=await add('accounts',{name:'演示 · '+e.account,displayName:'演示 · '+e.account,title:'演示 · '+e.account,platform:e.platform,enabled:true,status:'active',description:'虚构的个人工作台演示账号，没有绑定真实账号。',avatarUrl:image,tags:[e.label]})
     const body=e.paragraphs.join('\n\n')
     const analysis={summary:e.notes,points:[{label:'开头钩子',text:e.paragraphs[0],paragraphIds:[1]},{label:'内容承诺',text:e.notes,paragraphIds:[1]},{label:'结构节奏',text:'第一段提出问题，第二段增加观察，第三段回到最初的提问。',paragraphIds:[1,2,3]}],breakdown:{hook:{type:'场景引入',reason:e.notes,paragraphIds:[1]},sourceEvidence:{version:1,totalParagraphs:3,paragraphs:e.paragraphs.map((text,i)=>({id:i+1,text}))},lineByLine:e.paragraphs.map((text,i)=>({sentence:text,role:['开场','展开','收束'][i],reason:i===0?e.notes:'承接上段的实际观察。',paragraphIds:[i+1]}))},reusable:['从具体场景起笔','用可观察的变化连接段落'],angles:[e.topic],stale:false,version:1}
     const material=await add('materials',{title,description:e.notes,platform:e.platform,accountId:account,accountName:'演示 · '+e.account,author:'演示 · '+e.account,coverUrl:image,cover:image,imageUrl:image,contentType:'article',status:'ready',readState:'unread',tags:[e.label,'实操'],transcript:{raw:body,corrected:body,source:'manual',version:1},analysis})
     const topic=await add('topics',{title:'演示 · '+e.topic,description:e.notes,materialId:material,references:[{materialId:material}],status:'writing',tags:[e.label]})
     await add('drafts',{title:'演示 · '+e.topic,body:e.draft.join('\n\n'),topicId:topic,materialId:material,references:[{materialId:material}],identityId:identity,status:'draft',notes:e.notes})
   }
   await add('ideas',{title:'演示 · 把一天中的声音写成一段话',content:'从一个声音开始，写下听见它的时间和位置。',body:'从一个声音开始，写下听见它的时间和位置。',status:'idea'})
   console.log('已加入三个可编辑的演示案例。')
 })
}
void main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect())
