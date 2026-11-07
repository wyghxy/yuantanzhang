'use client'

import { useEffect, useRef, useState } from 'react'
import { errorText, object, text, type RecordData } from '../studio-client'
import { studioRequest } from '../studio-request'
import { requireStudioActivation } from '../studio-preview'
import styles from './StudioSourceImages.module.css'

export function StudioSourceImageSearch({ target, disabled, select }: {
  target: Record<string, string>; disabled: boolean; select: (image: RecordData) => void
}) {
  const [query, setQuery] = useState(''), [submitted, setSubmitted] = useState(''), [results, setResults] = useState<RecordData[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [broken, setBroken] = useState<string[]>([])
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function search() {
    if (disabled || busy || !query.trim()) return
    const controller = new AbortController(); pending.current = controller
    setBusy(true); setError(''); setResults([]); setSubmitted(''); setBroken([])
    try {
      requireStudioActivation()
      const params = new URLSearchParams({ ...target, q: query.trim() })
      const result = await studioRequest('/api/workspace/studio/source-images?' + params, { signal: controller.signal }, async response => {
        const data = await response.json() as RecordData
        if (!response.ok) throw new Error(text(data.error, '图片搜索失败，请稍后重试'))
        return data
      })
      if (controller.signal.aborted) return
      setResults(Array.isArray(result.results) ? result.results.map(object) : []); setSubmitted(text(result.query))
    } catch (failure) { if (!controller.signal.aborted) setError(errorText(failure)) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className={styles.search} aria-label="搜索网络图片">
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void search() }}>
      <label>图片关键词<input value={query} maxLength={200} required disabled={disabled || busy} onChange={event => setQuery(event.target.value)} placeholder="例如：森林、办公室、显微镜" /></label>
      <div className={styles.toolbar}><button type="submit" className="btn" disabled={disabled || busy || !query.trim()}>{busy ? '搜索中…' : '搜索图片'}</button><span className={styles.hint}>搜索图片关键词</span></div>
    </form>
    {error && <p role="alert">{error}</p>}
    {submitted && <p className={styles.hint} role="status">{results.length ? `“${submitted}”的搜索结果；选用前可查看来源及许可。` : '没有找到图片，可更换关键词或上传本地图片。'}</p>}
    <div className={styles.grid}>{results.map(result => <div className={styles.card} key={text(result.id)}>
      {broken.includes(text(result.id)) ? <p className={styles.hint}>缩略图暂时不可用，可打开来源查看。</p> :
        // Images are displayed only from a completed search.
         
        <img src={text(result.thumbnail)} referrerPolicy="no-referrer" loading="lazy" alt={text(result.title)} onError={() => setBroken(previous => [...previous, text(result.id)])} />}
      <p className={styles.caption}>{text(result.title)} · {text(result.creator, '作者未注明')}</p>
      <div className={styles.caption}><a href={text(result.sourcePage)} target="_blank" rel="noreferrer">来源 ↗</a>{!!result.licenseUrl && <> · <a href={text(result.licenseUrl)} target="_blank" rel="noreferrer">{text(result.license, '许可')} ↗</a></>}</div>
      <button type="button" className="btn ghost" disabled={disabled || busy} onClick={() => select(result)}>选用此图</button>
    </div>)}</div>
  </div>
}
