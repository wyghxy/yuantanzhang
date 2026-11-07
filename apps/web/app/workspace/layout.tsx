import type {ReactNode} from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {PersonalShell} from '@/components/admin/AdminShell'
export const dynamic='force-dynamic'
export default async function WorkspaceLayout({children}:{children:ReactNode}) {
 const jar=await cookies()
 const res=await fetch('http://127.0.0.1:3311/api/auth/me',{headers:{cookie:jar.toString()},cache:'no-store'})
 if(res.status===401 || res.status===403)redirect('/login')
 if(!res.ok)throw new Error('无法读取当前个人工作区。')
 const data=await res.json()
 if(!data.user?.id)redirect('/login')
 return <PersonalShell user={data.user}>{children}</PersonalShell>
}
