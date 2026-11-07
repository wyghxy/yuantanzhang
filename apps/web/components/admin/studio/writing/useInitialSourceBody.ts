'use client'
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { writingObject, writingReference, type WritingDraft, type WritingInput, type WritingRecord } from '../studio-writing-model'

/** An untouched, automatically seeded empty rewrite may receive its late original once. */
export function useInitialSourceBody(draft: WritingDraft | null, material: WritingRecord | null,
  input: WritingInput, setInput: Dispatch<SetStateAction<WritingInput>>, recovering: boolean) {
  const consumed = useRef(false)
  useEffect(() => {
    if (!draft || consumed.current) return
    // References on an original draft never seed its manuscript, including legacy markers.
    if (draft.topicId || !draft.materialId) { consumed.current = true; return }
    const seed = writingObject(draft.initialBodySource)
    if (recovering || draft.body || input.body || seed.pending !== true) { consumed.current = true; return }
    if (!material || material.id !== seed.requestedMaterialId) return
    const shared = writingObject(material.sharedReference)
    if ((shared.id || material.id) !== seed.materialId) return
    const body = writingReference(material).body
    if (!body.trim()) return
    consumed.current = true
    setInput(current => current.body ? current : { ...current, body })
  }, [draft, material, input.body, recovering, setInput])
}
