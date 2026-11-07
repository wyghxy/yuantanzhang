'use client'

import { memo, useEffect, useSyncExternalStore } from 'react'
import type { MaterialNotes } from './TranscriptExcerpt'
import { NoteRichEditor } from './NoteRichEditor'

/** Keep keystrokes local while the hook retains pending text across panels and sources. */
export const MaterialThoughtInput = memo(function MaterialThoughtInput({ input, disabled, label }: { input: MaterialNotes['input']; disabled: boolean; label: string }) {
  const value = useSyncExternalStore(input.subscribe, input.getSnapshot, input.getSnapshot)
  const document = useSyncExternalStore(input.subscribe, input.getDocumentSnapshot, input.getDocumentSnapshot)
  useEffect(() => () => input.compose(false), [input])
  return <NoteRichEditor simple label={label} value={value} document={document} disabled={disabled}
    onChange={input.editDocument} onCompose={input.compose} onBlur={() => void input.flush()} />
})
