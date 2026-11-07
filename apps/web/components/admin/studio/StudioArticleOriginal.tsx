'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api, apiRequest, errorText, text, type RecordData } from './studio-client'
import { useStudioPrivacy } from './StudioPrivacy'
import { articleDocument, articleOriginalUrl, observeArticleImages } from './studio-article-document'
import styles from './StudioArticleOriginal.module.css'

export default function StudioArticleOriginal({ materialId, version, originalUrl = '', active = true }: {
  materialId: string; version?: number; originalUrl?: string; active?: boolean
}) {
  const { creatorName, materialTitle, masked } = useStudioPrivacy()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: RecordData; error?: string } | null>(null)
  const [failedImages, setFailedImages] = useState<{ key: string; count: number } | null>(null)
  const cleanup = useRef<() => void>(() => {})
  const key = materialId + ':' + version + ':' + attempt
  const current = result?.key === key ? result : null
  useEffect(() => {
    if (!active || !materialId) return
    const controller = new AbortController()
    // 首载走查询缓存（同一作品再次打开秒开）；用户点「重新读取」时才强制绕过。
    const path = `materials/${encodeURIComponent(materialId)}/article`
    const read = attempt === 0
      ? api(path, 'GET', undefined, controller.signal)
      : apiRequest(path + '?refresh=1&t=' + Date.now(), 'GET', undefined, controller.signal)
    void read
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: errorText(error) }) })
    return () => controller.abort()
  }, [active, materialId, key, attempt])
  const data = current?.data
  const author = creatorName(text(data?.author), '')
  const headingTitle = materialTitle(data?.title, '')
  const frameKey = key + ':' + author + ':' + headingTitle
  const document = useMemo(() => data?.status === 'ready' && typeof data.html === 'string' && typeof window !== 'undefined'
    ? articleDocument(data.html, window, { title: headingTitle, author, publishedAt: text(data.publishedAt) }) : '', [data, author, headingTitle])
  useEffect(() => () => cleanup.current(), [document, active])
  const failedCount = failedImages?.key === frameKey ? failedImages.count : 0
  const url = articleOriginalUrl(data?.originalUrl || originalUrl)
  const view = current && !current.error && !document && url && !masked ? 'web' : 'saved'
  return <section className={styles.root} aria-label="阅读原文" hidden={!active}>
    {view === 'web' && url ? <>
      <p className={styles.hint}>如无法显示，请点击上方“查看原文”。</p>
      {active && <iframe key={url} className={styles.frame} title="公众号文章原网页" src={url} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />}
    </> : current?.error ? <div role="alert" className={styles.message}>{current.error}<button type="button" className="btn ghost" onClick={() => setAttempt(value => value + 1)}>重新读取</button>{url && <a className="btn ghost" href={url} target="_blank" rel="noreferrer">查看原文 ↗</a>}</div>
      : !current ? <p role="status" className={styles.message}>正在读取原文…</p>
      : !document ? <p role="status" className={styles.message}>{masked && url ? '隐私模式下不直接嵌入原网页；可阅读已保存的文字稿，关闭隐私模式后恢复原网页。' : '尚未保存这篇文章的完整图文；左侧文字稿仍可阅读。'}</p>
      : active && document && <iframe key={frameKey} className={styles.frame} title="阅读原文" sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={document}
        onLoad={event => { cleanup.current(); const content = event.currentTarget.contentDocument; if (content) cleanup.current = observeArticleImages(content, count => setFailedImages({ key: frameKey, count })) }} />}
    {view === 'saved' && !!failedCount && <p role="status" className={styles.hint}>如无法显示，请点击上方“查看原文”。</p>}
  </section>
}
