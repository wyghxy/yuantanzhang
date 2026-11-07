import {Suspense} from 'react'
import StudioWorkbench from '@/components/admin/studio/StudioWorkbench'
export default function ViralPage(){return <Suspense fallback={<p role="status">正在打开工作台…</p>}><StudioWorkbench /></Suspense>}
