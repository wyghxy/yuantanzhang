'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMaterialPreparation } from './useMaterialPreparation'
import { onStudioSessionEnded } from './writing-session-events'
import { useMaterialNotes } from './useMaterialNotes'
import type { WritingRecord } from '../studio-writing-model'
import { createPlaybackClock } from './writing-playback-clock'

export const writingReferenceTabs = ['播放器', '爆款拆解', '爆款评论', '开场分析', '话题与标签', '我的笔记', '画面规划'] as const
export type WritingReferenceTab = (typeof writingReferenceTabs)[number]
export type WritingLeftMode = 'original' | 'editor'

function usePlaybackState(enabled: boolean, initialMode: WritingLeftMode, initialTab?: string) {
  const [sourceId, selectSource] = useState(''), source = useRef('')
  const [mode, switchMode] = useState<WritingLeftMode>(initialTab === '画面规划' ? 'editor' : initialMode)
  const [tab, selectTab] = useState<WritingReferenceTab>(writingReferenceTabs.find(value => value === initialTab) || '播放器')
  const [playerExpanded, setPlayerExpanded] = useState(false)
  const setTab = useCallback((next: WritingReferenceTab) => {
    selectTab(next)
    if (next === '画面规划') switchMode('editor')
  }, [])
  const [materialRevision, reload] = useState(0)
  const [clock] = useState(createPlaybackClock)
  const [mediaError, setMediaError] = useState('')
  const [loaded, setLoaded] = useState<{ sourceId: string; url: string } | null>(null)
  const [mobileReferenceVisible, setMobileReferenceVisible] = useState(true)
  const [sessionEnded, setSessionEnded] = useState(false)
  const revealPlayer = useRef<(() => void) | null>(null)
  const registerRevealPlayer = useCallback((handler: () => void) => {
    revealPlayer.current = handler
    return () => { if (revealPlayer.current === handler) revealPlayer.current = null }
  }, [])
  const video = useRef<HTMLVideoElement>(null), pendingSeek = useRef<number | null>(null)
  const pendingPlay = useRef(false)
  useEffect(() => onStudioSessionEnded(() => {
    setSessionEnded(true); setLoaded(null); pendingPlay.current = false; pendingSeek.current = null
    video.current?.pause()
    setMediaError('登录已退出，重新登录后才能播放视频；当前文字仍可阅读。')
  }), [])
  useEffect(() => {
    if (!sessionEnded) return
    // Clear the resource after React has committed removal of the controlled src.
    const element = video.current
    if (element) { element.pause(); element.removeAttribute('src'); element.load() }
  }, [sessionEnded])
  const base = useMaterialPreparation(sourceId, 'prepare', enabled, () => reload(n => n + 1))
  const player = useMaterialPreparation(sourceId, 'player', enabled && !!sourceId, () => reload(n => n + 1))
  const mediaUrl = player.value?.mediaUrl
  const mediaSrc = loaded?.sourceId === sourceId ? mediaUrl || loaded.url : undefined
  const canPlayMedia = !sessionEnded && !!mediaUrl
  const setSourceId = useCallback((next: string) => {
    if (source.current === next) return
    source.current = next
    video.current?.pause(); selectSource(next); clock.setTime(0); setMediaError(''); setLoaded(null); setPlayerExpanded(false)
    pendingSeek.current = null; pendingPlay.current = false
  }, [clock])
  const playAt = useCallback((seconds: number, autoplay = true) => {
    const element = video.current
    pendingSeek.current = seconds; pendingPlay.current = autoplay
    if (element && element.readyState >= 1) {
      const end = Number.isFinite(element.duration) ? Math.max(0, element.duration - 0.05) : seconds
      element.currentTime = Math.max(0, Math.min(seconds, end)); pendingSeek.current = null; pendingPlay.current = false
      clock.setTime(element.currentTime)
      if (autoplay) void element.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError' && element.isConnected && !element.closest('[hidden]')) setMediaError('已定位到对应画面，点击视频播放按钮即可继续')
      })
      else element.pause()
    }
  }, [clock])
  const requestPlay = useCallback((seconds?: number) => {
    if (!canPlayMedia || !mediaUrl) return
    const position = seconds ?? (mediaSrc ? video.current?.currentTime ?? 0 : 0)
    setTab('播放器'); setPlayerExpanded(true); revealPlayer.current?.()
    if (!video.current?.error) setMediaError('')
    // Keep the chosen URL across metadata refreshes and reference-tab switches.
    setLoaded(previous => previous?.sourceId === sourceId ? previous : { sourceId, url: mediaUrl })
    // A reused video node may still report the previous source's readyState.
    // Seek only after the newly selected resource has loaded its metadata.
    if (mediaSrc && video.current?.getAttribute('src') === mediaSrc) playAt(position)
    else { pendingSeek.current = position; pendingPlay.current = true }
  }, [canPlayMedia, mediaUrl, mediaSrc, sourceId, playAt, setTab])
  const reloadMedia = useCallback(() => {
    const element = video.current
    if (!element || !canPlayMedia || !mediaUrl) return
    pendingSeek.current ??= element.currentTime || clock.getTime(); pendingPlay.current = false
    setMediaError(''); element.load()
  }, [canPlayMedia, mediaUrl, clock])
  const seek = useCallback((milliseconds: number) => requestPlay(milliseconds / 1000), [requestPlay])
  return { enabled, sourceId, setSourceId, mode, switchMode, tab, setTab, materialRevision, base, player,
    mediaSrc, requestPlay, reloadMedia, playerExpanded, setPlayerExpanded, mobileReferenceVisible, setMobileReferenceVisible, registerRevealPlayer, sessionEnded,
    clock, setTime: clock.setTime, video, seek, pendingSeek, pendingPlay, playAt, mediaError, setMediaError }
}
type PlaybackState = ReturnType<typeof usePlaybackState> & { notes: ReturnType<typeof useMaterialNotes>; sourceAuthor?: string }
const PlaybackContext = createContext<PlaybackState | null>(null)
export function StudioWritingPlaybackProvider({ enabled, material = null, initialMode = 'original', initialTab, children }: {
  enabled: boolean; material?: WritingRecord | null; initialMode?: WritingLeftMode; initialTab?: string; children: ReactNode
}) {
  const state = usePlaybackState(enabled, initialMode, initialTab)
  const notes = useMaterialNotes(material?.id === state.sourceId ? material : null)
  const sourceAuthor = material?.id === state.sourceId && typeof material.author === 'string' ? material.author : undefined
  return <PlaybackContext.Provider value={{ ...state, notes, sourceAuthor }}>{children}</PlaybackContext.Provider>
}
export function useWritingPlayback() { return useContext(PlaybackContext) }
