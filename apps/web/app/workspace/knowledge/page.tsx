'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {api,errorText} from '@/components/admin/studio/studio-client'
type Source={id:number;title:string;version:number}
export default function Sources(){const [rows,setRows]=useState<Source[]>([]),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('')
 const load=()=>api('roster-imports/sources').then(data=>setRows((data.items||[]) as Source[]))
 useEffect(()=>{void load().catch(e=>setNote(errorText(e)))},[])
 async function save(){setBusy(true);setNote('');try{await api('roster-imports/sources','POST',{title:title.trim(),body:body.trim()});setBody('');setTitle('');await load();setNote('名单已保存，可在对标中心预览并导入。')}catch(e){setNote(errorText(e))}finally{setBusy(false)}}
 return <main className="personal-form" style={{maxWidth:640,margin:'4vh auto',maxHeight:'90vh',overflow:'auto'}}><h1>知识沉淀连接管理</h1><h2>本地名单来源</h2><form onSubmit={e=>{e.preventDefault();void save()}}><label>名单名称<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>逐行主页链接<textarea required rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="每行一个博主主页链接"/></label><button disabled={busy||!title.trim()||!body.trim()}>保存名单</button></form>{note&&<p role="status">{note}</p>}<ul>{rows.map(x=><li key={x.id}>{x.title} · v{x.version}</li>)}</ul><Link href="/workspace/viral?view=accounts">返回对标中心</Link></main>
}
