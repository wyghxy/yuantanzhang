import type {ReactNode} from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {PersonalShell} from '@/components/admin/AdminShell'
import LocalWorkspaceEntry from '@/components/LocalWorkspaceEntry'
export const dynamic='force-dynamic'
export default async function WorkspaceLayout({children}:{children:ReactNode}) {
 const jar=await cookies()
 const res=await fetch(`${process.env.API_ORIGIN || 'http://127.0.0.1:3311'}/api/auth/me`,{headers:{cookie:jar.toString()},cache:'no-store'})
 const passwordProtected=(process.env.PERSONAL_AUTH_MODE||'local')==='password'
 if(res.status===401 || res.status===403){
   if(passwordProtected)redirect('/login')
   return <LocalWorkspaceEntry/>
 }
 if(!res.ok)throw new Error('无法读取当前个人工作区。')
 const data=await res.json()
 if(!data.user?.id)throw new Error('无法读取个人工作台。')
 return <PersonalShell user={data.user} passwordProtected={passwordProtected}>{children}</PersonalShell>
}
