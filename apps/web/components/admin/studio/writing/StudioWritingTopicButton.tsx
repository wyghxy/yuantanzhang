'use client'

import { useState } from 'react'
import { api, errorText, type RecordItem } from '../studio-client'
import { StudioTopicDialog } from '../StudioTopicDialog'

export function StudioWritingTopicButton({ id, disabled, onError }: { id: string; disabled: boolean; onError: (message: string) => void }) {
  const [item, setItem] = useState<RecordItem | null>(null)
  const [busy, setBusy] = useState(false)
  async function open() {
    if (busy) return
    setBusy(true)
    try { setItem((await api('topics/' + encodeURIComponent(id))).item as RecordItem) }
    catch (cause) { onError(errorText(cause)) }
    finally { setBusy(false) }
  }
  return <>
    <button id="cw-organize" className="btn ghost" title="整理选题" disabled={disabled || busy} onClick={() => void open()}>整理选题</button>
    {item && <StudioTopicDialog item={item} close={() => setItem(null)} onSaved={() => setItem(null)} />}
  </>
}
