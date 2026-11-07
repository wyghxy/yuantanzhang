'use client'

import { useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { WritingApiError, writingError, writingObject, type WritingDraft } from '../studio-writing-model'

/** React state describes the action; the ref closes same-event/double-click races before commit. */
export function useWritingOperation({ busy, alive, draftId, setBusy, setError, setConflict, pendingRef }: {
  busy: string; alive: RefObject<boolean>; draftId: string
  setBusy: Dispatch<SetStateAction<string>>; setError: Dispatch<SetStateAction<string>>
  setConflict: Dispatch<SetStateAction<WritingDraft | null>>
  pendingRef?: RefObject<boolean>
}) {
  const ownPending = useRef(false)
  return async (label: string, action: () => Promise<void>) => {
    if (busy || ownPending.current || pendingRef?.current) return
    ownPending.current = true
    if (pendingRef) pendingRef.current = true
    setBusy(label)
    setError('')
    try { await action() }
    catch (cause) {
      if (alive.current) {
        setError(writingError(cause))
        if (cause instanceof WritingApiError && cause.current && writingObject(cause.current).id === draftId)
          setConflict(cause.current as WritingDraft)
      }
    } finally {
      ownPending.current = false
      if (pendingRef) pendingRef.current = false
      if (alive.current) setBusy('')
    }
  }
}
