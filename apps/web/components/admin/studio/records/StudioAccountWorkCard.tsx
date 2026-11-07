'use client'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { Film } from 'lucide-react'
import { api, dateLabel, errorText, object, text, type RecordItem } from '../studio-client'
import { studioCollectedMetadata, studioCollectionBodyState } from '../studio-collection-state'
import { studioSafeUrl } from '../studio-operations-utils'
import { originalDuration } from '../original-studio-model'
import { Platform } from '../StudioUI'
import { useStudioPrivacy } from '../StudioPrivacy'

/** A failed thumbnail never hides the work or starts a source request. */
export function StudioAccountWorkCard({ item, onMaterial, onAdopt, onChanged, onTask }: {
  item: RecordItem; onMaterial: (id: string, tab?: string) => void
  onAdopt: (item: RecordItem) => void; onChanged: () => void; onTask: (id: string) => void
}) {
  const { materialTitle } = useStudioPrivacy()
  const cover = studioSafeUrl(item.coverUrl || item.cover_url)
  const [failedCover, setFailedCover] = useState('')
  const [repairing, setRepairing] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const meta = studioCollectedMetadata(item), state = studioCollectionBodyState(item)
  const missing = !cover || failedCover === cover
  const permanent = /^\/api\/(admin|workspace)\/studio\/assets\/covers\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(cover || '')
  const savedVideo = item.hasSavedVideo === true || /\.(mp4|m4v|webm|mov|mkv)$/i.test(text(item.mediaKey || item.assetKey))
  const duration = originalDuration(item.durationSeconds || item.duration || object(item.transcript).durationSeconds)
  const likes = object(item.metrics).likes
  const repair = async () => {
    if (submitting.current) return
    submitting.current = true; setRepairing(true); setError('')
    try {
      const result = await api(`materials/${encodeURIComponent(item.id)}/cover-repair`, 'POST', { expectedVersion: item.version })
      const id = text(object(result.task).id)
      if (!id) throw new Error('封面任务未返回，请刷新作品后查看采集任务')
      onChanged(); onTask(id)
    } catch (failure) { setError(errorText(failure)) }
    finally { submitting.current = false; setRepairing(false) }
  }
  return <article className="creator-work-card">
    <button className="creator-work-open" onClick={() => onMaterial(item.id)} aria-label={`打开作品：${materialTitle(meta.title, '未命名作品')}`}>
      <span className="creator-work-cover">
        {missing ? <Film size={36} aria-label="封面暂不可用" /> : <Image key={cover} src={cover} alt="" width={320} height={180}
          unoptimized referrerPolicy="no-referrer" onError={() => setFailedCover(cover)} />}
        <span className="creator-work-format">{duration || '作品'}</span>
      </span>
      <strong>{materialTitle(meta.title, '未命名作品')}</strong>
    </button>
    <div className="creator-work-meta"><Platform value={item.platform} /><span>{typeof likes === 'number' && Number.isFinite(likes) && likes >= 0
      ? new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(likes) + ' 赞'
      : dateLabel(item.publishedAt || item.createdAt)}</span></div>
    <div className="creator-work-footer"><span>{repairing ? '封面补全中…' : state.label}</span><div>
      {permanent && missing && <button type="button" className="btn-card-read" onClick={() => setFailedCover('')}>重载封面</button>}
      {savedVideo && !permanent && <button type="button" className="btn-card-read" disabled={repairing}
        title="仅使用已保存视频生成并永久保存封面；免费，不重新采集或转写" onClick={() => void repair()}>{repairing ? '提交中…' : '免费补封面'}</button>}
      <button className="btn-card-read" onClick={() => onAdopt(item)}>采纳</button>
      <button className="btn-card-remix" onClick={() => onMaterial(item.id, '二创工作台')}>二创</button>
    </div></div>
    {error && <p role="alert">{error}</p>}
  </article>
}
