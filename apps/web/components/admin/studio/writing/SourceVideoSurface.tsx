'use client'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Download, Maximize, Minimize, PictureInPicture2 } from 'lucide-react'
import { useStudioPrivacy } from '../StudioPrivacy'
import styles from './StudioWritingPlayback.module.css'

const subscribeFullscreen = (listener: () => void) => {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}
const subscribePictureInPicture = (listener: () => void) => {
  const events = ['enterpictureinpicture', 'leavepictureinpicture', 'loadedmetadata', 'emptied']
  events.forEach(event => document.addEventListener(event, listener, true))
  return () => events.forEach(event => document.removeEventListener(event, listener, true))
}

/** Keep attribution in the fullscreen element without modifying the source video. */
export function SourceVideoSurface({ author, sourceId, visible, canDownload = false, downloadUrl, children }: {
  author?: string; sourceId: string; visible: boolean; canDownload?: boolean; downloadUrl?: string; children: ReactNode
}) {
  const surface = useRef<HTMLDivElement>(null), generation = useRef({ value: 0 })
  const privacy = useStudioPrivacy()
  const [failure, setFailure] = useState<{ sourceId: string; message: string } | null>(null)
  const fullscreen = useSyncExternalStore(subscribeFullscreen,
    () => !document.fullscreenEnabled ? 'unavailable' : document.fullscreenElement === surface.current ? 'active' : 'available',
    () => 'unavailable')
  const pictureInPicture = useSyncExternalStore(subscribePictureInPicture, () => {
    if (!document.pictureInPictureEnabled || !('requestPictureInPicture' in HTMLVideoElement.prototype)) return 'unavailable'
    const video = surface.current?.querySelector('video')
    if (video && document.pictureInPictureElement === video) return 'active'
    return video && video.readyState >= 1 && video.videoWidth > 0 ? 'available' : 'loading'
  }, () => 'unavailable')
  useEffect(() => {
    const element = surface.current
    const video = element?.querySelector('video'), requests = generation.current
    return () => {
      requests.value++
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {})
      if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {})
    }
  }, [sourceId, visible])
  async function toggleFullscreen() {
    const element = surface.current, request = generation.current.value
    if (!element || !visible) return
    setFailure(null)
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen()
      else {
        await element.requestFullscreen()
        if (request !== generation.current.value && document.fullscreenElement === element) await document.exitFullscreen()
      }
    } catch {
      if (request === generation.current.value) setFailure({ sourceId, message: '暂时无法全屏，请继续在此播放。' })
    }
  }
  async function togglePictureInPicture() {
    const video = surface.current?.querySelector('video'), request = generation.current.value
    if (!video || !visible) return
    setFailure(null)
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture()
      else {
        await video.requestPictureInPicture()
        if (request !== generation.current.value && document.pictureInPictureElement === video) await document.exitPictureInPicture()
      }
    } catch {
      if (request === generation.current.value) setFailure({ sourceId, message: '暂时无法打开画中画，请继续在此播放。' })
    }
  }
  return <div ref={surface} className={styles.videoSurface} hidden={!visible} onContextMenu={event => { if (!canDownload) event.preventDefault() }}>
    {children}
    <div className={styles.videoAttribution} aria-label="原视频署名">
      <span>原作者：{privacy.creatorName(author?.trim(), '未识别')}</span>
      <span>仅供观看</span>
    </div>
    <div className={styles.videoActions}>
    {fullscreen !== 'unavailable' && <button type="button" className={styles.videoFullscreen}
      aria-label={fullscreen === 'active' ? '退出全屏' : '全屏播放'} title={fullscreen === 'active' ? '退出全屏' : '全屏播放'} onClick={() => void toggleFullscreen()}>
      {fullscreen === 'active' ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
    </button>}
    {pictureInPicture !== 'unavailable' && <button type="button" className={styles.videoFullscreen}
      disabled={pictureInPicture === 'loading'} aria-label={pictureInPicture === 'active' ? '退出画中画' : '画中画播放'}
      title={pictureInPicture === 'active' ? '退出画中画' : '画中画播放'}
      onClick={() => void togglePictureInPicture()}><PictureInPicture2 size={18} aria-hidden="true" /></button>}
    {canDownload && downloadUrl && <a className={styles.videoFullscreen} href={downloadUrl} download aria-label="下载原视频" title="下载原视频">
      <Download size={18} aria-hidden="true" />
    </a>}
    </div>
    {failure?.sourceId === sourceId && <span role="status" className={styles.videoFullscreenError}>{failure.message}</span>}
  </div>
}
