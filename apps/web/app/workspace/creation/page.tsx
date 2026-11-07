import {cookies} from 'next/headers'
import CreationDesk from '@/components/admin/CreationDesk'
import {RadarPageTitle} from '@/components/admin/RadarUI'
export const dynamic='force-dynamic'
export default async function CreationPage(){
 const jar=await cookies(),r=await fetch(`${process.env.API_ORIGIN || 'http://127.0.0.1:3311'}/api/workspace/content-projects`,{headers:{cookie:jar.toString()},cache:'no-store'})
 if(!r.ok)throw new Error('内容项目未能读取，请重试。')
 const {projects,sources,clusters,opportunities}=await r.json()
 return <div className="personal-projects"><RadarPageTitle eyebrow="CREATION" title="创作工作台" description="把选题灵感写成自己的口播文案，继续编辑、定稿与拍摄。"/><CreationDesk sources={sources||[]} clusters={clusters||[]} opportunities={opportunities||[]} projects={projects||[]}/></div>
}
