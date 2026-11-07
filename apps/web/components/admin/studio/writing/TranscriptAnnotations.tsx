'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ClipboardPaste, Pencil, Trash2, Undo2 } from 'lucide-react'
import type { MaterialNoteDocument } from '@ytz/contracts/studio-note-document'
import { NoteRichText } from './NoteRichText'
import { NoteRichEditor } from './NoteRichEditor'
import type { MaterialNotes } from './TranscriptExcerpt'
import { matchingNoteAnchors, type MaterialNoteAnchor, type MaterialNoteAnnotation } from '@ytz/contracts/studio-material-notes'
import styles from './TranscriptAnnotations.module.css'
import { useManuscriptInsertion } from './StudioManuscriptInsertion'
import { materialNoteDirty } from './studio-note-dirty'

/** Use DOM text offsets only inside source spans, excluding timestamps and note controls. */
export function selectedTranscriptAnchors(root: HTMLElement, selection: Selection | null): MaterialNoteAnchor[] {
  if (!selection || selection.isCollapsed || !selection.rangeCount || root.closest('[hidden]')) return []
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return []
  const anchors: MaterialNoteAnchor[] = []
  for (const span of root.querySelectorAll<HTMLElement>('[data-note-text]')) {
    if (!range.intersectsNode(span)) continue
    const part = document.createRange(); part.selectNodeContents(span)
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset)
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset)
    const quote = part.toString()
    if (!quote.trim()) continue
    const prefix = document.createRange(); prefix.selectNodeContents(span); prefix.setEnd(part.startContainer, part.startOffset)
    const blockText = span.textContent || '', start = prefix.toString().length
    anchors.push({ blockId: span.dataset.noteText || '', blockText, start, end: start + quote.length, quote, ...(span.dataset.noteTime ? { time: span.dataset.noteTime } : {}) })
  }
  return anchors
}

type Row = { id: string; text: string; time?: string }
export function AnnotatedTranscriptText({ row, notes, open, children }: {
  row: Row; notes: MaterialNoteAnnotation[]; open: (ids: string[], target: HTMLElement) => void
  children?: (render: (text: string, offset: number, insideButton?: boolean) => ReactNode) => ReactNode
}) {
  const matches = matchingNoteAnchors(notes, row.id, row.text)
  const keyboardNotes = new Set<string>()
  function render(value: string, offset: number, insideButton = Boolean(children)) {
    const cuts = [...new Set([0, value.length, ...matches.flatMap(({ anchor }) => [anchor.start - offset, anchor.end - offset]).filter(at => at > 0 && at < value.length)])].sort((a, b) => a - b)
    return cuts.slice(0, -1).map((start, index) => {
      const end = cuts[index + 1]
      const ids = [...new Set(matches.filter(({ anchor }) => anchor.start < end + offset && anchor.end > start + offset).map(({ note }) => note.id))]
      if (insideButton) ids.forEach(id => keyboardNotes.add(id))
      return <span key={start} data-note-ids={ids.length ? JSON.stringify(ids) : undefined} className={ids.length ? styles.underline : undefined}
        role={ids.length && !insideButton ? 'button' : undefined} tabIndex={ids.length && !insideButton ? 0 : undefined}
        aria-label={ids.length ? '查看笔记：' + value.slice(start, end) : undefined}>{value.slice(start, end)}</span>
    })
  }
  const content = children ? children(render) : render(row.text, 0)
  return <><span data-note-text={row.id} data-note-time={row.time} className={styles.sourceText} onKeyDownCapture={event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target?.matches('[data-note-ids][role="button"]') || !event.currentTarget.contains(target)) return
    event.preventDefault(); event.stopPropagation(); open(JSON.parse(target.dataset.noteIds || '[]') as string[], target)
  }} onClickCapture={event => {
    if (window.getSelection()?.isCollapsed === false) return
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-note-ids]') : null
    if (!target || !event.currentTarget.contains(target)) return
    event.preventDefault(); event.stopPropagation()
    open(JSON.parse(target.dataset.noteIds || '[]') as string[], target)
  }}>{content}</span>{keyboardNotes.size > 0 && <span className={styles.keyboardNotes} data-component-ui>
    {notes.filter(note => keyboardNotes.has(note.id)).map(note => {
      const quote = matches.filter(match => match.note.id === note.id).map(match => match.anchor.quote).join('；')
      return <button key={note.id} type="button" className={styles.keyboardNote} data-note-keyboard-entry={note.id}
        aria-label={'查看笔记：' + quote} onClick={event => open([note.id], event.currentTarget)}>查看笔记：{quote}</button>
    })}
  </span>}</>
}

