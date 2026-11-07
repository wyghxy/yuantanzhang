'use client'
import type { ReactNode } from 'react'
import Image from 'next/image'
import { ChevronRight, PlaySquare, Play } from 'lucide-react'
import { dateLabel, object, text, type RecordItem } from './studio-client'
import { studioPlatforms, studioSafeUrl } from './studio-operations-utils'
import { StudioPlatformIcon, useStudioPrivacy } from './StudioPrivacy'

export function RadarMaterial({ item, onOpen, children, variant = 'reading' }: {
  item: RecordItem; onOpen: (id: string) => void; children?: ReactNode; variant?: 'reading' | 'hot'
}) {
  const { platformLabel, creatorName, materialTitle } = useStudioPrivacy()
  const cover = studioSafeUrl(item.coverUrl || item.cover_url)
  const platform = studioPlatforms.find(value => value.key === item.platform)
  const mark = platform && <StudioPlatformIcon className={'platform-mark ' + platform.icon}>{platform.symbol}</StudioPlatformIcon>
  const thumbnail = cover ? <Image src={cover} width={104} height={68} alt="" unoptimized referrerPolicy="no-referrer" loading="lazy" /> : <PlaySquare className="icon" aria-hidden="true" />
  if (variant === 'hot') return <button className="hot-card" onClick={() => onOpen(item.id)} aria-label={'查看推荐：' + materialTitle(item.title)}>
    <span className="hot-cover">{thumbnail}<span className="cover-play"><Play className="icon" /></span></span>
    <span className="hot-copy"><strong>{materialTitle(item.title, '未命名作品')}</strong><span className="hot-meta"><span className="hot-platform"><span>{platformLabel(item.platform)}</span>{mark}</span><span>{dateLabel(item.createdAt)}</span>{!!item.recommendationLabel && <span className="hot-reason">{text(item.recommendationLabel)}</span>}{Number(object(item.metrics).likes) > 0 && <span>{Number(object(item.metrics).likes).toLocaleString('zh-CN')} 赞</span>}</span></span><ChevronRight className="icon" />
  </button>
  return <div className="reading-item"><button className="work-row" onClick={() => onOpen(item.id)}>
    <span className="work-thumb">{thumbnail}</span>
    <span className="work-detail"><span className="work-title">{materialTitle(item.title, '未命名作品')}</span><span className="work-meta">{mark}<b>{platformLabel(item.platform)}</b>{!!item.author && <><i /><span>{creatorName(item.author)}</span></>}</span></span>
    <time className="work-time">{dateLabel(item.createdAt)}</time><ChevronRight className="icon" aria-hidden="true" />
  </button>{children}</div>
}
