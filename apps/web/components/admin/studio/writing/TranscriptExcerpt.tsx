'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MaterialNoteAnchor, MaterialNoteAnnotation } from '@ytz/contracts/studio-material-notes'
import type { useMaterialNotes } from './useMaterialNotes'
import { AnnotatedTranscriptText, MaterialNoteCard, MaterialNoteRemoval, selectedTranscriptAnchors } from './TranscriptAnnotations'
import styles from './StudioWritingPlayback.module.css'
import { materialNoteDirty } from './studio-note-dirty'
import { TranscriptNotePopover, type NotePosition } from './TranscriptNotePopover'
import { useTranscriptSelection } from './useTranscriptSelection'
import type { MaterialNoteDocument } from '@ytz/contracts/studio-note-document'
import { NoteRichEditor } from './NoteRichEditor'
import { emptyExcerptOwner, transcriptExcerptOwner } from './transcript-excerpt-owner'

export type MaterialNotes = ReturnType<typeof useMaterialNotes>
export type ExcerptRow = { id: string; text: string; time?: string }
type Buffer = { selecting: boolean; rows: ExcerptRow[]; anchors: MaterialNoteAnchor[]; thought: string; thoughtDocument?: MaterialNoteDocument; notice: string; origin?: MaterialNotes['source'] }
const empty: Buffer = { selecting: false, rows: [], anchors: [], thought: '', notice: '' }
const noAnnotations: MaterialNoteAnnotation[] = []

