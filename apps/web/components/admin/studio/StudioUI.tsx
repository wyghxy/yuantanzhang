'use client'
import { useStudioPrivacy } from './StudioPrivacy'
import { privacyDetails } from './studio-privacy-model'
import { useEffect, useRef } from 'react'
import { X, Inbox, LoaderCircle } from 'lucide-react'
import { object, text, type RecordData } from './studio-client'
import s from './StudioWorkbench.module.css'
export function Platform({ value }: { value: unknown }) { const { platformLabel } = useStudioPrivacy(); const key = text(value,'local'); const style=({douyin:'dy',bilibili:'bili',bili:'bili',xiaohongshu:'xhs',youtube:'yt',wechat_official:'wx'} as Record<string,string>)[key]||''; return <span className={`badge ${style}`} data-platform={key}>{platformLabel(key)}</span> }
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className={s.empty}><Inbox size={28} strokeWidth={1.4} /><h3>{title}</h3>{children}</div> }
export function Busy() { return <div className={s.empty} role="status"><LoaderCircle size={24} className={s.spin} />正在读取…</div> }
export function Modal({ title, children, close, closeDisabled=false }: { title: string; children: React.ReactNode; close:()=>void; closeDisabled?:boolean }) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ const el=ref.current, previous=document.activeElement as HTMLElement|null; el?.showModal(); return ()=>{el?.close();if(previous?.isConnected)previous.focus()} },[])
  return <dialog ref={ref} className={`original-modal ${s.modal}`} onCancel={e=>{e.preventDefault();if(!closeDisabled)close()}} onClick={e=>{if(e.target===e.currentTarget&&!closeDisabled)close()}} aria-label={title}><header><h2>{title}</h2><button className="dialog-close-btn" aria-label="关闭弹窗" disabled={closeDisabled} onClick={()=>{if(!closeDisabled)close()}}><X size={20}/></button></header>{children}</dialog>
}
const labels: Record<string,string> = {hook:'开场钩子',audience:'目标受众',promise:'内容承诺',structure:'内容结构',evidence:'论据与案例',cta:'结尾行动',reusable:'可借鉴机制',avoid:'不能照搬',angle:'元探长切入点',source:'来源',sourceQuote:'原文依据',quote:'原文片段',text:'内容',title:'标题',description:'说明',reason:'原因',summary:'总结',sections:'段落',analysis:'内容拆解',sourceSegments:'原文段落',sourceVersion:'依据版本',warnings:'范围说明',limitations:'分析边界',missing:'缺少配置',status:'状态',message:'说明',phase:'当前步骤',model:'模型',timestamp:'时间',start:'开始',end:'结束',mechanism:'机制',explanation:'解读',reusableMechanisms:'可复用机制',cannotCopy:'不能照搬',suggestedAngles:'创作切入点',targetAudience:'目标受众',contentPromise:'内容承诺',openingHook:'开头钩子',callToAction:'结尾行动',scope:'分析范围' }
export function Details({ value, depth=0, privacyIdentity=false }: { value: unknown; depth?:number; privacyIdentity?:boolean }) {
  const { masked } = useStudioPrivacy()
  if (depth === 0 && masked) value = privacyDetails(value, privacyIdentity)
  if(value===null || value===undefined || value==='') return null
  if(typeof value==='boolean')return <span>{value?'是':'否'}</span>
  if(typeof value==='string'||typeof value==='number')return <p className={s.prose}>{String(value)}</p>
  if(depth>6) return <p>内容层级较多，请查看下载文件。</p>
  if(Array.isArray(value))return <div className={s.detailList}>{value.map((entry,i)=><div key={i}><Details value={entry} depth={depth+1}/></div>)}</div>
  return <dl className={s.details}>{Object.entries(object(value)).filter(([key])=>!['id','workspaceId','input','target','digest','sourceDigest','configDigest'].includes(key)).map(([key,entry])=><div key={key}><dt>{labels[key]||key}</dt><dd><Details value={entry} depth={depth+1}/></dd></div>)}</dl>
}
export function Field({ label, children }: {label:string; children:React.ReactNode}) {return <label className={s.field}><span>{label}</span>{children}</label>}
export function SourceLink({item}:{item:RecordData}) { const url=text(item.url);return /^https?:\/\//i.test(url)?<a href={url} target="_blank" rel="noreferrer">查看原链接 ↗</a>:null }
