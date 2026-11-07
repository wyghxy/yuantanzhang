'use client'

import { useWritingPlayback } from './StudioWritingPlaybackContext'
import { WritingTranscript, WritingVideo } from './StudioWritingPlayback'
import type { MaterialNotes } from './TranscriptExcerpt'
import styles from './StudioWritingPlayback.module.css'
import StudioArticleOriginal from '../StudioArticleOriginal'
import { articleOriginalUrl } from '../studio-article-document'

export function StudioReferenceReader({ visible, body, notes, disabled, article = false, sourceMode = false, originalUrl, version, plainText = false, onRichArticle }: {
  visible: boolean; body: string; notes: MaterialNotes; disabled: boolean; article?: boolean; sourceMode?: boolean; originalUrl?: string; version?: number
  plainText?: boolean; onRichArticle?: () => void
}) {
  const playback = useWritingPlayback()
  if (!playback?.enabled) return null
  // Rewrite keeps its reference transcript beside the editor. When the user
  // opens the left original, that panel owns the transcript instead.
  const rewriteVideo = sourceMode && !article
  const showTranscript = !sourceMode || playback.mode === 'editor'
  const richArticle = article && !plainText && !!articleOriginalUrl(originalUrl)
  return <section className={styles.reader} hidden={!visible} aria-label={article ? '对标文章原文' : '对标视频与逐字稿'}>
    <div className={styles.readerTools} hidden={article && !plainText || rewriteVideo}>
      <span>{article ? '已保存的文章文字' : '对标逐字稿'}</span>
      {article ? <button type="button" className="btn ghost" onClick={onRichArticle}>返回图文原文</button> : <button type="button" className="btn ghost" aria-expanded={playback.playerExpanded}
        onClick={() => playback.setPlayerExpanded(!playback.playerExpanded)}>{playback.playerExpanded ? '收起播放器' : '展开播放器'}</button>
      }
    </div>
    <WritingVideo visible={visible && !article && (rewriteVideo || playback.playerExpanded)} compact={showTranscript} />
    {richArticle ? <StudioArticleOriginal materialId={playback.sourceId} version={version} originalUrl={originalUrl} active={visible} />
      : <WritingTranscript body={body} visible={visible && showTranscript} notes={notes} disabled={disabled} article={article} sourceVersion={version} reference />}
  </section>
}
