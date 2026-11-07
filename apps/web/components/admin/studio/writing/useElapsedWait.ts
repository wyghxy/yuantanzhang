'use client'
import { useEffect, useState } from 'react'

/** This measures this page's wait, not a provider ETA. Polling/phase changes keep the same clock. */
export function useElapsedWait(active: boolean, requestKey: string) {
  const [clock, setClock] = useState({ key: '', seconds: 0 })
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const timer = setInterval(() => setClock({ key: requestKey, seconds: Math.max(0, Math.floor((Date.now() - start) / 1000)) }), 1000)
    return () => clearInterval(timer)
  }, [active, requestKey])
  return clock.key === requestKey ? clock.seconds : 0
}
