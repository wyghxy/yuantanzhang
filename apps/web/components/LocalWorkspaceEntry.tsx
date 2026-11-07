'use client'
import { useEffect, useState } from 'react'
import { openLocalSession } from '@/lib/local-session'

export default function LocalWorkspaceEntry() {
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void openLocalSession().then(() => { if (active) window.location.reload() })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '工作台暂时无法打开。') })
    return () => { active = false }
  }, [])
  return <main className="personal-entry" aria-busy={!error}>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => window.location.reload()}>重试</button></> : <p role="status">正在打开元探长…</p>}
  </main>
}