/** Selection and unsubmitted thoughts belong to one reference, never the writing body. */
export function useTranscriptExcerpt(sourceId: string, notes?: MaterialNotes, disabled = false, label = '逐字稿') {
  const [buffers, setBuffers] = useState<Record<string, Buffer>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const selectionRoot = useCallback((element: HTMLDivElement | null) => { rootRef.current = element }, [])
  const [dirtyOwner] = useState(() => Symbol('transcript-excerpt'))
  const ownerStore = transcriptExcerptOwner()
  const ownership = useSyncExternalStore(ownerStore.subscribe, ownerStore.getSnapshot, () => emptyExcerptOwner)
  const [opened, setOpened] = useState<{ sourceId: string; ids: string[]; position: NotePosition } | null>(null)
  const [selectionPosition, setSelectionPosition] = useState<{ sourceId: string; position: NotePosition } | null>(null)
  const current = buffers[sourceId] || empty
  const active = ownership.owner === dirtyOwner
  const enabled = !!notes
  const sourceMaterialId = notes?.source.sourceMaterialId
  const sourceVersion = notes?.source.sourceVersion
  const pending = Object.values(buffers).some(value => value.thought.trim() || value.rows.length || value.anchors.length)
  const capture = useCallback(() => {
      if (!sourceMaterialId || typeof sourceVersion !== 'number') return
      const root = rootRef.current
      if (!root) return
      const anchors = selectedTranscriptAnchors(root, window.getSelection())
      if (!anchors.length) return
      ownerStore.activate(dirtyOwner, false, true)
      const range = window.getSelection()!.getRangeAt(0).cloneRange()
      setSelectionPosition({ sourceId, position: { target: range, root } })
      setOpened(null)
      setBuffers(previous => {
        const old = previous[sourceId] || empty
        if (old.selecting && JSON.stringify(old.anchors) === JSON.stringify(anchors)) return previous
        return { ...previous, [sourceId]: { ...old, selecting: true, rows: [], anchors, origin: { sourceMaterialId, sourceVersion }, notice: '' } }
      })
  }, [sourceId, sourceMaterialId, sourceVersion, ownerStore, dirtyOwner])
  const selection = useTranscriptSelection(rootRef, enabled && !disabled && !!notes?.ready, capture)
  useEffect(() => {
    materialNoteDirty('studio-excerpt-dirty', dirtyOwner, enabled && pending)
  }, [pending, enabled, dirtyOwner])
  useEffect(() => {
    const owner = dirtyOwner
    return () => materialNoteDirty('studio-excerpt-dirty', owner, false)
  }, [dirtyOwner])
  useEffect(() => {
    if (!pending) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [pending])
  const change = (update: (previous: Buffer) => Buffer) => setBuffers(previous => ({ ...previous, [sourceId]: update(previous[sourceId] || empty) }))
  const unavailable = disabled || !notes?.ready
  const checkbox = (row: ExcerptRow) => notes && ownership.enabled && <input type="checkbox"
    data-excerpt-checkbox className={styles.excerptCheck} aria-label={'摘录：' + (row.time || row.text.slice(0, 24))}
    checked={current.rows.some(value => value.id === row.id)} disabled={unavailable}
    onChange={event => {
      const checked = event.target.checked
      const root = rootRef.current
      ownerStore.activate(dirtyOwner, true, true)
      setSelectionPosition(root ? { sourceId, position: { target: event.currentTarget, root } } : null)
      setOpened(null)
      change(previous => ({ ...previous, selecting: true, notice: '', anchors: [], origin: notes.source, rows: checked ? [...previous.rows.filter(value => value.id !== row.id), row] : previous.rows.filter(value => value.id !== row.id) }))
    }} />
  const toggle = notes && <button type="button" className="btn ghost cw-mode-button" aria-pressed={active && current.selecting}
    disabled={unavailable} onClick={() => {
      setSelectionPosition(null)
      if (active && current.selecting) ownerStore.close()
      else ownerStore.activate(dirtyOwner, true, true)
      change(previous => ({ ...previous, selecting: !(active && previous.selecting) }))
    }}>摘录笔记</button>
  const composerBody = notes && active && current.selecting && !selection.selecting && <div className={styles.excerptComposer} role="group" aria-label={label + '摘录笔记'}>
    <div><span>已选 {current.anchors.length || current.rows.length} 段</span><NoteRichEditor simple key={sourceId} label="摘录想法"
      value={current.thought} document={current.thoughtDocument} disabled={unavailable}
      onChange={(thought, thoughtDocument) => change(previous => ({ ...previous, thought, thoughtDocument, notice: '' }))} /></div>
    {!!current.anchors.length && <p aria-label="已选原文">{current.anchors.map(anchor => anchor.quote).join('\n')}</p>}
    <div className={styles.excerptActions}><button type="button" className="btn primary" disabled={unavailable || (!current.anchors.length && !current.rows.length && !current.thought.trim())}
      onClick={() => {
        const anchors = current.anchors.length ? current.anchors : current.rows.map(row => ({ blockId: row.id, blockText: row.text, start: 0, end: row.text.length, quote: row.text, ...(row.time ? { time: row.time } : {}) }))
        const error = anchors.length ? notes.annotate(anchors, current.thought, current.origin, current.thoughtDocument) : notes.append(current.thought, current.thoughtDocument)
        if (!error) { window.getSelection()?.removeAllRanges(); setSelectionPosition(null) }
        change(previous => error ? { ...previous, notice: error } : { ...empty, selecting: selectionPosition?.sourceId !== sourceId, notice: '已添加到“我的笔记”' })
      }}>添加到笔记</button>
      {(current.anchors.length > 0 || current.rows.length > 0 || !!current.thought) && <button type="button" className="btn ghost" onClick={() => { window.getSelection()?.removeAllRanges(); setSelectionPosition(null); change(() => ({ ...empty, selecting: selectionPosition?.sourceId !== sourceId })) }}>取消摘录</button>}
      <span role="status">{current.notice}</span></div>
    {notes.error && <p role="alert">{notes.error}<button type="button" className="btn ghost" onClick={() => void notes.save()}>重试保存笔记</button></p>}
  </div>
  const composer = composerBody && selectionPosition?.sourceId === sourceId
    ? <TranscriptNotePopover position={selectionPosition.position} title="摘录笔记" restoreFocus={() => ownerStore.isCurrent(ownership, dirtyOwner)} keepOpenFor={target => target instanceof HTMLInputElement && target.hasAttribute('data-excerpt-checkbox') && selectionPosition.position.root.contains(target)} close={() => {
      // An unmounted popover can finish its outside/focus callbacks after this
      // source has been reopened. Only the currently owning session may close it.
      if (ownerStore.isCurrent(ownership, dirtyOwner)) change(previous => ({ ...previous, selecting: false }))
    }}>{composerBody}</TranscriptNotePopover> : composerBody
  const activeNotes = active && opened?.sourceId === sourceId ? notes?.annotations.filter(note => opened.ids.includes(note.id)) || [] : []
  const openedNote = <>
    {!!activeNotes.length && opened && <TranscriptNotePopover position={opened.position} title={activeNotes.length > 1 ? `对应笔记 · ${activeNotes.length}` : '对应笔记'} restoreFocus={() => ownerStore.isCurrent(ownership, dirtyOwner)} close={() => setOpened(null)}><div role="region" aria-label="原文对应笔记">{activeNotes.map(note => <MaterialNoteCard key={note.id} note={note} onRemove={unavailable ? undefined : id => { notes?.remove(id); setOpened(null) }} />)}</div></TranscriptNotePopover>}
    {notes && <MaterialNoteRemoval notes={notes} disabled={unavailable} />}
  </>
  const annotations = notes?.visibleAnnotations || noAnnotations
  const open = useCallback((ids: string[], target: HTMLElement) => {
    ownerStore.activate(dirtyOwner, false, true)
    if (rootRef.current) setOpened({ sourceId, ids, position: { target, root: rootRef.current } })
    setBuffers(previous => ({ ...previous, [sourceId]: { ...(previous[sourceId] || empty), selecting: false } }))
  }, [sourceId, ownerStore, dirtyOwner])
  const annotatedText = useCallback((row: ExcerptRow, children?: Parameters<typeof AnnotatedTranscriptText>[0]['children']) => <AnnotatedTranscriptText row={row} notes={annotations} open={open}>{children}</AnnotatedTranscriptText>, [annotations, open])
  return { checkbox, toggle, composer, selectionRoot, annotatedText, openedNote,
    selectionPending: selection.pending, interacting: selection.selecting || active && (current.selecting || opened?.sourceId === sourceId) }
}
