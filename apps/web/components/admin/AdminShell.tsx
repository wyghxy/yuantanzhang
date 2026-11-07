'use client'
import { createContext,useContext,useState,useEffect,useRef,type ReactNode } from 'react'
import {useSiteTheme} from '../SiteTheme'
import Link from 'next/link'
import {LogOut,X,BookOpen,Target} from 'lucide-react'
import {clearStudioQueries, studioAuthExpired} from './studio/studio-query-cache'
import {notifyStudioSessionEnded,onStudioSessionEnded} from './studio/writing/writing-session-events'
import {flushStudioWritingEdits,studioWritingEditsPending} from './studio/studio-edit-flush'
import '@/styles/personal-shell.css'
type PersonalUser={id:string;username:string}
const dormantImmersive=(v:boolean)=>{if(typeof document!=="undefined")document.documentElement.toggleAttribute("data-project-immersive",v)}
const PersonalContext=createContext<{user:PersonalUser;expanded:boolean;toggleSidebar:()=>void}|null>(null)
export function PersonalShell({user,children}:{user:PersonalUser;children:ReactNode}) {
 const {theme}=useSiteTheme()
 const [menuOpen,setMenuOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false),[logoutError,setLogoutError]=useState(''),dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const expired=()=>{clearStudioQueries(true);window.location.assign('/login')}
   const off=onStudioSessionEnded(expired);window.addEventListener(studioAuthExpired,expired)
   return ()=>{off();window.removeEventListener(studioAuthExpired,expired)}
 },[])
  useEffect(() => {
    const pending = new Set<string>()
    let navigating = false
    const events = ['studio-reader-dirty', 'studio-writing-dirty', 'studio-topic-dirty', 'studio-notes-dirty', 'studio-excerpt-dirty', 'studio-source-plan-dirty', 'studio-settings-dirty']
    const change = (event: Event) => {
      const dirty = event.type === 'studio-writing-dirty'
        ? (event as CustomEvent<{ dirty?: boolean }>).detail?.dirty === true
        : (event as CustomEvent<boolean>).detail === true
      if (dirty) pending.add(event.type)
      else pending.delete(event.type)
    }
    const leave = async (event: MouseEvent) => {
      if ((!pending.size && !studioWritingEditsPending()) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
      const destination = new URL(anchor.href, window.location.href)
      if (!['http:', 'https:'].includes(destination.protocol)) return
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return
      event.preventDefault()
      event.stopPropagation()
      if (navigating) return
      navigating = true
      try {
        const writing = await flushStudioWritingEdits()
        if (writing.registered) {
          if (writing.pending) pending.add('studio-writing-dirty')
          else pending.delete('studio-writing-dirty')
        }
        if (pending.size && !window.confirm('当前内容尚未保存，或图片/画面仍在处理。离开可能丢失修改，确认离开？')) return
        window.location.assign(destination.href)
      } finally { navigating = false }
    }
    for (const name of events) window.addEventListener(name, change)
    document.addEventListener('click', leave, true)
    return () => {
      for (const name of events) window.removeEventListener(name, change)
      document.removeEventListener('click', leave, true)
    }
  }, [])
  useEffect(() => {
    const node = dialog.current
    if (!menuOpen || !node) return
    const previous = document.activeElement as HTMLElement | null
    node.showModal()
    return () => {
      node.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [menuOpen])
  async function logout() {
    setLoggingOut(true); setLogoutError('')
    try {
      const writing = await flushStudioWritingEdits()
      if (writing.pending && !window.confirm('当前稿件还未保存到服务器，请先复制或下载未保存输入。仍要退出登录吗？')) return
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error()
      notifyStudioSessionEnded()
      clearStudioQueries(); setMenuOpen(false)
      // A new document discards all in-memory state from the previous account.
       
      window.location.assign('/login')
    } catch { setLogoutError('退出失败，请重试') }
    finally { setLoggingOut(false) }
  }
 return <PersonalContext.Provider value={{user,expanded:menuOpen,toggleSidebar:()=>setMenuOpen(v=>!v)}}>
   <div className="admin-workspace native-workspace" data-theme={theme} data-sidebar="hidden" data-immersive="true" data-workspace="viral">
    <div className="admin-shell-body"><main className="admin-main" id="workspace-content">{children}</main></div>
    {menuOpen&&<dialog ref={dialog} className="workspace-switcher" aria-labelledby="workspace-switcher-title" onCancel={()=>setMenuOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setMenuOpen(false)}}>
      <div className="workspace-switcher-content"><div className="workspace-switcher-heading"><h2 id="workspace-switcher-title">切换工作台</h2><button type="button" className="admin-icon-button" aria-label="关闭工作台菜单" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
       <nav className="admin-sidebar" aria-label="个人工作台"><Link className="admin-nav-link" href="/workspace/viral" onClick={()=>setMenuOpen(false)}><Target size={18}/>探长雷达</Link><Link className="admin-nav-link" href="/workspace/creation" onClick={()=>setMenuOpen(false)}><BookOpen size={18}/>内容项目</Link></nav>
       <div className="workspace-switcher-account"><span>{user.username}</span><button type="button" disabled={loggingOut} onClick={()=>void logout()}><LogOut size={14}/>{loggingOut?'正在退出…':'退出登录'}</button></div>
       {logoutError&&<p role="alert">{logoutError}</p>}</div>
    </dialog>}
   </div></PersonalContext.Provider>
}
export function useAdminShell(){const v=useContext(PersonalContext);if(!v)throw new Error('请登录个人工作台');return {userId:v.user.id,role:'owner',setImmersive:dormantImmersive,features:['studio'],expanded:v.expanded,toggleSidebar:v.toggleSidebar}}
