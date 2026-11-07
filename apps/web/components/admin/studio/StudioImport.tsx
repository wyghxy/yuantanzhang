'use client'
import { isStudioPreview, requireStudioActivation } from './studio-preview'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, FileText, Upload, Check } from 'lucide-react'
import { api, object, text, errorText } from './studio-client'
import { Field, Modal, Platform } from './StudioUI'
import s from './StudioWorkbench.module.css'
import { uploadedMaterialNotice } from './StudioMaterialHelpers'
import { studioSavedCollectionNotice } from './studio-account-state'
import { useStudioLinkRecognition } from './useStudioLinkRecognition'
export default function StudioImport({initial,close,onCreated,onTask,notify}:{initial:string;close:()=>void;onCreated:(kind:string,id:string)=>void;onTask:(id:string)=>void;notify:(s:string)=>void}){
  const [mode,setMode]=useState('link'),[value,setValue]=useState(initial),[title,setTitle]=useState(''),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[strategy,setStrategy]=useState('default'),[enabled,setEnabled]=useState(true),[notes,setNotes]=useState('')
  const [followCreator,setFollowCreator]=useState(true),[uploadProgress,setUploadProgress]=useState<number|null>(null),xhr=useRef<XMLHttpRequest|null>(null)
  const [saved,setSaved]=useState<{kind:string;id:string}|null>(null)
  useEffect(()=>()=>xhr.current?.abort(),[])
  const performing=useRef(false)
  const {recognized,recognizing,resolveTask,recognitionError,recognize}=useStudioLinkRecognition(value,mode==='link',onTask)
  const perform=useCallback(async(fn:()=>Promise<void>)=>{if(performing.current)return;performing.current=true;setError('');setBusy(true);try{await fn()}catch(e){setError(errorText(e))}finally{performing.current=false;setBusy(false)}},[])
  async function save(){
    if(mode==='text'){
      const d=await api('materials','POST',{title:title||'原文素材',text:body,platform:'local',autoProcess:false})
      notify(d.duplicate?'已定位重复素材':'原文素材已保存');onCreated('materials',text(object(d.item).id));return
    }
    if(!recognized)throw new Error('请先识别链接')
    if(!['accounts','materials'].includes(text(recognized.detectedKind)))throw new Error('请等待有效的作品或主页识别结果')
    const kind=text(recognized.detectedKind)==='accounts'?'accounts':'materials'
    const d=await api(kind,'POST',{url:recognized.url,originalInput:value,...(kind==='accounts'?{name:title||undefined,notes,strategy,enabled}:{title:title||undefined,...(recognized.platform==='wechat_official'?{followCreator}:{})})})
    const id=text(object(d.item).id),task=object(d.task)
    // Keep the source and the real admission failure visible; saving a row alone
    // must not close this dialog and look like an accepted capture.
    if(d.taskError||['failed','blocked','cancelled'].includes(text(task.status))){
      setSaved({kind,id});throw new Error(studioSavedCollectionNotice(kind,d))
    }
    setSaved(null)
    if(task.id)onTask(text(task.id))
    notify(task.id?studioSavedCollectionNotice(kind,d):'已保存到个人工作台');onCreated(kind,id)
  }
  function upload(file:File){if(isStudioPreview()){try{requireStudioActivation()}catch(e){setError(errorText(e))}return}if(performing.current||resolveTask)return;const textFile=/\.(txt|md|srt|vtt)$/i.test(file.name);if(file.size>(textFile?1:200)*1024*1024){setError(textFile?'文本最大 1 MiB':'音视频最大 200 MiB');return}if(!file.size){setError('文件为空，请选择包含内容的素材');return}performing.current=true;setBusy(true);setError('');setUploadProgress(0);const request=new XMLHttpRequest();xhr.current=request;request.open('POST','/api/workspace/studio/uploads');request.setRequestHeader('X-Studio-Filename',encodeURIComponent(file.name));request.setRequestHeader('Content-Type',file.type||'application/octet-stream');request.upload.onprogress=e=>{if(e.lengthComputable)setUploadProgress(Math.round(e.loaded/e.total*100))};request.onload=()=>{performing.current=false;setBusy(false);try{const d=JSON.parse(request.responseText);if(request.status>=400)throw new Error(d.error||'上传未完成');if(d.task)onTask(text(object(d.task).id));const material=object(d.material||d.item);notify(uploadedMaterialNotice(d));onCreated('materials',text(material.id||d.materialId))}catch(e){setError(errorText(e))}};request.onerror=()=>{performing.current=false;setBusy(false);setError('上传中断，请检查网络后重试')};request.onabort=()=>{performing.current=false;setBusy(false);setUploadProgress(null);setError('已取消上传')};request.send(file)}
  return <Modal title="收集创作素材" close={close} closeDisabled={busy}><div className="studio-tabs" role="tablist" aria-label="导入方式">{[['link','链接',Link2],['text','粘贴原文',FileText],['upload','上传文件',Upload]].map(([key,label,Icon])=>{const I=Icon as typeof Link2;return <button className={`studio-tab ${mode===key?'active':''}`} role="tab" aria-selected={mode===key} key={String(key)} disabled={busy} onClick={()=>{setMode(String(key));setSaved(null)}}><I size={14} style={{display:'inline',marginRight:6}}/>{String(label)}</button>})}</div>
    {(error||recognitionError)&&<p role="alert" className={s.error}>{error||recognitionError}</p>}
    {saved&&<button className="btn ghost" disabled={busy} onClick={()=>onCreated(saved.kind,saved.id)}>查看已保存记录与处理方法</button>}
    {mode==='link'?<><Field label="作品分享文字、公众号文章或博主主页"><textarea disabled={busy} aria-label="分享链接" value={value} onChange={e=>{setValue(e.target.value);setSaved(null);setError('')}} placeholder="支持抖音、B站、小红书、YouTube、TikTok、公众号文章"/></Field><button className="btn ghost" disabled={busy||recognizing||!value.trim()} onClick={()=>{setError('');recognize()}}>{resolveTask?'正在还原短链接…':recognizing?'正在识别链接…':'识别链接'}</button>{(recognizing||resolveTask)&&<p className={s.meta} role="status">{resolveTask?'正在还原短链接，完成后会显示作品或博主信息。':'正在识别平台和链接类型…'}</p>}{recognized&&<div className={s.notice} style={{marginTop:16}}><Platform value={recognized.platform}/> {recognized.detectedKind==='accounts'?'博主主页':recognized.detectedKind==='unknown'?'短链接，等待还原':recognized.platform==='wechat_official'?'公众号文章':'单条作品'}{recognized.nativeId||recognized.id?<p>平台 ID：{text(recognized.nativeId||recognized.id)}</p>:null}<p>{text(recognized.url)}</p>{!resolveTask&&!recognizing&&['accounts','materials'].includes(text(recognized.detectedKind))&&<p role="status">链接已识别。确认{recognized.detectedKind==='accounts'?'添加对标博主':'保存素材'}后收录到本地。</p>}</div>}<Field label={recognized?.detectedKind==='accounts'?'博主名称':'素材标题'}><input disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></Field>{recognized?.platform==='wechat_official'&&<><label className={s.checkRow}><input disabled={busy} type="checkbox" checked={followCreator} onChange={e=>setFollowCreator(e.target.checked)}/>保存后关注所属公众号</label><p className={s.meta}>关注保存在本站。持续收集新文章可使用设置中的采集服务，或在公众号详情填写 RSS／Atom 订阅源；自动调度需另行启用。</p></>}{recognized?.detectedKind==='accounts'&&<><Field label="采集策略"><select disabled={busy} value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="default">字幕优先，缺少字幕时转写</option><option value="metadata">只采作品信息与指标</option><option value="media">完整媒体与逐字稿</option></select></Field><Field label="备注"><textarea disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)}/></Field><label className={s.checkRow}><input disabled={busy} type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>跟踪这个账号（自动调度需另行启用）</label></>}</>:mode==='text'?<><Field label="素材标题"><input disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="真实逐字稿或图文正文"><textarea disabled={busy} style={{minHeight:260}} value={body} onChange={e=>setBody(e.target.value)} placeholder="粘贴原始内容，来源会标为人工输入"/></Field></>:<><p className={s.prose}>上传音视频，或 UTF-8 文本文件。</p><Field label="选择文件（音视频 200 MiB；文本 1 MiB）"><input type="file" accept="audio/*,video/*,.txt,.md,.srt,.vtt" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.currentTarget.value=''}}/></Field>{uploadProgress!==null&&<><progress max={100} value={uploadProgress} aria-label="上传进度" style={{width:'100%'}}/><p>{uploadProgress===100?'已发送，正在保存文件…':`上传 ${uploadProgress}%`}</p>{busy&&<button className="btn ghost" onClick={()=>xhr.current?.abort()}>取消上传</button>}</>}</>}
    {mode!=='upload'&&<div className={s.actions}><button className="btn primary" disabled={busy||(mode==='link'?recognizing||!recognized||!['accounts','materials'].includes(text(recognized.detectedKind)):!body.trim())} onClick={()=>void perform(save)}><Check size={16}/>{busy?'正在处理…':recognized?.detectedKind==='accounts'?'添加对标博主':'保存素材'}</button><button className="btn ghost" disabled={busy} onClick={close}>取消</button></div>}
  </Modal>
}
