'use client'
import { useStudioPrivacy } from '../StudioPrivacy'

import type { JSX, Dispatch, SetStateAction } from 'react'

import Image from 'next/image'

import {
  api,
  object,
  text,
  dateLabel,
  isSample,
  type RecordItem,
} from '../studio-client'

import { Busy, Details, Empty, Platform, SourceLink } from '../StudioUI'
import { studioSafeUrl } from '../studio-operations-utils'

import { groupStudioWorks } from '../StudioMaterialHelpers'
import { studioCollectionBodyState } from '../studio-collection-state'

export function StudioWorksView({
  pills,
  accountId,
  setAccountId,
  setOffset,
  setSelected,
  allAccounts,
  platform,
  filters,
  search,
  loading,
  items,
  selected,
  materialButtons,
  busy,
  perform,
  onTask,
  notify,
}: {
  pills: JSX.Element
  accountId: string
  setAccountId: Dispatch<SetStateAction<string>>
  setOffset: Dispatch<SetStateAction<number>>
  setSelected: Dispatch<SetStateAction<RecordItem | null>>
  allAccounts: RecordItem[]
  platform: string
  filters: JSX.Element
  search: JSX.Element
  loading: boolean
  items: RecordItem[]
  selected: RecordItem | null
  materialButtons: (row: RecordItem) => JSX.Element
  busy: boolean
  perform: (fn: () => Promise<void>) => Promise<void>
  onTask: (id: string) => void
  notify: (value: string) => void
}) {
  const { creatorName, materialTitle } = useStudioPrivacy()
  return (
    <div className="library-workbench">
      <aside className="library-rail" aria-label="作品库筛选">
        <div className="rail-section">
          <div className="rail-label">平台来源</div>
          <div className="rail-plat-list">{pills}</div>
        </div>
        <div className="rail-section">
          <div className="rail-label">博主</div>
          <div className="rail-creator-list">
            <button
              className={`creator-pill-btn ${accountId === 'all' ? 'active' : ''}`}
              onClick={() => {
                setAccountId('all')
                setOffset(0)
                setSelected(null)
              }}
            >
              全部博主
            </button>
            {allAccounts
              .filter((row) => platform === 'all' || row.platform === platform)
              .map((row) => (
                <button
                  className={`creator-pill-btn ${accountId === row.id ? 'active' : ''}`}
                  key={row.id}
                  onClick={() => {
                    setAccountId(row.id)
                    setOffset(0)
                    setSelected(null)
                  }}
                >
                  {creatorName(row.name)}
                </button>
              ))}
          </div>
        </div>
        {filters}
      </aside>
      <div className="library-main-col">
        <div className="video-library-tools">{search}</div>
        <div className="video-card-list">
          {loading ? (
            <Busy />
          ) : items.length ? (
            groupStudioWorks(items).map((group) => (
              <div className="video-section-group" key={group.title}>
                <div className="video-section-title">
                  {group.title} · {group.items.length} 篇
                </div>
                {group.items.map((row) => {
                  const body = studioCollectionBodyState({ ...row, summaryOnly: true })
                  return (
                  <article
                    className={`video-card-item ${selected?.id === row.id ? 'selected' : ''}`}
                    key={row.id}
                    onClick={() => setSelected(row)}
                  >
                    <div className="video-card-thumb-wrap">
                      {studioSafeUrl(row.coverUrl || row.cover_url) && (
                        <Image
                          unoptimized
                          width={160}
                          height={90}
                          className="video-card-thumb-img"
                          src={studioSafeUrl(row.coverUrl || row.cover_url)!}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="video-card-play-icon">▶</div>
                    </div>
                    <div className="video-card-content">
                      <h3 className="video-card-title">
                        <button onClick={() => setSelected(row)}>
                          {materialTitle(row.title, '未命名作品')}
                        </button>
                      </h3>
                      <div className="video-card-meta">
                        <Platform value={row.platform} />
                        <span className="video-card-creator">
                          👤 {creatorName(row.author)}
                        </span>
                        <span>🕒 {dateLabel(row.publishedAt || row.createdAt)}</span>
                        <span className={`status-tag ${body.complete ? 'green' : 'gray'}`} title={body.hint}>
                          {body.label}
                        </span>
                        {isSample(row) && <span className="badge">试用样例</span>}
                      </div>
                    </div>
                    <div className="video-card-actions" onClick={(e) => e.stopPropagation()}>
                      {materialButtons(row)}
                    </div>
                  </article>
                  )
                })}
              </div>
            ))
          ) : (
            <Empty title="未找到符合条件的视频作品">
              <p>可调整平台、博主和时间筛选，或通过顶部链接导入。</p>
            </Empty>
          )}
        </div>
      </div>
      <aside className="library-context-panel" aria-label="选中视频详情">
        {selected ? (
          <>
            <div className="ctx-cover-wrap">
              {studioSafeUrl(selected.coverUrl || selected.cover_url) ? (
                <Image
                  unoptimized
                  width={320}
                  height={180}
                  className="ctx-cover-img"
                  src={studioSafeUrl(selected.coverUrl || selected.cover_url)!}
                  alt="作品封面"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="ctx-cover-fallback">▶</div>
              )}
            </div>
            <div className="ctx-body">
              <h3 className="ctx-title">{materialTitle(selected.title)}</h3>
              <div className="ctx-meta">
                <Platform value={selected.platform} />
                <span className="ctx-creator">{creatorName(selected.author)}</span>
              </div>
              <div className="ctx-facts">
                <span>🕒 {dateLabel(selected.publishedAt)}</span>
                <span className={`status-tag ${selected.status === 'ready' ? 'green' : 'gray'}`}>
                  {selected.status === 'ready'
                    ? selected.contentKind === 'article'
                      ? '✓ 正文已保存'
                      : '✓ 正文已就绪'
                    : selected.contentKind === 'article'
                      ? '待获取正文'
                      : '待转写'}
                </span>
              </div>
              {!!(selected.description || selected.summary) && (
                <p className="ctx-summary">{text(selected.description || selected.summary)}</p>
              )}
              <div className="ctx-actions">
                {materialButtons(selected)}
                <SourceLink item={selected} />
              </div>
              <details className="original-record-tools">
                <summary>指标详情与重新处理</summary>
                <Details value={selected.metrics} />
                {!Object.keys(object(selected.metrics)).length && (
                  <p className="ctx-hint">尚无可用指标，未知值未计为 0。</p>
                )}
                <button
                  className="btn ghost"
                  disabled={busy || !selected.materialId}
                  onClick={() =>
                    void perform(async () => {
                      const d = await api('tasks', 'POST', {
                        kind: 'import',
                        materialId: selected.materialId,
                        idempotencyKey: crypto.randomUUID(),
                      })
                      onTask(text(object(d.task).id))
                      notify('重新处理任务已入队')
                    })
                  }
                >
                  重新处理
                </button>
              </details>
            </div>
          </>
        ) : (
          <div className="ctx-empty">
            <div className="ctx-empty-icon">🎬</div>
            <p>
              点击中间任意作品
              <br />
              在这里查看详情与入口
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
