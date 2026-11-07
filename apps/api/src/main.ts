import 'reflect-metadata'
import {resolve} from 'node:path'
import {config} from 'dotenv'
import { All, Controller, Get, HttpException, Module, Post, Req, Res } from '@nestjs/common'
import {NestFactory} from '@nestjs/core'
import { json as readJson, type Request,type Response } from 'express'
import { scope,identity,login,localLogin,logout,checkSecret,authenticationMode } from './auth'
import { db } from './shared'
import { configureSqlite } from '../../../prisma/sqlite-runtime.cjs'
import {route} from './studio'
import {projectRoute} from './projects'
config({path:resolve(__dirname,'../../..','.env'),quiet:true})
@Controller('api')
class ApiController {
 @Get('health') async health(){await db.$queryRaw`SELECT 1`;return {status:'ok'}}
 @Get('auth/me') me(@Req() req:Request){return identity(req)}
 @Post('auth/local') async local(@Req() req:Request,@Res() res:Response){res.status(200).json(await localLogin(req,res))}
 @Post('auth/login') async login(@Req() req:Request,@Res() res:Response){res.status(200).json(await login(req,res))}
 @Post('auth/logout') async logout(@Req() req:Request,@Res() res:Response){res.status(200).json(await logout(req,res))}
 @All('workspace/studio/{*path}') async studio(@Req() req:Request,@Res() res:Response){const data=await route(req,res,await scope(req));if(!res.headersSent)res.json(data)}
 @All(['workspace/content-projects','workspace/content-projects/{*path}','workspace/content-opportunities','workspace/content-opportunities/{*path}']) async projects(@Req() req:Request){return projectRoute(req,await scope(req))}
}
@Module({controllers:[ApiController]})class App{}
async function main(){
 authenticationMode()
 checkSecret()
 await configureSqlite(db)
 const app=await NestFactory.create(App,{bodyParser:false})
 const webPort=process.env.WEB_PORT||'3310',apiPort=process.env.API_PORT||'3311'
 const allowedOrigins=new Set([
   new URL(`http://127.0.0.1:${webPort}`).origin,new URL(`http://localhost:${webPort}`).origin,
   new URL(`http://127.0.0.1:${apiPort}`).origin,process.env.WEB_ORIGIN,process.env.API_ORIGIN,
 ])
 app.use((req:Request,res:Response,next:()=>void)=>{
   res.setHeader('Cache-Control','private, no-store')
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){
      let origin:URL;try{origin=new URL(req.headers.origin)}catch{res.status(403).json({error:'来源无效'});return}
      if(!allowedOrigins.has(origin.origin)){res.status(403).json({error:'不接受跨站写入'});return}
   }
   next()
 })
 app.use(readJson({limit:'2mb'}))
 app.enableShutdownHooks()
 app.getHttpAdapter().getInstance().disable('x-powered-by')
 await app.listen(Number(process.env.API_PORT||3311),process.env.API_HOST||'127.0.0.1')
}
void main().catch(e=>{console.error(e instanceof HttpException?e.message:String(e));process.exitCode=1})
