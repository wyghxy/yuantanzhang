'use client'

import { useEffect, useRef } from 'react'
import { object } from './studio-client'
import { flushStudioWritingEdits } from './studio-edit-flush'

export function useStudioEditGuard() {
  const readerDirty = useRef(false)
  const writingDirty = useRef(false)
  const topicDirty = useRef(false)
  const notesDirty = useRef(false)
  const excerptDirty = useRef(false)
  const sourcePlanDirty = useRef(false)

  useEffect(() => {
    const read = (event: Event) => {
      readerDirty.current = (event as CustomEvent).detail === true
    }
    const write = (event: Event) => {
      writingDirty.current = object((event as CustomEvent).detail).dirty === true
    }
    const topic = (event: Event) => {
      topicDirty.current = (event as CustomEvent).detail === true
    }
    const notes = (event: Event) => {
      notesDirty.current = (event as CustomEvent).detail === true
    }
    const excerpt = (event: Event) => {
      excerptDirty.current = (event as CustomEvent).detail === true
    }
    const plan = (event: Event) => {
      sourcePlanDirty.current = (event as CustomEvent).detail === true
    }

    window.addEventListener('studio-reader-dirty', read)
    window.addEventListener('studio-writing-dirty', write)
    window.addEventListener('studio-topic-dirty', topic)
    window.addEventListener('studio-notes-dirty', notes)
    window.addEventListener('studio-excerpt-dirty', excerpt)
    window.addEventListener('studio-source-plan-dirty', plan)
    return () => {
      window.removeEventListener('studio-reader-dirty', read)
      window.removeEventListener('studio-writing-dirty', write)
      window.removeEventListener('studio-topic-dirty', topic)
      window.removeEventListener('studio-notes-dirty', notes)
      window.removeEventListener('studio-excerpt-dirty', excerpt)
      window.removeEventListener('studio-source-plan-dirty', plan)
    }
  }, [])

  async function canLeave() {
    const writing = await flushStudioWritingEdits()
    if (writing.registered) writingDirty.current = writing.pending
    return !(readerDirty.current || writingDirty.current || topicDirty.current || notesDirty.current ||
      excerptDirty.current || sourcePlanDirty.current) ||
      window.confirm('当前编辑还没有保存，确认离开这个页面？')
  }

  return { readerDirty, writingDirty, canLeave }
}
