'use client'

import type { MaterialNotes } from './TranscriptExcerpt'
import { MaterialAnnotationList, MaterialNoteRemoval } from './TranscriptAnnotations'
import { useState } from 'react'
import { MaterialThoughtInput } from './MaterialThoughtInput'
import styles from './TranscriptAnnotations.module.css'

/** Shared read/write surface; annotations and legacy free text are saved in one CAS. */
export function MaterialNotesPanel({ notes, disabled = false, textareaLabel = '自由笔记' }: { notes: MaterialNotes; disabled?: boolean; textareaLabel?: string }) {
  const [copyStatus, setCopyStatus] = useState('')
  return <section aria-label="我的笔记" data-material-notes className={styles.notesPanel}>
    <div className={styles.freeNote}><span>自己的想法</span><MaterialThoughtInput key={notes.input.sourceId} input={notes.input} label={textareaLabel} disabled={disabled || !notes.ready} /></div>
    <p role="status">{notes.status}</p>
    {notes.error && <div role="alert"><p>{notes.error}</p>
      <button className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(notes.exportText); setCopyStatus('已复制') } catch { setCopyStatus('复制失败，请选择文字复制') } }}>复制笔记</button><span role="status">{copyStatus}</span>
      <button className="btn ghost" disabled={notes.busy} onClick={() => void notes.save()}>重试保存笔记</button>
      <button className="btn ghost" disabled={notes.busy} onClick={notes.reload}>重新读取笔记</button>
    </div>}
    {notes.reloadRequested && <div role="group" aria-label="重新读取笔记确认"><p>重新读取会替换本页尚未保存的笔记。请先复制保留需要的内容。</p><button className="btn ghost" onClick={notes.cancelReload}>取消</button><button className="btn" onClick={() => void notes.confirmReload()}>确认重新读取</button></div>}
    <MaterialNoteRemoval notes={notes} disabled={disabled || !notes.ready} />
    <MaterialAnnotationList notes={notes.annotations} onRemove={disabled || !notes.ready ? undefined : notes.remove} onUpdateThought={disabled || !notes.ready ? undefined : notes.updateThought} thoughtSaving={notes.input} />
  </section>
}
