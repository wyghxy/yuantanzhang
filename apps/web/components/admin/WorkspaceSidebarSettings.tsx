'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import styles from './workspace-sidebar-settings.module.css'

/** A real sidebar owns this entry; pages without one retain the header fallback. */
export default function WorkspaceSidebarSettings({ className = '', available = true }: {
  className?: string; available?: boolean
}) {
  const pathname = usePathname()
  if (!available) return null
  const active = /^\/(?:workspace|admin)\/settings(?:\/|$)/.test(pathname)
  return <Link href="/workspace/settings" data-workspace-sidebar-settings
    className={`${styles.link} ${className}`} aria-current={active ? 'page' : undefined}>
    <Settings size={20} aria-hidden="true" /><span>设置</span>
  </Link>
}
