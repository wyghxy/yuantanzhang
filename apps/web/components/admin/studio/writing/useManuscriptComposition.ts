'use client'

import { useCallback, useRef, useState } from 'react'

/** A synchronous guard covers same-event saves; state also cancels/restarts the debounce. */
export function useManuscriptComposition() {
  const composing = useRef(false)
  const [active, setActive] = useState(false)
  const change = useCallback((value: boolean) => {
    composing.current = value
    setActive(value)
  }, [])
  return { composing, active, change }
}
