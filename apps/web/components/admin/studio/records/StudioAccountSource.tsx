'use client'
import { Field } from '../StudioUI'
import { type RecordData } from '../studio-client'
import s from '../StudioWorkbench.module.css'
export function StudioAccountSource({busy,patch}:{form:RecordData;busy:boolean;patch:(key:string,value:unknown)=>void}) {
 return <><Field label="此账号的采集来源"><select aria-label="此账号的采集来源" value="local" disabled={busy} onChange={()=>patch('source','local')}><option value="local">本地收录</option></select></Field>
 <p className={s.meta}>可以保存博主主页、关联作品与备注。</p></>
}
