'use client'

import { useRef, useState } from 'react'
import { errorText, object, text, type RecordData } from '../studio-client'
import { studioRequest } from '../studio-request'
import { invalidateStudioQueries } from '../studio-query-cache'
import { requireStudioActivation } from '../studio-preview'
import { StudioSourceImageSearch } from './StudioSourceImageSearch'
import styles from './StudioSourceImages.module.css'

type Submission = { id: string; kind: 'upload' | 'paste' | 'remote'; filename: string; file?: File; originalUrl?: string; sourcePage?: string; attribution?: string }
export function StudioSourceImages({ materialId = '', taskId = '', draftId = '', planId = '', shotId, images: value, disabled, onChanged, onBusy }: {
  materialId?: string; taskId?: string; draftId?: string; planId?: string; shotId: string; images: unknown; disabled: boolean
  onChanged: () => void; onBusy: (key: string, busy: boolean) => void
}) {
  const images = Array.isArray(value) ? value.map(object) : [], active = images.filter(image => !image.deletedAt)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [remote, setRemote] = useState(false)
  const [originalUrl, setOriginalUrl] = useState(''), [sourcePage, setSourcePage] = useState(''), [attribution, setAttribution] = useState('')
  const [retry, setRetry] = useState<Submission | null>(null), [broken, setBroken] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null), locked = useRef(false)
  const target: Record<string, string> = draftId ? { draftId, planId, shotId } : { materialId, taskId, shotId }
  const key = `${draftId || materialId}/${planId || taskId}/${shotId}`
  const blocked = disabled || busy || !(planId || taskId)
  async function request(query: URLSearchParams, method: string, file?: File) {
    requireStudioActivation()
    const result = await studioRequest('/api/workspace/studio/source-images?' + query, { method, ...(file ? { body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } } : {}) }, async response => {
      const data = await response.json() as RecordData
      if (!response.ok) throw new Error(text(data.error, '图片操作失败，请重试'))
      return data
    })
    invalidateStudioQueries((draftId ? 'drafts/' : 'materials/') + encodeURIComponent(draftId || materialId))
    onChanged()
    return result
  }
  async function upload(submission: Submission) {
    if (blocked || locked.current) return
    locked.current = true; setBusy(true); setError(''); setRetry(submission); onBusy(key, true)
    try {
      if (submission.file && (submission.file.size === 0 || submission.file.size > 4 * 1024 * 1024)) throw new Error('每张图片须为 1 字节至 4 MiB')
      const query = new URLSearchParams({ ...target, id: submission.id, kind: submission.kind, filename: submission.filename })
      for (const name of ['originalUrl', 'sourcePage', 'attribution'] as const) if (submission[name]) query.set(name, submission[name])
      await request(query, 'POST', submission.file)
      setRetry(null); setRemote(false)
    } catch (failure) { setError(errorText(failure)) }
    finally { locked.current = false; setBusy(false); onBusy(key, false) }
  }
  function fileSelected(file: File, kind: 'upload' | 'paste') {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('请选择 PNG、JPEG 或 WebP 图片'); return }
    void upload({ id: crypto.randomUUID(), kind, filename: file.name || '粘贴图片', file })
  }
  async function remove(image: RecordData, restore = false) {
    if (blocked || locked.current) return
    locked.current = true; setBusy(true); setError(''); onBusy(key, true)
    try { await request(new URLSearchParams({ ...target, id: text(image.id), action: restore ? 'restore' : 'remove' }), 'PATCH') }
    catch (failure) { setError(errorText(failure)) }
    finally { locked.current = false; setBusy(false); onBusy(key, false) }
  }
  return <section className={styles.section} tabIndex={0} aria-label={shotId + ' 镜头图片'} aria-busy={busy} onPaste={event => {
    const file = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'))
    if (file && !blocked) { event.preventDefault(); fileSelected(file, 'paste') }
  }}>
    <div className={styles.toolbar}>
      <span className="cw-plan-label">镜头图片</span>
      <button type="button" className="btn ghost" disabled={blocked} onClick={() => input.current?.click()}>上传图片</button>
      <button type="button" className="btn ghost" disabled={blocked} onClick={() => setRemote(!remote)}>添加网络图片</button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label={shotId + ' 上传图片'} hidden disabled={blocked} onChange={event => { const file = event.target.files?.[0]; if (file) fileSelected(file, 'upload'); event.target.value = '' }} />
    </div>
    <p className={styles.hint}>{busy ? '正在保存图片…' : '点击此区域后可直接粘贴图片 · PNG、JPEG、WebP · 每张最多 4 MiB'}</p>
    {remote && <><StudioSourceImageSearch target={target} disabled={blocked} select={result => {
      setOriginalUrl(text(result.originalUrl)); setSourcePage(text(result.sourcePage)); setAttribution(text(result.attribution))
      void upload({ id: crypto.randomUUID(), kind: 'remote', filename: text(result.title, '网络图片'), originalUrl: text(result.originalUrl), sourcePage: text(result.sourcePage), attribution: text(result.attribution) })
    }} /><form className={styles.form} onSubmit={event => { event.preventDefault(); void upload({ id: crypto.randomUUID(), kind: 'remote', filename: '网络图片', originalUrl, sourcePage, attribution }) }}>
      <span className={styles.hint}>也可以直接填写已有图片链接</span>
      <label>图片地址<input type="url" required value={originalUrl} disabled={blocked} maxLength={4000} onChange={event => setOriginalUrl(event.target.value)} placeholder="https://…" /></label>
      <label>来源页面<input type="url" required value={sourcePage} disabled={blocked} maxLength={4000} onChange={event => setSourcePage(event.target.value)} placeholder="图片所在的网页地址" /></label>
      <label>作者或署名（选填）<input value={attribution} disabled={blocked} maxLength={500} onChange={event => setAttribution(event.target.value)} /></label>
      <div className={styles.toolbar}><button className="btn" disabled={blocked} type="submit">选用并保存</button><button type="button" className="btn ghost" disabled={busy} onClick={() => setRemote(false)}>取消</button></div>
    </form></>}
    {error && <p role="alert">{error}{retry && <button className="btn ghost" type="button" disabled={blocked} onClick={() => void upload(retry)}>重试图片保存</button>}</p>}
    <div className={styles.grid}>{active.map(image => <figure className={styles.card} key={text(image.id)}>
      {broken.includes(text(image.id)) ? <p role="status">图片暂时无法读取<button className="btn ghost" type="button" onClick={() => setBroken(previous => previous.filter(id => id !== image.id))}>重新读取图片</button></p> :
        // Protected media requires the browser's owner cookie; the optimizer cannot fetch it anonymously.
         
        <img src={'/api/workspace/studio/assets/' + encodeURIComponent(text(image.assetKey)) + '/download'} alt={text(image.filename, '镜头补充图片')} loading="lazy" onError={() => setBroken(previous => [...previous, text(image.id)])} />}
      <figcaption className={styles.caption}>{text(image.kind) === 'remote' ? <a href={text(image.sourcePage)} target="_blank" rel="noreferrer">查看来源 ↗</a> : text(image.kind) === 'paste' ? '粘贴图片' : '本地上传'}{image.attribution ? <span> · {text(image.attribution)}</span> : null}
        <button className="btn ghost" type="button" disabled={blocked} onClick={() => void remove(image)}>移除图片</button>
      </figcaption>
    </figure>)}</div>
    {images.some(image => image.deletedAt) && <details><summary className={styles.hint}>已移除的图片</summary>{images.filter(image => image.deletedAt).map(image => <div className={styles.removed} key={text(image.id)}><span>{text(image.filename, '图片')}</span><button className="btn ghost" type="button" disabled={blocked} onClick={() => void remove(image, true)}>恢复图片</button></div>)}</details>}
  </section>
}
