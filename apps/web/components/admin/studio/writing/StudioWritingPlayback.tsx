'use client'
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { PlaybackParagraph } from '@ytz/contracts/studio-playback'
import { useWritingPlayback } from './StudioWritingPlaybackContext'
import { PreparationWait } from './PreparationWait'
import { useTranscriptExcerpt, type MaterialNotes } from './TranscriptExcerpt'
import styles from './StudioWritingPlayback.module.css'
import { StudioArticleBody } from '../StudioArticleBody'
import { SourceVideoSurface } from './SourceVideoSurface'
import { usePlaybackIndex, type PlaybackClock } from './writing-playback-clock'
import { usePlaybackCompatibility } from './usePlaybackCompatibility'

const stamp = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`
function startNativeWordSelection(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0) return
  // Chromium treats a focusable word as a control during mousedown. Let that one
  // native event establish a text range, then restore normal keyboard tab order.
  const element = event.currentTarget
  element.removeAttribute('tabindex')
  setTimeout(() => { if (element.isConnected) element.tabIndex = 0 }, 0)
}
const TranscriptParagraph = memo(function TranscriptParagraph({ paragraph, active, clock, seek, playable, annotatedText }: {
  paragraph: PlaybackParagraph; active: boolean; clock: PlaybackClock; seek: (ms: number) => void; playable: boolean; annotatedText: ReturnType<typeof useTranscriptExcerpt>['annotatedText']
}) {
  const wordIndex = usePlaybackIndex(clock, paragraph.tokens, active && playable)
  const seekUnlessSelecting = (ms: number) => { if (window.getSelection()?.isCollapsed !== false) seek(ms) }
  const seekFromKeyboard = (event: KeyboardEvent<HTMLElement>, ms: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    seekUnlessSelecting(ms)
  }
  return <p className={styles.paragraph} data-active={active}>
    <button className={styles.timestamp} disabled={!playable} onClick={() => seek(paragraph.startMs)} aria-label={'跳到 ' + stamp(paragraph.startMs)}>{stamp(paragraph.startMs)}</button>
    <span>{annotatedText({ id: paragraph.id, text: paragraph.text, time: stamp(paragraph.startMs) }, render => {
      if (!playable) return render(paragraph.text, 0, false)
      let offset = 0
      return paragraph.tokens.length ? paragraph.tokens.map((token, i) => {
      const start = offset; offset += token.text.length
      // Native buttons isolate drag selection; inline text retains one continuous selection.
      return <span role="button" className={styles.word} key={i} tabIndex={0} data-speaking={wordIndex === i} onMouseDown={startNativeWordSelection} onClick={() => seekUnlessSelecting(token.startMs)} onKeyDown={event => seekFromKeyboard(event, token.startMs)} aria-label={'播放：' + token.text}>{render(token.text, start)}</span>
    }) : <span role="button" className={styles.word} tabIndex={0} data-speaking={active} onMouseDown={startNativeWordSelection} onClick={() => seekUnlessSelecting(paragraph.startMs)} onKeyDown={event => seekFromKeyboard(event, paragraph.startMs)}>{render(paragraph.text, 0)}</span>
    })}</span>
  </p>
})
export function WritingModeSwitch() {
  const playback = useWritingPlayback()
  if (!playback?.enabled) return null
  return <div role="group" aria-label="原文与二创编辑" className={styles.switch}>
    <button type="button" className="btn ghost cw-mode-button" aria-pressed={playback.mode === 'original'} onClick={() => playback.switchMode('original')}>原文 / 逐字稿</button>
    <button type="button" className="btn ghost cw-mode-button" aria-pressed={playback.mode === 'editor'} onClick={() => playback.switchMode('editor')}>二创编辑</button>
  </div>
}
export function PreparationMessage({ player = false }: { player?: boolean }) {
  const context = useWritingPlayback()
  if (!context?.enabled) return null
  const preparation = player ? context.player : context.base
  const { value, error, retry, waiting, busy, elapsedSeconds } = preparation
  if (value?.state === 'ready' && !error) return !player && value.recognition?.status === 'no_speech'
    ? <div className={styles.status} role="status"><p>未识别到人声。视频仍可在右侧播放器查看，不会自动再次转写。</p></div> : null
  if (waiting) return <PreparationWait message={value?.message || (player ? '正在读取原视频与文字…' : '正在读取文字逐字稿…')} seconds={elapsedSeconds} background />
  return <div className={styles.status} role={error || value?.state === 'failed' ? 'alert' : 'status'}>
    <p>{error || value?.message || (player ? '当前没有已保存的原视频，暂时无法播放；逐字稿仍可阅读。播放器只读取已保存的视频。' : '当前还没有文字逐字稿。当前支持 60 分钟以内的视频；爆款拆解需另行点击。')}</p>
    {!player && value?.state === 'idle' && <button type="button" className="btn" disabled={busy} onClick={() => void retry()}>提取文字</button>}
    {(player || value?.state !== 'idle' && value?.recovery?.retry !== false) && (error || value?.state === 'failed') && <button type="button" className="btn" disabled={busy} onClick={() => void retry()}>{player ? '重新读取' : value?.recovery?.label || '重新读取或重试'}</button>}
    {!player && value?.state === 'failed' && value.recovery?.retry === false && <a className="btn ghost" href="/workspace/viral?view=pending">查看原因与处理方法</a>}
  </div>
}
export function WritingTranscript({ body = '', visible, notes, disabled = false, reference = false, article = false, sourceVersion }: {
  body?: string; visible?: boolean; notes?: MaterialNotes; disabled?: boolean; reference?: boolean; article?: boolean
  sourceVersion?: number
}) {
  const context = useWritingPlayback()
  const shown = visible ?? context?.mode === 'original'
  const { checkbox: excerptCheckbox, toggle: excerptToggle, composer: excerptComposer, selectionRoot, annotatedText, openedNote, selectionPending, interacting } = useTranscriptExcerpt(context?.sourceId || '', notes, disabled, article ? '文章原文' : '逐字稿')
  const [followState, setFollowState] = useState<{ sourceId?: string; enabled: boolean }>({ enabled: true })
  const follow = followState.sourceId === context?.sourceId ? followState.enabled : true
  const setFollow = (enabled: boolean) => setFollowState({ sourceId: context?.sourceId, enabled })
  const scroll = useRef<HTMLDivElement>(null)
  const transcript = article ? undefined : context?.base.value?.transcript || context?.player.value?.transcript
  const recognition = context?.base.value?.recognition || context?.player.value?.recognition
  const video = context?.video
  const paragraphs = transcript?.paragraphs || []
  const playable = !article && !context?.sessionEnded && !!context?.player.value?.mediaUrl
  const canFollow = playable && paragraphs.length > 0
  const active = usePlaybackIndex(context?.clock, paragraphs, !!shown && playable)
  useEffect(() => {
    if (!follow || !shown || interacting) return
    const container = scroll.current
    const track = () => {
      if (video?.current?.paused || selectionPending.current || window.getSelection()?.isCollapsed === false) return
      const element = container?.querySelector<HTMLElement>('[data-active="true"]')
      if (!container || !element || container.clientHeight === 0) return
      const item = element.getBoundingClientRect(), box = container.getBoundingClientRect()
      if (item.top < box.top + 32 || item.bottom > box.bottom - 32)
        container.scrollTo({ top: container.scrollTop + item.top - box.top - box.height / 3, behavior: 'smooth' })
    }
    track()
    const observer = new ResizeObserver(track)
    if (container) observer.observe(container)
    return () => observer.disconnect()
  }, [active, follow, shown, video, interacting, selectionPending])
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [context?.sourceId])
  if (!context?.enabled) return null
  return <section className={styles.transcript} hidden={!shown} aria-label={article ? '文章阅读' : reference ? '对标逐字稿' : '参考原文与逐字稿'}>
    <header><strong>{article ? '文章原文' : '逐字稿'}</strong><div>{excerptToggle}{!article && <button className="btn ghost cw-mode-button" disabled={!canFollow} aria-pressed={canFollow && follow} onClick={() => setFollow(!follow)}>{canFollow && follow ? '跟随已开启' : '跟随播放'}</button>}</div></header>
    {excerptComposer}
    {openedNote}
    <div className={styles.scroll} data-breakdown-reading-root={context.sourceId} data-breakdown-reading-version={sourceVersion} ref={element => { scroll.current = element; selectionRoot(element) }} tabIndex={0} aria-label={article ? '文章原文内容' : reference ? '对标逐字稿内容' : '逐字稿内容'} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
      {article ? body.trim() ? <StudioArticleBody body={body} select={(block, index) => excerptCheckbox({ id: 'article-' + index, text: block.text })} renderText={(block, index) => annotatedText({ id: 'article-' + index, text: block.text })} /> : <p className={styles.hint}>这篇文章暂未取得可阅读的正文。</p> : <>
      {recognition?.source === 'original_audio_asr' && recognition.status === 'succeeded' && <p className={styles.hint}>来自原视频音频识别；可对照播放校正文字。识别原文和人工校正分别保存。</p>}
      {transcript?.text || body ? !playable && <p className={styles.hint}>原文已保存，可继续阅读；视频可用性见右侧播放器。</p> : <PreparationMessage />}
      {transcript?.precision === 'sentence' && <p className={styles.hint}>当前识别只提供部分字词或句子时间；没有字词时间的段落按整句定位。</p>}
      {paragraphs.map((paragraph, index) => <div className={styles.excerptRow} key={paragraph.id}>{excerptCheckbox({ id: paragraph.id, text: paragraph.text, time: stamp(paragraph.startMs) })}<TranscriptParagraph paragraph={paragraph} active={active === index} clock={context.clock} seek={context.seek} playable={playable} annotatedText={annotatedText} /></div>)}
      {!!transcript?.untimedText?.length && <section aria-label="未定位的识别文字"><p className={styles.hint}>以下文字缺少有效时间，保留原文供阅读，暂时不能点击定位。</p>
        {transcript.untimedText.map((value, i) => <div className={styles.excerptRow} key={i}>{excerptCheckbox({ id: 'untimed-' + i, text: value })}<p>{annotatedText({ id: 'untimed-' + i, text: value })}</p></div>)}
      </section>}
      {!paragraphs.length && !transcript?.untimedText?.length && (transcript?.text || body).split(/\n+/).filter(Boolean).map((value, i) => <div className={styles.excerptRow} key={i}>{excerptCheckbox({ id: 'text-' + i, text: value })}<p>{annotatedText({ id: 'text-' + i, text: value })}</p></div>)}
      </>}
    </div>
  </section>
}
export function WritingVideo({ visible, compact = false }: { visible: boolean; compact?: boolean }) {
  const context = useWritingPlayback()
  const refreshPlayer = context?.player.retry
  const clearMediaError = context?.setMediaError
  const onCompatibilityReady = useCallback(() => { clearMediaError?.(''); void refreshPlayer?.() }, [refreshPlayer, clearMediaError])
  const compatibility = usePlaybackCompatibility(context?.sourceId || '', context?.player.value || null, onCompatibilityReady)
  const video = context?.video
  const [buffering, setBuffering] = useState(false)
  const shown = visible && context?.mobileReferenceVisible !== false
  const pendingPlay = context?.pendingPlay
  const mediaSrc = context?.mediaSrc, setMediaError = context?.setMediaError
  useEffect(() => {
    const element = video?.current
    if (mediaSrc && element && pendingPlay?.current) void element.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError' && element.isConnected && !element.closest('[hidden]')) setMediaError?.('视频已准备，点击播放器中的播放按钮即可继续')
    })
  }, [mediaSrc, video, pendingPlay, setMediaError])
  useEffect(() => {
    const element = video?.current
    return () => { element?.pause() }
  }, [video])
  if (!context?.enabled) return null
  const value = context.player.value
  const canPlay = !context.sessionEnded && !!value?.mediaUrl
  const canDownload = canPlay
  const downloadUrl = canDownload && value?.mediaUrl ? `${value.mediaUrl}${value.mediaUrl.includes('?') ? '&' : '?'}download=1` : undefined
  return <section className={`${styles.player}${compact ? ' ' + styles.compactPlayer : ''}`} hidden={!visible} aria-label="原视频播放器">
    {!context.mediaSrc && <PreparationMessage player />}
    <SourceVideoSurface author={context.sourceAuthor} sourceId={context.sourceId} visible={shown && !!context.mediaSrc} canDownload={canDownload} downloadUrl={downloadUrl}>
    <video ref={video} src={context.mediaSrc} hidden={!context.mediaSrc} controls playsInline preload="none"
      controlsList={`${canDownload ? '' : 'nodownload '}nofullscreen noremoteplayback`} disableRemotePlayback draggable={false}
      onLoadStart={() => setBuffering(true)}
      onWaiting={() => setBuffering(true)} onStalled={() => setBuffering(true)}
      onCanPlay={event => { setBuffering(false); void compatibility.diagnose(event.currentTarget) }} onPause={() => setBuffering(false)} onEmptied={() => setBuffering(false)} onEnded={() => setBuffering(false)}
      onLoadedMetadata={event => {
        if (context.pendingSeek.current !== null) context.playAt(context.pendingSeek.current, !context.sessionEnded && context.pendingPlay.current)
        else if (event.currentTarget.readyState >= 2) setBuffering(false)
      }}
      onTimeUpdate={event => context.setTime(event.currentTarget.currentTime)}
      onError={event => { setBuffering(false); context.setMediaError('原视频暂时无法播放，请检查文件或网络后重新加载');
        void compatibility.diagnose(event.currentTarget) }}
      onPlaying={() => {
        if (context.sessionEnded) { context.video.current?.pause(); return }
        setBuffering(false); context.setMediaError('')
      }} />
    {(buffering || context.mediaError || compatibility.report) && <div className={styles.mediaOverlay}>
      <div className={styles.mediaNotice} role="status" aria-busy={buffering && !context.mediaError}>
        {context.mediaError || compatibility.report ? <>{compatibility.message || context.mediaError || '当前浏览器无法显示原视频画面'}<button type="button" className="btn ghost" onClick={context.reloadMedia} disabled={!canPlay || compatibility.busy}>重新加载视频</button>
          {compatibility.report && <button type="button" className="btn ghost" onClick={() => void compatibility.convert()} disabled={!canPlay || compatibility.busy}>
            {compatibility.busy ? '正在转换…' : '转换兼容视频'}</button>}</>
          : <><span className={styles.bufferingSpinner} aria-hidden="true" />正在缓冲…</>}
      </div>
    </div>}
    </SourceVideoSurface>
    {!context.mediaSrc && value?.mediaUrl && <div className={styles.playPrompt}>
      <p>点击播放后才加载原视频。当前支持 60 分钟以内的视频。</p>
      <button type="button" className="btn primary" disabled={!canPlay} onClick={() => context.requestPlay()}>播放原视频</button>
    </div>}
    {!context.mediaSrc && context.mediaError && <p role="status">{context.mediaError}</p>}
    <div className={styles.cloudStatus} role="status">
      <p>{value?.mediaUrl ? '已保存原视频，可播放或下载。' : context.sourceId ? '暂无已保存视频，逐字稿仍可阅读。' : '选择素材后可查看视频。'}</p>
    </div>
    {value?.state === 'ready' && <p className={styles.hint}>{!!value.transcript?.paragraphs.length && '已有时间标记的文字可点击定位。'}阅读与记笔记时视频继续播放；暂停、播放速度和音量可在播放器中调整。</p>}
  </section>
}
