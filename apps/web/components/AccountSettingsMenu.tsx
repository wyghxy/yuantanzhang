'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Settings2, Settings, UserRound, Sun, Moon, Monitor, Check, Globe } from 'lucide-react'
import { useSiteTheme } from './SiteTheme'
import styles from './account-settings-menu.module.css'


export default function AccountSettingsMenu({ className, workspace = false }: { className?: string; workspace?: boolean }) {
  const { preference, setPreference } = useSiteTheme()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ right: 12, top: 64 })
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback((focus = false) => { setOpen(false); if (focus) trigger.current?.focus() }, [])
  useEffect(() => {
    if (!open) return
    menu.current?.focus()
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close()
    }
    const reposition = () => close()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', reposition)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition) }
  }, [open, close])
  return <>
    <button ref={trigger} type="button" className={className || styles.trigger} aria-label={workspace ? "设置" : "账号设置"} title="设置" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {
      const rect = trigger.current!.getBoundingClientRect()
      const right = Math.min(Math.max(12, innerWidth - rect.right), Math.max(12, innerWidth - 280))
      setPosition({ right, top: Math.min(rect.bottom + 8, Math.max(12, innerHeight - (workspace ? 460 : 290))) })
      setOpen(value => !value)
    }}>{workspace ? <Settings size={20} aria-hidden="true" /> : <><Settings2 size={18} aria-hidden="true" /><span className={styles.label}>设置</span></>}</button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label="账号设置菜单" tabIndex={-1} className={styles.menu} style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return }
      if (event.key === 'Tab') { event.preventDefault(); close(true); return }
      const items = Array.from(menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'))
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index <= 0 ? items.length - 1 : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1
      if (next >= 0) { event.preventDefault(); items[next]?.focus() }
    }}>
      {workspace && <><span className={styles.caption}>外观</span>{([{ value: 'light', label: '浅色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }, { value: 'system', label: '跟随系统', Icon: Monitor }] as const).map(({ value, label, Icon }) => <button className={styles.appearance} key={value} type="button" role="menuitemradio" aria-checked={preference === value} onClick={() => { setPreference(value); close(true) }}><Icon size={17} /><span>{label}</span><Check size={16} style={{ visibility: preference === value ? 'visible' : 'hidden', marginLeft: 'auto' }} /></button>)}<hr className={styles.divider} /></>}
      <span className={styles.caption}>个人工作台</span>
      <Link role="menuitem" href="/workspace/settings" onClick={() => close()}><UserRound size={17} />个人设置与连接</Link>
      <a role="menuitem" href="https://yuantanzhang.cn/workspace/viral" target="_blank" rel="noopener noreferrer" onClick={() => close()}><Globe size={17} />官方在线版 · 立即使用</a>
      <a role="menuitem" href="https://yuantanzhang.cn/" target="_blank" rel="noopener noreferrer" onClick={() => close()}><Globe size={17} />元探长官网</a>
    </div>, document.body)}
  </>
}
