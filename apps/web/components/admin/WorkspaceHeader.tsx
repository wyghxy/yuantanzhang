'use client'

import Image from 'next/image'
import { ChevronDown, Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import WorkspaceTools from './WorkspaceTools'
import '@/styles/workspace-header.css'

export default function WorkspaceHeader({ title, expanded, onSwitch, onNavigation, navigationExpanded, children, actions, className = 'topbar' }: {
  title: string
  expanded?: boolean
  onSwitch?: () => void
  onNavigation?: () => void
  navigationExpanded?: boolean
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const identity = <><Image src="/demo/brand-mark.svg" alt="" width={28} height={28} unoptimized priority /><span>{title}</span></>
  return <header id="workspace-header" className={className} data-workspace-header aria-label={title + '工作台'}>
    <div className="workspace-header-identity">
      {onNavigation && <button type="button" className="workspace-tool-button" aria-label="展开或收起当前导航" aria-expanded={navigationExpanded} onClick={onNavigation}><Menu size={20} aria-hidden="true" /></button>}
      {onSwitch ? <button type="button" className="workspace-header-switch" aria-label={'当前工作台：' + title + '，切换工作台'} aria-haspopup="dialog" aria-expanded={expanded} onClick={onSwitch}>{identity}<ChevronDown size={16} aria-hidden="true" /></button> : <div className="workspace-header-switch">{identity}</div>}
    </div>
    <div className="workspace-header-context">{children}</div>
    {actions || <WorkspaceTools title={title} />}
  </header>
}
