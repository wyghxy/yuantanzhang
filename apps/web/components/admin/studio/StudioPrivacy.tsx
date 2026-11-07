'use client'

import React, { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { platforms, text } from './studio-client'
import { createStudioPrivacyStore, privacyCreator, privacyMaterialTitle, privacyPlatform, studioAvatarSource } from './studio-privacy-model'

type PrivacyState = { enabled: boolean | null; setEnabled: (enabled: boolean) => void }
export const StudioPrivacyContext = createContext<PrivacyState>({ enabled: false, setEnabled: () => {} })
const serverSnapshot = () => null

export function StudioPrivacyProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStudioPrivacyStore(() => typeof window === 'undefined' ? undefined : window))
  const enabled = useSyncExternalStore(store.subscribe, store.snapshot, serverSnapshot)
  return <StudioPrivacyContext.Provider value={{ enabled, setEnabled: store.set }}>{children}</StudioPrivacyContext.Provider>
}

export function useStudioPrivacy() {
  const state = useContext(StudioPrivacyContext)
  const masked = state.enabled !== false
  return {
    ...state,
    masked,
    platformLabel(value: unknown, fallback?: string) {
      const key = text(value, 'local'), label = fallback ?? platforms[key] ?? key
      return masked ? privacyPlatform(key, label) : label
    },
    creatorName(value: unknown, fallback = '作者未识别') {
      return masked ? privacyCreator(value) : text(value, fallback)
    },
    materialTitle(value: unknown, fallback = '未提供标题') {
      const title = text(value)
      return !title.trim() ? fallback : masked ? privacyMaterialTitle(title) : title
    },
  }
}

export function StudioPrivacyToggle({ compact = false }: { compact?: boolean }) {
  const { enabled, setEnabled } = useStudioPrivacy()
  const label = enabled ? '隐私模式已开启' : '隐私模式'
  return <button type="button" className={compact ? 'icon-button' : 'studio-privacy-toggle'} aria-label={label}
    title={enabled ? '关闭隐私模式，恢复头像、名称和素材标题' : '开启隐私模式，隐藏头像并打码名称和素材标题'}
    aria-pressed={enabled === true} disabled={enabled === null} onClick={() => setEnabled(!enabled)}>
    {enabled ? <EyeOff className={compact ? 'icon' : undefined} size={compact ? 20 : 16} /> : <Eye className={compact ? 'icon' : undefined} size={compact ? 20 : 16} />}
    {!compact && <><span>隐私模式</span><span className="studio-privacy-state">{enabled ? '开' : '关'}</span></>}
  </button>
}

function Mosaic({ className }: { className: string }) {
  return <span className={className + ' studio-mosaic'} role="img" aria-label="已隐藏头像">
    <span className="studio-mosaic-pixels" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</span>
  </span>
}

export function StudioPlatformIcon({ className, children }: { className: string; children: ReactNode }) {
  const { masked } = useStudioPrivacy()
  const classes = className.split(/\s+/)
  const sourceMarks: Record<string, string> = { 'dy-icon': 'dy', 'bili-icon': 'bili', 'xhs-icon': 'xhs', 'yt-icon': 'yt', 'wechat-icon': 'wx' }
  const resolvedClassName = classes.includes('platform-mark')
    ? classes.map(value => sourceMarks[value] ?? value).join(' ')
    : className
  return masked ? <Mosaic className={resolvedClassName} /> : <span className={resolvedClassName} aria-hidden="true">{children}</span>
}

export function StudioCreatorAvatar({ name, url, fallbackOnly = false }: { name: unknown; url?: unknown; fallbackOnly?: boolean }) {
  const { masked } = useStudioPrivacy()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const source = studioAvatarSource(url)
  if (masked) return <Mosaic className="creator-avatar-fallback" />
  return !fallbackOnly && failedUrl !== source && /^https?:\/\//i.test(source)
    ? <Image unoptimized width={40} height={40} className="creator-avatar-img" src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(source)} />
    : <div className="creator-avatar-fallback">{privacyCreator(text(name, '创'))}</div>
}
