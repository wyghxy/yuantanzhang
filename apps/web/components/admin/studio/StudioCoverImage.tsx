'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'

type CoverProps = {
  src?: string; version?: number; alt: string; width: number; height: number; className: string
  icon: ReactNode; compact?: boolean
}

function CoverImage({ src, alt, width, height, className, icon, compact }: CoverProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  if (!src) return <div className="library-media-icon">{icon}{!compact && <span>暂无封面</span>}</div>
  return <>
    {state === 'loading' && <div className="library-media-icon" aria-hidden="true">{icon}</div>}
    {state === 'failed' && <div className="library-media-icon">
      {!compact && <span role="status">封面暂未加载</span>}
      <button type="button" className="btn-card-action secondary" aria-label="重试封面" title="封面暂未加载，点击重试" onClick={event => {
        event.stopPropagation(); setAttempt(value => value + 1); setState('loading')
      }}>重试封面</button>
    </div>}
    {state !== 'failed' && <Image key={attempt} src={src} alt={alt} width={width} height={height} className={className}
      unoptimized referrerPolicy="no-referrer" onLoad={() => setState('loaded')} onError={() => setState('failed')} />}
  </>
}

/** A version change can retry a previously failed URL without modifying signed URLs. */
export default function StudioCoverImage(props: CoverProps) {
  return <CoverImage key={JSON.stringify([props.src || '', props.version ?? null])} {...props} />
}
