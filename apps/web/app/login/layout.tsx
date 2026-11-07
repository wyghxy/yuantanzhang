import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export default function LoginLayout({ children }: { children: ReactNode }) {
  if ((process.env.PERSONAL_AUTH_MODE || 'local') === 'local') redirect('/workspace/viral')
  return children
}