type UpdateThought = (id: string, text: string, document?: MaterialNoteDocument) => string
type ThoughtSaving = { compose: (value: boolean) => void; flush: () => Promise<void> }
export function MaterialNoteCard({ note, onRemove, onUpdateThought, thoughtSaving }: { note: MaterialNoteAnnotation; onRemove?: (id: string) => void; onUpdateThought?: UpdateThought; thoughtSaving?: ThoughtSaving }) {
  const insertion = useManuscriptInsertion()
  const [pasteStatus, setPasteStatus] = useState(''), [pasting, setPasting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ text: string; document?: MaterialNoteDocument }>({ text: note.thought, document: note.thoughtDocument })
  const [editError, setEditError] = useState('')
  const dirtyOwner = useRef(Symbol('annotation-thought-draft'))
  useEffect(() => {
    const owner = dirtyOwner.current
    materialNoteDirty('studio-excerpt-dirty', owner, !!editError)
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    if (editError) window.addEventListener('beforeunload', prevent)
    return () => {
      materialNoteDirty('studio-excerpt-dirty', owner, false)
      window.removeEventListener('beforeunload', prevent)
    }
  }, [editError])
  return <article className={styles.card} data-note-id={note.id}>
    <blockquote>{note.anchors.map((anchor, index) => <p key={index}>{anchor.time && <span className={styles.time}>{anchor.time} </span>}{anchor.quote}</p>)}</blockquote>
    {editing ? <div className={styles.thought}>
      <NoteRichEditor simple value={draft.text} document={draft.document} label="编辑笔记想法" onChange={(text, rich) => { setDraft({ text, document: rich }); setEditError(onUpdateThought?.(note.id, text, rich) || '') }}
        onCompose={thoughtSaving?.compose} onBlur={() => void thoughtSaving?.flush()} />
      <div className={styles.cardActions}><button type="button" className={styles.copyButton} disabled={!!editError} onClick={() => setEditing(false)}>完成</button></div>
      {editError && <p role="alert">{editError}</p>}
    </div> : note.thought.trim() && <div className={styles.thought}><NoteRichText text={note.thought} document={note.thoughtDocument} /></div>}
    <div className={styles.cardActions} data-component-ui><button type="button" className={styles.copyButton} aria-label="粘贴这条笔记"
      disabled={!insertion || insertion.disabled || pasting || !!editError} title={!insertion ? '在创作中心打开稿件后粘贴' : undefined} onClick={async () => {
        if (!insertion) return
        setPasting(true)
        try {
          const success = await insertion.paste([...note.anchors.map(anchor => `${anchor.time ? anchor.time + ' ' : ''}${anchor.quote}`), note.thought].filter(Boolean).join('\n\n'))
          setPasteStatus(success ? '已粘贴到稿件' : '未能粘贴，请回到稿件后重试')
        } finally { setPasting(false) }
      }}><ClipboardPaste size={15} aria-hidden />粘贴</button>
      {onUpdateThought && !editing && <button type="button" className={styles.copyButton} aria-label="编辑这条笔记的想法" onClick={() => { setDraft({ text: note.thought, document: note.thoughtDocument }); setEditing(true) }}><Pencil size={15} aria-hidden />编辑</button>}
      {onRemove && <button type="button" className={styles.copyButton} aria-label="删除这条笔记" disabled={!!editError} onClick={() => onRemove(note.id)}><Trash2 size={15} aria-hidden />删除</button>}
      <span role="status" className={pasteStatus === '已粘贴到稿件' ? styles.srOnly : undefined}>{pasteStatus}</span></div>
  </article>
}
export function MaterialAnnotationList({ notes, onRemove, onUpdateThought, thoughtSaving }: { notes: MaterialNoteAnnotation[]; onRemove?: (id: string) => void; onUpdateThought?: UpdateThought; thoughtSaving?: ThoughtSaving }) {
  return <section className={styles.list} aria-label="划线笔记"><h3>划线笔记{notes.length ? ` · ${notes.length}` : ''}</h3>
    {notes.length ? <div className={styles.paper}>{notes.map(note => <MaterialNoteCard key={note.id} note={note} onRemove={onRemove} onUpdateThought={onUpdateThought} thoughtSaving={thoughtSaving} />)}</div> : <p>在原文中选中文字，即可添加笔记。</p>}</section>
}

/** Undo stays available for this material during this page session, including failed saves. */
export function MaterialNoteRemoval({ notes, disabled = false }: { notes: MaterialNotes; disabled?: boolean }) {
  if (!notes.removedCount) return null
  return <div className={styles.removal} data-component-ui aria-label="笔记删除恢复">
    <span role="status">已删除 {notes.removedCount} 条 · 本页可撤销 · {notes.status}</span>
    <button type="button" className={styles.copyButton} disabled={disabled} onClick={notes.undoRemove}><Undo2 size={15} aria-hidden />撤销删除</button>
    {notes.error && <><p role="alert">{notes.error}</p><button type="button" className={styles.copyButton} disabled={disabled || notes.busy} onClick={() => void notes.save()}>重试保存笔记</button></>}
  </div>
}
