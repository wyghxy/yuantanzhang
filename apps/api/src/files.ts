import { randomUUID } from 'node:crypto'
import { resolve, extname, basename,join } from 'node:path'
import { mkdir, open, unlink } from 'node:fs/promises'
import type {Request,Response} from 'express'
import { db,version,record,fail,type Scope } from './shared'
import {create,change} from './records'
const formats:Record<string,string>={'.md':'text/markdown','.txt':'text/plain','.srt':'text/plain','.vtt':'text/vtt','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.aac':'audio/aac','.flac':'audio/flac','.opus':'audio/ogg','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp'}
export const directory=()=>resolve(__dirname,'../../..',process.env.UPLOAD_DIR||'data/uploads')
export async function upload(s:Scope,req:Request){
  let name:string; try{name=basename(decodeURIComponent(String(req.headers['x-studio-filename']||'')).replace(/\\/g,'/'))}catch{fail(400,'invalid_filename','文件名编码无效')}
  if(!name||name.length>220||Array.from(name).some(c=>c.charCodeAt(0)<32))fail(400,'invalid_filename','文件名无效')
  const ext=extname(name).toLowerCase(), mediaType=formats[ext];if(!mediaType)fail(400,'unsupported_format','请选择文本、字幕、图片、音频或视频文件')
  const textual=mediaType.startsWith('text/'), max=textual?1024*1024:200*1024*1024
  const q=new URL(req.originalUrl,'http://localhost').searchParams,materialId=q.get('materialId'),expected=materialId?version(q.get('expectedVersion')):undefined
  if(materialId)await record(db,s,'materials',materialId)
  const length=Number(req.headers['content-length']);if(length>max)fail(413,'file_too_large','上传文件超过大小限制')
  const id=randomUUID(),dir=join(directory(),s.workspaceId);await mkdir(dir,{recursive:true,mode:0o700})
  const disk=join(dir,id);const fd=await open(disk,'wx',0o600);let bytes=0,keep=false
  const chunks:Buffer[]=[]
  try{
    try{for await(const raw of req){const part=Buffer.isBuffer(raw)?raw:Buffer.from(raw);bytes+=part.length;if(bytes>max)fail(413,'file_too_large','上传文件超过大小限制');await fd.writeFile(part);if(textual)chunks.push(part)}}finally{await fd.close()}
    if(!bytes||(Number.isFinite(length)&&bytes!==length))fail(400,'empty_upload','没有收到完整文件')
    let text:string|undefined
    if(textual){try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)).replace(/^\uFEFF/,'')}catch{fail(400,'invalid_utf8','文本文件须为 UTF-8 编码')}if(!text.trim())fail(400,'empty_text','文本没有正文')}
    const extra={assetKey:id,originalFilename:name,assetSize:bytes,mediaType,uploadSource:textual?'uploaded_text':'uploaded_media'}
    const item=await db.$transaction(async tx=>{const row=materialId?await change(tx,s,'materials',materialId,{expectedVersion:expected,...(text?{text}:{})},'save',extra):await create(tx,s,'materials',{title:name,platform:'local',contentType:textual?'article':mediaType.startsWith('image/')?'image':mediaType.startsWith('video/')?'video':'audio',...(text?{text}:{})},extra)
      await tx.studioFile.create({data:{id,workspaceId:s.workspaceId,recordId:row.id,name,mediaType,size:bytes}})
      if(row.sample){await tx.studioRecord.updateMany({where:{id:row.id,workspaceId:s.workspaceId,sample:true},data:{sample:false}});return {...row,sample:false,isSample:false}}
      return row})
    keep=true;return {item,material:item,assetKey:id,bytes,task:null,taskError:null,needsTranscription:!textual&&!mediaType.startsWith('image/')}
  }finally{if(!keep)await unlink(disk).catch(()=>{})}
}
export async function download(s:Scope,id:string,res:Response){
  if(!/^[a-f\d-]{36}$/i.test(id))fail(404,'not_found','文件不存在')
  const file=await db.studioFile.findFirst({where:{id,workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId}}})
  if(!file)fail(404,'not_found','文件不存在')
  const ownerRecord=await db.studioRecord.findFirst({where:{id:file.recordId,workspaceId:s.workspaceId,workspace:{ownerId:s.ownerId},deletedAt:null}})
  if(!ownerRecord)fail(404,'not_found','文件不存在')
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name));res.type(file.mediaType)
  return new Promise<void>((ok,no)=>res.sendFile(join(directory(),s.workspaceId,id),error=>error?no(error):ok()))
}
