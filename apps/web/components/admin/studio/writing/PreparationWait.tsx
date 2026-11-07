'use client'
import { useElapsedWait } from './useElapsedWait'
import styles from './StudioWritingPlayback.module.css'

export function PreparationWait({ message, seconds, background = false }: { message: string; seconds: number; background?: boolean }) {
  const elapsed = seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
  return <div className={styles.wait} aria-busy="true">
    <div className={styles.waitHeading}><span className={styles.spinner} aria-hidden="true" /><strong role="status">{message}</strong></div>
    <p className={styles.elapsed} aria-live="off">本次已等待 <span>{elapsed}</span></p>
    <p className={styles.hint}>{background
      ? seconds >= 60 ? '仍在处理中，耗时取决于视频长度和排队情况。可先切回编辑器，准备会在后台继续。' : '耗时取决于视频长度和排队情况。可先切回编辑器，准备会在后台继续。'
      : '正在加载视频内容，耗时取决于网络速度。'}</p>
  </div>
}

export function VideoBufferingWait() {
  const seconds = useElapsedWait(true, 'buffering')
  return <PreparationWait message="正在缓冲原视频…" seconds={seconds} />
}
