import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import { withIsolatedApi, localRequest } from './auth.integration'

type Data=Record<string,unknown>
type CollectorItem={url:string;title:string;text:string;author?:string;platform?:string}
type Behavior='success'|'redirect'|'error'|'malformed'|'many'|'oversize'|'hang'|'mixed'
async function main() {
 await withIsolatedApi('collector', async({base,web,start})=>{
  await start('local')
  const login=await localRequest(base,{origin:web})
  assert.equal(login.status,200)
  const cookie=login.setCookie.split(';')[0]
  const call=async(path:string,method='GET',body?:Data,expected=200)=>{
    const r=await fetch(base+'/api/workspace/studio/'+path,{method,headers:{cookie,origin:web,...(body?{'content-type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(35_000)})
    const data=await r.json()
    assert.equal(r.status,expected,path+' '+r.status+' '+(data.code||''))
    return data
  }
  const stamp=randomUUID(), source='https://source.example.invalid/post/'+stamp
  let selected:Behavior='success', redirected=0
  let respondTogether:((url:unknown)=>Promise<void>)|undefined
  let items:CollectorItem[]=[{url:source,title:'测试采集结果 '+stamp,text:'通过本机程序返回的正文 '+stamp,author:'测试作者',platform:'local'}]
  const calls:Array<{method?:string;body:Data;headers:IncomingHttpHeaders}>=[]
  // An actual loopback HTTP program. It treats source URLs as input data and never fetches them.
  const collector=createServer(async(req,res)=>{
    if(req.url==='/must-not-follow'){redirected++;res.end('unexpected redirect');return}
    if(!['/collect','/collect-v2'].includes(req.url||'')){res.writeHead(404);res.end();return}
    const chunks:Buffer[]=[]
    for await(const chunk of req)chunks.push(Buffer.from(chunk))
    let body:Data;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{res.writeHead(400);res.end();return}
    calls.push({method:req.method,body,headers:req.headers})
    if(respondTogether)await respondTogether(body.url)
    if(selected==='redirect'){res.writeHead(307,{location:'/must-not-follow'});res.end();return}
    if(selected==='hang')return
    res.setHeader('content-type','application/json')
    if(selected==='error'){res.writeHead(503);res.end('{"error":"fixture"}');return}
    if(selected==='malformed'){res.end('{not_json}');return}
    if(selected==='oversize'){
      res.write('{"items":[{"text":"');for(let i=0;i<34;i++)res.write('x'.repeat(64*1024))
      res.end('"}]}');return
    }
    const output=selected==='many'?Array.from({length:21},(_,i)=>({...items[0],url:source+'/'+i})):
      selected==='mixed'?[{...items[0],url:source+'/batch-first'},{url:'javascript:invalid',title:'无效项',text:'不写库'}]:items
    res.end(JSON.stringify({items:output}))
  })
  await new Promise<void>((ok,no)=>{collector.once('error',no);collector.listen(0,'127.0.0.1',ok)})
  const address=collector.address();assert.ok(address&&typeof address==='object')
  const endpoint='http://127.0.0.1:'+address.port+'/collect',settings='local-collector',run=settings+'/run'
  try{
   const initial=await call(settings)
   assert.equal(initial.configured,false);assert.equal(initial.endpoint,'')
   await call(run,'POST',{url:source},409)
   const patch=(endpoint:string,expectedVersion:number,status=200)=>call(settings,'PATCH',{endpoint,expectedVersion},status)
   for(const value of ['https://example.invalid/capture','http://127.0.0.2/capture','http://0.0.0.0/capture','http://localhost.example.invalid/capture',
     'http://tester@127.0.0.1/capture',endpoint+'?key=invalid',endpoint+'#invalid'])await patch(value,initial.version,400)
   const untouched=await call(settings);assert.equal(untouched.version,initial.version);assert.equal(untouched.configured,false)
   const saved=await patch(endpoint.replace('127.0.0.1','localhost'),initial.version)
   assert.equal(saved.configured,true);assert.equal(saved.endpoint,endpoint);assert.equal(saved.version,initial.version+1)
   await patch(endpoint+'-v2',initial.version,409)
   assert.equal((await call(settings)).endpoint,endpoint)
   assert.equal(calls.length,0,'查看或保存设置不联系本机程序')
   const account=(await call('accounts','POST',{name:'本机采集测试账号',platform:'local'},201)).item
   await call(run,'POST',{url:source,accountId:randomUUID()},404)
   assert.equal(calls.length,0,'无权引用账号时不联系采集程序')
   const materials=async()=>await call('materials?sample=all&limit=100')
   assert.equal((await materials()).total,0)
   const first=await call(run,'POST',{url:source,accountId:account.id})
   assert.equal(first.importedCount,1);assert.equal(first.duplicateCount,0)
   assert.equal(calls.length,1);assert.equal(calls[0].method,'POST');assert.equal(calls[0].body.version,1)
   assert.equal(calls[0].body.url,source);assert.equal((calls[0].body.account as Data).id,account.id)
   assert.equal((calls[0].body.account as Data).name,account.name);assert.equal(calls[0].headers.cookie,undefined);assert.equal(calls[0].headers.authorization,undefined)
   const list=await materials();assert.equal(list.total,1)
   const id=list.items[0].id, stored=(await call('materials/'+id)).item
   assert.equal(stored.title,items[0].title);assert.equal(stored.accountId,account.id);assert.equal(stored.sample,false)
   assert.ok(JSON.stringify(stored).includes(items[0].text),'收录内容须来自真实 HTTP 响应')
   const edited=(await call('materials/'+id,'PATCH',{title:'由用户改过的标题',expectedVersion:stored.version})).item
   const history=(await call('materials/'+id+'/history')).history.length
   items=[{...items[0],title:'不可覆盖人工修改',text:'不可覆盖已有原文'}]
   const duplicate=await call(run,'POST',{url:source,accountId:account.id})
   assert.equal(duplicate.importedCount,0);assert.equal(duplicate.duplicateCount,1)
   const preserved=(await call('materials/'+id)).item
   assert.equal(preserved.title,edited.title);assert.equal(preserved.version,edited.version)
   assert.equal((await call('materials/'+id+'/history')).history.length,history)
   for(const behavior of ['redirect','error','malformed','mixed','many','oversize','hang'] as const){
     selected=behavior;const attempts=calls.length
     await call(run,'POST',{url:source},behavior==='hang'?504:502)
     assert.equal(calls.length,attempts+1,'一次用户操作只发出一次本机请求')
     assert.equal((await materials()).total,1,behavior+'失败不应写入部分记录')
     assert.equal((await call('materials/'+id+'/history')).history.length,history)
   }
   assert.equal(redirected,0,'本机程序返回重定向不能跟随')
   const racing=source+'/race'
   selected='success';items=[{...items[0],url:racing,title:'并发采集',text:'同一来源只入库一次'}]
   let release=()=>{}, arrivals=0
   const both=new Promise<void>(ok=>{release=ok})
   const safety=setTimeout(release,5000)
   respondTogether=async url=>{if(url!==racing)return;if(++arrivals===2)release();await both}
   const simultaneous=await Promise.all([call(run,'POST',{url:racing}),call(run,'POST',{url:racing})]).finally(()=>{
     clearTimeout(safety);release();respondTogether=undefined
   })
   assert.equal(arrivals,2)
   assert.deepEqual(simultaneous.map(r=>r.importedCount).sort(),[0,1])
   assert.deepEqual(simultaneous.map(r=>r.duplicateCount).sort(),[0,1])
   const same=simultaneous[0].items[0]
   assert.equal(same.id,simultaneous[1].items[0].id)
   assert.equal((await call('materials/'+same.id+'/history')).history.length,1)
   assert.equal((await call('materials/'+same.id)).item.version,1)
   assert.equal((await materials()).total,2)
   let arrived=()=>{}, finish=()=>{}
   const seen=new Promise<void>(ok=>{arrived=ok}), wait=new Promise<void>(ok=>{finish=ok})
   respondTogether=async()=>{arrived();await wait}
   const obsolete=source+'/disconnected';items=[{...items[0],url:obsolete}]
   const pending=call(run,'POST',{url:obsolete},409)
   let timer:ReturnType<typeof setTimeout>|undefined
   const notified=new Promise<void>((_,no)=>{timer=setTimeout(()=>no(new Error('未收到延迟采集请求')),5000)})
   let disconnected
   try{await Promise.race([seen,notified]);disconnected=await patch('',saved.version)}
   finally{clearTimeout(timer);respondTogether=undefined;finish();await pending}
   const before=calls.length
   assert.equal(disconnected.configured,false);assert.equal(disconnected.endpoint,'')
   await call(run,'POST',{url:source},409);assert.equal(calls.length,before)
   assert.equal((await materials()).total,2)
   console.log('本机采集通过：配置默认空与版本冲突、仅本机地址、合法 HTTP 实际入库与账号关联、重复保留人工修改、并发同源只写一次、断开时拒绝旧结果、拒绝跳转、超时/超限/无效批次不写库、断开后不调用。')
  }finally{
    collector.closeAllConnections()
    await new Promise<void>((ok,no)=>collector.close(e=>e?no(e):ok()))
    await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie,origin:web},redirect:'error'})
  }
 })
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'采集验收失败');process.exitCode=1})
