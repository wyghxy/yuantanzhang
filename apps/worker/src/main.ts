import {personalDatabase,configureSqlite} from '../../../prisma/sqlite-runtime.cjs'
import {runOne} from './queue'

const db=personalDatabase()
let stopping=false,wake:(()=>void)|undefined
function stop(){stopping=true;wake?.()}
process.once('SIGTERM',stop);process.once('SIGINT',stop)
function idle(ms:number){return new Promise<void>(done=>{
  const finish=()=>{clearTimeout(timer);wake=undefined;done()}
  const timer=setTimeout(finish,ms);wake=finish
})}
async function main(){
  await configureSqlite(db)
  if(process.argv.includes('--once')){const handled=await runOne(db);console.log(handled?'已处理一个本地任务':'没有可领取的本地任务');return}
  console.log('个人工作台本地文字任务已就绪')
  while(!stopping){
    try{if(!await runOne(db)&&!stopping)await idle(500)}
    catch(error){console.error('本地任务暂未完成：',error instanceof Error?error.message:'无法访问数据库');if(!stopping)await idle(1000)}
  }
}
void main().catch(err=>{console.error(err instanceof Error?err.message:'本地任务服务启动失败');process.exitCode=1}).finally(()=>db.$disconnect())
