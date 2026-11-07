import 'dotenv/config'
import {personalDatabase,configureSqlite} from '../prisma/sqlite-runtime.cjs'
import bcrypt from 'bcryptjs'
const db = personalDatabase()
async function main(){
  await configureSqlite(db)
  if(await db.personalUser.findUnique({where:{singleton:1}})){console.log('个人账号已初始化。');return}
  const username=(process.env.PERSONAL_USERNAME||'').trim(),password=process.env.PERSONAL_PASSWORD||''
  if(!username || username.length>100 || password.length<12 || Buffer.byteLength(password)>72)throw Error('请设置 PERSONAL_USERNAME 并提供至少 12 个字符且不超过 72 字节的 PERSONAL_PASSWORD')
  const passwordHash=await bcrypt.hash(password,12)
  await db.personalUser.create({data:{username,passwordHash,workspace:{create:{}}}})
  console.log('个人账号和工作区已初始化。')
}
void main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect())
