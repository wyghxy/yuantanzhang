'use client'
import Link from 'next/link'
import {useState} from 'react'
import {useSiteTheme} from '@/components/SiteTheme'
export default function Settings(){const {preference,setPreference}=useSiteTheme();const [note,setNote]=useState(''),[busy,setBusy]=useState(false)
 async function clear(){if(busy||!window.confirm('仅清除示例资料？你自己保存的记录会保留。'))return;setBusy(true);try{const r=await fetch('/api/workspace/studio/demo',{method:'DELETE'});if(!r.ok)throw new Error();setNote('示例资料已清除。')}catch{setNote('清理未完成，请重试。')}finally{setBusy(false)}}
 return <main className="personal-form"><h1>个人设置</h1><p>外观</p><div role="group" aria-label="外观">{([['light','浅色'],['dark','深色'],['system','跟随系统']] as const).map(([v,label])=><button key={v} aria-pressed={preference===v} onClick={()=>setPreference(v)}>{label}</button>)}</div><p>示例资料</p><button disabled={busy} onClick={clear}>清除示例资料</button>{note&&<p role="status">{note}</p>}<br/><Link href="/workspace/viral">返回工作台</Link></main>}
