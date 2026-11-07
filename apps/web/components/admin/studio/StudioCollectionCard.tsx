'use client'

import StudioCoverImage from './StudioCoverImage'
import type { RecordItem } from './studio-client'
import { useStudioPrivacy } from './StudioPrivacy'
import { studioCollectedMetadata } from './studio-collection-state'
import { studioSafeUrl } from './studio-operations-utils'
import { CollectionMediaIcon, collectionBodyState, collectionContentType } from './StudioCollectionDetail'

export default function StudioCollectionCard({ row, selected, deleted, restoring, onSelect, onRestore, onAdopt, onRemix, onDelete }: {
  row: RecordItem; selected: boolean; deleted: boolean; restoring: string
  onSelect: (id: string) => void; onRestore: (row: RecordItem) => Promise<void>
  onAdopt: (row: RecordItem) => void; onRemix: (id: string) => void; onDelete: (row: RecordItem) => void
}) {
  const { creatorName, platformLabel, materialTitle } = useStudioPrivacy()
  const meta = studioCollectedMetadata(row), image = studioSafeUrl(row.coverUrl || row.cover_url), body = collectionBodyState(row)
  return <article className={'video-card-item' + (selected ? ' selected' : '')} data-video-card={row.id} onClick={() => onSelect(row.id)}>
    <div className="video-card-thumb-wrap"><StudioCoverImage src={image} version={row.version} className="video-card-thumb-img" alt="" width={144} height={90} icon={<CollectionMediaIcon item={row} />} compact /></div>
    <div className="video-card-content"><h3 className="video-card-title"><button type="button" className="library-select" aria-pressed={selected} aria-controls="videoPreviewPanel">{materialTitle(meta.title)}</button></h3><div className="video-card-meta"><span className="library-platform">{platformLabel(row.platform)}</span><span className="video-card-creator">{creatorName(meta.author, '未提供')}</span><span>{collectionContentType(row) || '形式未提供'}</span><span className={'library-status' + (body.complete ? ' is-ready' : '')}>{body.label}</span></div></div>
    <div className="video-card-actions">{deleted ? <button type="button" className="btn-card-action" disabled={!!restoring} onClick={event => { event.stopPropagation(); void onRestore(row) }}>{restoring === row.id ? '正在恢复…' : '恢复'}</button> : <><button type="button" className="btn-card-action" onClick={event => { event.stopPropagation(); onAdopt(row) }}>采纳</button><button type="button" className="btn-card-action" onClick={event => { event.stopPropagation(); onRemix(row.id) }}>二创</button><button type="button" className="btn-card-action secondary" onClick={event => { event.stopPropagation(); onDelete(row) }}>删除</button></>}</div>
  </article>
}
