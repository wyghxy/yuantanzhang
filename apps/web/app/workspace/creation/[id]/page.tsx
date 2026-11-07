import { notFound } from 'next/navigation'
import CreationProjectDetail from '@/components/admin/CreationProjectDetail'

export const dynamic = 'force-dynamic'

export default async function CreationProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound()
  return <CreationProjectDetail key={id} projectId={Number(id)} />
}
