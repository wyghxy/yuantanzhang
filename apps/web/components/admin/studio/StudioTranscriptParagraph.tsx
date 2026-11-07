'use client'

import { memo, useMemo, type ReactNode } from 'react'
import { transcriptChunks } from './studio-transcript-chunks'

export const StudioTranscriptParagraph = memo(function StudioTranscriptParagraph({ text, className, prefix }: {
  text: string; className?: string; prefix?: ReactNode
}) {
  const chunks = useMemo(() => transcriptChunks(text), [text])
  return <>{chunks.map((chunk, index) => <p key={index} className={className} style={{
    contentVisibility: 'auto', containIntrinsicSize: 'auto 80px',
    ...(index > 0 ? { marginTop: 0 } : {}), ...(index < chunks.length - 1 ? { marginBottom: 0 } : {}),
  }}>{index === 0 && prefix}{chunk}</p>)}</>
})
