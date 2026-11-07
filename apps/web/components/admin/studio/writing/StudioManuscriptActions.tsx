'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { WritingInput } from '../studio-writing-model'

export function StudioManuscriptActions({ draftId, input, setInput, disabled, onClear }: {
  draftId: string; input: WritingInput; setInput: Dispatch<SetStateAction<WritingInput>>; disabled: boolean; onClear: () => void
}) {
  const [cleared, setCleared] = useState<{ draftId: string; body: string; document: unknown } | null>(null)
  return <>
    <button type="button" className="btn ghost" disabled={disabled || !input.body}
      onClick={() => {
        setCleared({ draftId, body: input.body, document: input.config.manuscriptDocument })
        setInput(previous => {
          const config = { ...previous.config }; delete config.manuscriptDocument
          return { ...previous, body: '', config }
        })
        onClear()
      }}>清空稿件</button>
    {cleared?.draftId === draftId && !input.body && <button type="button" className="btn ghost" disabled={disabled}
      onClick={() => {
        setInput(previous => {
          if (previous.body) return previous
          const config = { ...previous.config }
          if (cleared.document === undefined) delete config.manuscriptDocument
          else config.manuscriptDocument = cleared.document
          return { ...previous, body: cleared.body, config }
        })
        setCleared(null)
      }}>撤销清空</button>}
  </>
}
