"use client"

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, Contrast, Monitor, Moon, Sun } from 'lucide-react'
import { parseTheme, resolveTheme, themeKey, type ThemePreference, type ResolvedTheme } from '@/lib/site-theme'
export type SiteTheme = ResolvedTheme
const ThemeContext = createContext({ theme: 'light' as ResolvedTheme, preference: 'light' as ThemePreference, setPreference: (value: ThemePreference) => { void value }, toggleTheme: () => {} })
export const useSiteTheme = () => useContext(ThemeContext)
const changeEvent = 'site-appearance-change'
function applyTheme(value: ThemePreference, persist = false) {
  const resolved = resolveTheme(value, window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.preference = value
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  if (persist) {
    try { localStorage.setItem(themeKey, value) } catch { /* Keep the in-memory preference. */ }
  }
  try { document.cookie = `${themeKey}=${value}; Path=/; Max-Age=31536000; SameSite=Lax` } catch { /* Storage can be unavailable. */ }
  window.dispatchEvent(new Event(changeEvent))
}
function subscribe(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemChanged = () => { if (document.documentElement.dataset.preference === 'system') applyTheme('system') }
  const storageChanged = (event: StorageEvent) => {
    if (event.key === themeKey || event.key === null) applyTheme(parseTheme(event.newValue) ?? 'light')
  }
  media.addEventListener('change', systemChanged)
  window.addEventListener('storage', storageChanged)
  window.addEventListener(changeEvent, listener)
  return () => {
    media.removeEventListener('change', systemChanged)
    window.removeEventListener('storage', storageChanged)
    window.removeEventListener(changeEvent, listener)
  }
}
function getSnapshot() { return `${document.documentElement.dataset.preference}:${document.documentElement.dataset.theme}` }
export default function SiteThemeProvider({ initialTheme, children }: { initialTheme: ThemePreference; children: React.ReactNode }) {
  const getServerSnapshot = useCallback(() => `${initialTheme}:${initialTheme === 'dark' ? 'dark' : 'light'}`, [initialTheme])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [preference, theme] = snapshot.split(':') as [ThemePreference, ResolvedTheme]
  const setPreference = useCallback((value: ThemePreference) => applyTheme(value, true), [])
  return <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme: () => setPreference(theme === 'light' ? 'dark' : 'light') }}>{children}</ThemeContext.Provider>
}

const choices = [{ value: 'light', label: '浅色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }, { value: 'system', label: '跟随系统', Icon: Monitor }] as const
export function SiteThemeToggle({ className = 'site-theme-toggle', upwards = false, onOpenChange }: { className?: string; upwards?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { preference, setPreference } = useSiteTheme()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ right: 16, top: 64, bottom: 'auto' as number | string })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback((focus = false) => { setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => { onOpenChange?.(open) }, [open, onOpenChange])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close() }
    const reposition = () => close()
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', reposition); window.addEventListener('scroll', reposition, { passive: true })
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition) }
  }, [open, close])
  return <><button ref={trigger} type="button" className={className} aria-label="外观设置" title="外观" aria-haspopup="menu" aria-controls={id} aria-expanded={open} onClick={() => {
    const rect = trigger.current!.getBoundingClientRect()
    const right = Math.min(Math.max(12, innerWidth - rect.right), Math.max(12, innerWidth - 190 - 12))
    setPosition({ right, top: upwards ? 0 : rect.bottom + 8, bottom: upwards ? innerHeight - rect.top + 8 : 'auto' }); setOpen(!open)
  }}><Contrast size={18} aria-hidden="true" /></button>{open && createPortal(<div ref={menu} id={id} className="site-appearance-menu" role="menu" aria-label="选择外观" style={{ right: position.right, ...(upwards ? { bottom: position.bottom } : { top: position.top }) }} onKeyDown={event => {
    const buttons = Array.from(menu.current!.querySelectorAll('button'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); close(true) }
    if (event.key === 'Tab') { close(); return }
    const next = event.key === 'ArrowDown' ? (index + 1) % 3 : event.key === 'ArrowUp' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
    if (next >= 0) { event.preventDefault(); buttons[next].focus() }
  }}>{choices.map(({ value, label, Icon }) => <button key={value} type="button" role="menuitemradio" aria-checked={preference === value} onClick={() => { setPreference(value); close(true) }}><Icon size={17} /><span>{label}</span><Check size={16} style={{ visibility: preference === value ? 'visible' : 'hidden' }} /></button>)}</div>, document.body)}</>
}
