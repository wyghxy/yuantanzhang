'use client'

import { Blocks, Layers, LayoutGrid, Newspaper, Search, PlaySquare, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { BenchmarkNavIcon, IntelligenceNavIcon } from './StudioNavIcons'
import { originalNavigation, originalPlatforms } from './original-studio-model'
import { object, type RecordData } from './studio-client'
import WorkspaceSidebarSettings from '../WorkspaceSidebarSettings'

type StudioWorkbenchSidebarProps = {
  navigationExpanded: boolean
  view: string
  platform: string
  dashboard: RecordData | undefined
  platformLabel: (value: unknown, fallback?: string) => string
  selectView: (view: string) => void
  choosePlatform: (platform: string) => void
}

export default function StudioWorkbenchSidebar({
  navigationExpanded,
  view,
  platform,
  dashboard,
  platformLabel,
  selectView,
  choosePlatform,
}: StudioWorkbenchSidebarProps) {
  const counts = object(dashboard?.counts),
    platformCounts = object(dashboard?.platforms)
  const workflow = originalNavigation
  const icons: Record<string, ComponentType<{ className?: string }>> = { overview: IntelligenceNavIcon, industry: Newspaper, topics: Layers, research: Search, islands: Users, skills: Blocks, accounts: BenchmarkNavIcon, works: PlaySquare }
  return (
    <aside
      className="sidebar"
      id="sidebar"
      aria-label="创作导航"
      aria-hidden={!navigationExpanded ? true : undefined}
      inert={!navigationExpanded}
    >
      <div className="sidebar-label">核心工作流</div>
      <nav aria-label="核心工作流">
        {workflow.map(([key, label]) => {
          const Icon = icons[key] || LayoutGrid
          const active = view === key || (key === 'topics' && ['feed', 'drafts'].includes(view))
          return (
            <button
              className={`nav-item${active ? ' active' : ''}`}
              key={key}
              onClick={() => selectView(key)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="icon" aria-hidden="true" />
              <span>{label}</span>
              {key === 'works' && <small>{dashboard ? Number(counts.materials || 0) : '—'}</small>}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-label source-label">平台来源</div>
      <nav aria-label="平台来源">
        <button
          className={`nav-item source${platform === 'all' ? ' active-source' : ''}`}
          aria-pressed={platform === 'all'}
          onClick={() => choosePlatform('all')}
        >
          <span>全部平台</span>
          <small>{dashboard ? Number(counts.materials || 0) : '—'}</small>
        </button>
        {originalPlatforms.map(([key, label]) => (
          <button
            className={`nav-item source${platform === key ? ' active-source' : ''}`}
            aria-pressed={platform === key}
            key={key}
            onClick={() => choosePlatform(key)}
          >
            <span>{platformLabel(key, label)}</span>
            <small>{dashboard ? Number(platformCounts[key] || 0) : '—'}</small>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom" data-workspace-sidebar-footer>
        <WorkspaceSidebarSettings className="nav-item" />
      </div>
    </aside>
  )
}
