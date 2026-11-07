'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, apiFresh, errorText, object, StudioClientError, text } from '../studio-client'
import { detailRecord } from '../studio-detail-record'
import type { WritingRecord } from '../studio-writing-model'
import { materialAnnotations, validMaterialAnnotations, type MaterialNoteAnchor, type MaterialNoteAnnotation } from '@ytz/contracts/studio-material-notes'
import { materialNoteDocumentFromText, materialNoteDocumentText, validMaterialNoteDocument, type MaterialNoteDocument, type MaterialNoteNode } from '@ytz/contracts/studio-note-document'
import { materialNoteDirty } from './studio-note-dirty'

type RemovedNote = { annotation: MaterialNoteAnnotation; index: number }
type Note = { value: string; saved: string; document: MaterialNoteDocument | null; savedDocument: MaterialNoteDocument | null; annotations: MaterialNoteAnnotation[]; savedAnnotations: MaterialNoteAnnotation[]; removed: RemovedNote[]; version: number; editRevision: number; busy: boolean; error: string; composing?: boolean; inputPending?: boolean }
const emptyAnnotations: MaterialNoteAnnotation[] = []
// PostgreSQL JSONB may reorder keys. That must not create false conflicts or endless saves.
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => jsonEqual(value, b[index]))
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left).filter(key => left[key] !== undefined)
  return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length && keys.every(key => jsonEqual(left[key], right[key]))
}
const annotationsEqual = (a: MaterialNoteAnnotation[], b: MaterialNoteAnnotation[]) => jsonEqual(a, b)
const documentFor = (value: unknown, plain: string) => validMaterialNoteDocument(value, plain) ? value : null
const dirty = (note: Note) => note.value !== note.saved || !jsonEqual(note.document, note.savedDocument) || !annotationsEqual(note.annotations, note.savedAnnotations)
/** Trim only the appended range, keeping its text marks and block structure. */
function trimmedDocument(document: MaterialNoteDocument, value: string) {
  const trimmed = value.trim()
  if (trimmed === value) return document
  const start = value.length - value.trimStart().length, end = value.trimEnd().length
  const plain = (node: MaterialNoteNode): string => node.type === 'text' ? node.text || '' : node.type === 'hardBreak' ? '\n' : (node.content || []).map(plain).join(node.type === 'paragraph' || node.type === 'heading' ? '' : '\n')
  function crop(node: MaterialNoteNode, offset: number): MaterialNoteNode | null {
    if (node.type === 'text') {
      const text = (node.text || '').slice(Math.max(0, start - offset), Math.max(0, end - offset))
      return text ? { ...node, text } : null
    }
    if (node.type === 'hardBreak') return offset >= start && offset < end ? node : null
    const content: MaterialNoteNode[] = []
    const separator = node.type === 'paragraph' || node.type === 'heading' ? 0 : 1
    for (const child of node.content || []) {
      const length = plain(child).length
      if (length ? offset < end && offset + length > start : offset > start && offset < end) {
        const kept = crop(child, offset)
        if (kept) content.push(kept)
      }
      offset += length + separator
    }
    return { ...node, content }
  }
  const next = crop(document, 0)
  return validMaterialNoteDocument(next, trimmed) ? next : null
}
function useVisibleAnnotations(annotations: MaterialNoteAnnotation[], sourceMaterialId: string) {
  return useMemo(() => annotations.filter(entry => entry.sourceMaterialId === sourceMaterialId), [annotations, sourceMaterialId])
}

/** Keep each source's pending edits while the reader browses other sources or tabs. */
export function useMaterialNotes(material: WritingRecord | null) {
  const entries = useRef(new Map<string, Note>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inputListeners = useRef(new Set<() => void>())
  const mounted = useRef(true)
  const dirtyOwner = useRef(Symbol('material-notes'))
  const [snapshot, setSnapshot] = useState<Map<string, Note>>(() => new Map())
  const [reloadPrompt, setReloadPrompt] = useState<{ sourceId: string; editRevision: number } | null>(null)
  const reloadPromptRef = useRef(reloadPrompt)
  useLayoutEffect(() => { reloadPromptRef.current = reloadPrompt }, [reloadPrompt])
  const id = text(material?.id)
  const shared = object(material?.sharedReference)
  const source = { sourceMaterialId: text(shared.primaryMaterialId) || id, sourceVersion: Number(shared.primaryMaterialId ? shared.version : material?.version) }
  if (reloadPrompt && reloadPrompt.sourceId !== id) setReloadPrompt(null)
  function changed() {
    if (!mounted.current) return
    for (const listener of inputListeners.current) listener()
    setSnapshot(new Map([...entries.current].map(([key, note]) => [key, { ...note }])))
    materialNoteDirty('studio-notes-dirty', dirtyOwner.current, [...entries.current.values()].some(note => dirty(note) || note.busy))
  }
  useEffect(() => {
    mounted.current = true
    const pendingTimers = timers.current
    const owner = dirtyOwner.current
    const beforeLeave = (event: BeforeUnloadEvent) => {
      if ([...entries.current.values()].some(note => dirty(note) || note.busy)) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeLeave)
    return () => {
      mounted.current = false
      for (const timer of pendingTimers.values()) clearTimeout(timer)
      window.removeEventListener('beforeunload', beforeLeave)
      materialNoteDirty('studio-notes-dirty', owner, false)
    }
  }, [])
  useEffect(() => {
    if (!id || !material) return
    const note = entries.current.get(id)
    if (!note || (!note.busy && !note.composing && !note.error && !dirty(note) && Number(material.version) > note.version)) {
      const value = text(material.notes)
      const document = documentFor(material.notesDocument, value)
      const annotations = materialAnnotations(material.noteAnnotations, id)
      entries.current.set(id, { value, saved: value, document, savedDocument: document, annotations, savedAnnotations: annotations, removed: note?.removed || [], version: Number(material.version), editRevision: 0, busy: false, error: '' })
      changed()
    }
  }, [id, material])

  async function save(sourceId = id) {
    const note = entries.current.get(sourceId)
    clearTimeout(timers.current.get(sourceId)); timers.current.delete(sourceId)
    if (!note || note.busy || note.composing || !dirty(note)) return
    setReloadPrompt(previous => previous?.sourceId === sourceId ? null : previous)
    const value = note.value
    const document = note.document
    const annotations = note.annotations
    // Legacy text edits omit the field; the server clears stale formatting when text changes.
    const payload = { notes: value, noteAnnotations: annotations, ...(document ? { notesDocument: document } : {}) }
    note.busy = true; note.error = ''; changed()
    try {
      let result
      try {
        result = await api('materials/' + encodeURIComponent(sourceId), 'PATCH', { expectedVersion: note.version, ...payload })
      } catch (cause) {
        if (!(cause instanceof StudioClientError) || cause.status !== 409) throw cause
        const response = await apiFresh('materials/' + encodeURIComponent(sourceId))
        const latest = object(detailRecord(response))
        // A read-state / transcription change may advance the entity without changing its notes.
        if (text(latest.notes) !== note.saved || !jsonEqual(documentFor(latest.notesDocument, text(latest.notes)), note.savedDocument) || !annotationsEqual(materialAnnotations(latest.noteAnnotations, sourceId), note.savedAnnotations)) throw new Error('这篇作品的笔记已在其他窗口修改。你的输入已保留，请复制后重新读取并合并。')
        result = await api('materials/' + encodeURIComponent(sourceId), 'PATCH', { expectedVersion: latest.version, ...payload })
      }
      const saved = object(result.material || result.item)
      const normalized = materialAnnotations(saved.noteAnnotations, sourceId)
      const persisted = new Map(normalized.map(entry => [entry.id, entry]))
      const savedDocument = documentFor(saved.notesDocument, value)
      if (('notesDocument' in payload && !jsonEqual(document, savedDocument)) || annotations.some(entry => entry.thoughtDocument && !jsonEqual(entry.thoughtDocument, persisted.get(entry.id)?.thoughtDocument))) throw new Error('笔记格式尚未完整保存。你的输入已保留，请重试。')
      note.annotations = note.annotations.map(entry => annotations.includes(entry) ? persisted.get(entry.id) || entry : entry)
      if (note.document === document) note.document = savedDocument
      note.saved = value; note.savedDocument = savedDocument; note.savedAnnotations = normalized; note.version = Number(saved.version)
    } catch (cause) { note.error = errorText(cause) }
    finally {
      note.busy = false; changed()
      if (mounted.current && !note.error && !note.composing && dirty(note) && (!note.inputPending || !timers.current.has(sourceId))) void save(sourceId)
    }
  }
  async function flush(sourceId = id) {
    // A failed save needs an explicit retry; blur must leave recovery actions available.
    if (entries.current.get(sourceId)?.error) return
    await save(sourceId)
  }
  function edited(note: Note, wasDirty: boolean, inputOnly = false) {
    if (reloadPromptRef.current) setReloadPrompt(null)
    note.editRevision += 1; note.inputPending = inputOnly
    // Input has its own subscription; only status transitions need the reader/player tree.
    if (!inputOnly || wasDirty !== dirty(note)) changed()
    else for (const listener of inputListeners.current) listener()
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    if (!note.error && !note.composing) timers.current.set(id, setTimeout(() => void save(id), 700))
  }
  function edit(value: string, inputOnly = false) {
    const note = entries.current.get(id)
    if (!note) return
    if (inputOnly && value === note.value) return
    const wasDirty = dirty(note)
    if (value !== note.value) note.document = null
    note.value = value
    edited(note, wasDirty, inputOnly)
  }
  function editDocument(value: string, document: MaterialNoteDocument | null, inputOnly = false) {
    const note = entries.current.get(id)
    if (!note) return
    if (value.length > 12000) { note.error = '笔记不能超过 12000 字，当前输入未提交。'; changed(); return }
    if (document !== null && !validMaterialNoteDocument(document, value)) { note.error = '笔记格式与文字不一致，未保存；当前输入已保留。'; changed(); return }
    // Explicit clear-format with unchanged text needs a plain document, never a null API value.
    if (document === null && note.document) document = materialNoteDocumentFromText(value)
    if (value === note.value && jsonEqual(document, note.document)) return
    const wasDirty = dirty(note)
    note.value = value; note.document = document
    edited(note, wasDirty, inputOnly)
  }
  const subscribe = useMemo(() => (listener: () => void) => {
    inputListeners.current.add(listener)
    return () => { inputListeners.current.delete(listener) }
  }, [])
  const input = useMemo(() => ({
    sourceId: id,
    getSnapshot: () => entries.current.get(id)?.value || '',
    getDocumentSnapshot: () => entries.current.get(id)?.document || null,
    subscribe,
    edit: (value: string) => edit(value, true),
    editDocument: (value: string, document: MaterialNoteDocument | null) => editDocument(value, document, true),
    compose: (composing: boolean) => {
      const note = entries.current.get(id)
      if (!note || Boolean(note.composing) === composing) return
      note.composing = composing
      clearTimeout(timers.current.get(id)); timers.current.delete(id)
      if (mounted.current && !composing && !note.error && dirty(note)) timers.current.set(id, setTimeout(() => void save(id), 700))
    },
    flush: () => flush(id),
  // The methods bind a source ID and otherwise read refs, not render snapshots.
   
  }), [id, subscribe])
  function append(value: string, addedDocument?: MaterialNoteDocument) {
    const note = entries.current.get(id)
    if (!note) return '笔记正在读取，请稍后再试。'
    const addition = value.trim()
    if (!addition) return ''
    const limitMessage = '添加后会超过 12000 字，请缩短摘录或先整理已有笔记。'
    if (addition.length > 12000) return limitMessage
    let document: MaterialNoteDocument | null = null
    let next = [note.value.trimEnd(), addition].filter(Boolean).join('\n\n')
    if (note.document || addedDocument) {
      const previous = note.document ? note.value : note.value.trimEnd()
      if ((previous ? previous.length + 2 : 0) + addition.length > 12000) return limitMessage
      if (addedDocument && !validMaterialNoteDocument(addedDocument, value)) return '想法格式与文字不一致，原笔记未更改。'
      const tail = addedDocument ? trimmedDocument(addedDocument, value) : materialNoteDocumentFromText(addition)
      if (!tail) return '无法完整追加想法格式，原笔记未更改。'
      const head = note.document || materialNoteDocumentFromText(previous)
      document = previous ? { type: 'doc', content: [...(head.content || []), { type: 'paragraph' }, ...(tail.content || [])] } : tail
      next = materialNoteDocumentText(document)
      if (!validMaterialNoteDocument(document, next)) return '添加后超出笔记格式限制，请先整理已有笔记。'
    }
    if (next.length > 12000) return limitMessage
    if (document) editDocument(next, document)
    else edit(next)
    return ''
  }
  function annotate(anchors: MaterialNoteAnchor[], thought: string, origin = source, document?: MaterialNoteDocument) {
    const note = entries.current.get(id)
    if (!note) return '笔记正在读取，请稍后再试。'
    const next = [...note.annotations, { id: crypto.randomUUID(), materialId: id, ...origin, createdAt: new Date().toISOString(), anchors, thought: document ? thought : thought.trim(), ...(document ? { thoughtDocument: document } : {}) }]
    if (!validMaterialAnnotations(next, id)) return '摘录超出限制。请缩短选区；每篇最多保存 100 条划线笔记。'
    note.annotations = next
    edit(note.value)
    return ''
  }
  function updateThought(annotationId: string, thought: string, document?: MaterialNoteDocument) {
    const note = entries.current.get(id)
    const entry = note?.annotations.find(item => item.id === annotationId)
    if (!note || !entry) return '笔记正在读取或已被删除，请稍后再试。'
    const thoughtDocument = document || (thought === entry.thought ? entry.thoughtDocument : undefined)
    const updated = { ...entry, thought, thoughtDocument }
    if (jsonEqual(updated, entry)) return ''
    const next = note.annotations.map(item => item === entry ? updated : item)
    if (!validMaterialAnnotations(next, id)) return '想法超出笔记限制或格式与文字不一致，未保存。'
    const wasDirty = dirty(note)
    note.annotations = next
    edited(note, wasDirty, true)
    return ''
  }
  function reload() {
    const note = entries.current.get(id)
    if (note && !note.busy) setReloadPrompt({ sourceId: id, editRevision: note.editRevision })
  }
  function remove(annotationId: string) {
    const note = entries.current.get(id)
    const index = note?.annotations.findIndex(entry => entry.id === annotationId) ?? -1
    if (!note || index < 0) return
    note.removed = [...note.removed, { annotation: note.annotations[index], index }]
    note.annotations = note.annotations.filter(entry => entry.id !== annotationId)
    edit(note.value)
  }
  function undoRemove() {
    const note = entries.current.get(id)
    const removed = note?.removed.at(-1)
    if (!note || !removed) return
    const existing = note.annotations.find(entry => entry.id === removed.annotation.id)
    if (existing && !annotationsEqual([existing], [removed.annotation])) {
      note.error = '这条笔记已在其他窗口修改，请先复制保留当前内容再合并。'; changed(); return
    }
    const next = [...note.annotations]
    if (!existing) next.splice(Math.min(removed.index, next.length), 0, removed.annotation)
    if (!validMaterialAnnotations(next, id)) {
      note.error = '恢复后会超过 100 条笔记，请先整理笔记；待恢复内容仍保留在本页。'; changed(); return
    }
    note.removed = note.removed.slice(0, -1)
    note.annotations = next
    edit(note.value)
  }
  function cancelReload() { setReloadPrompt(null) }
  async function confirmReload() {
    const note = entries.current.get(id)
    if (!note || note.busy || reloadPrompt?.sourceId !== id || reloadPrompt.editRevision !== note.editRevision) return
    setReloadPrompt(null)
    const editRevision = note.editRevision
    clearTimeout(timers.current.get(id)); timers.current.delete(id)
    note.busy = true; changed()
    try {
      const response = await apiFresh('materials/' + encodeURIComponent(id))
      const latest = object(detailRecord(response))
      // The confirmation covers existing edits, never input entered while this request is pending.
      if (note.editRevision !== editRevision) throw new Error('重新读取期间又有输入，已保留当前笔记。请复制后重新读取并合并。')
      note.value = note.saved = text(latest.notes); note.version = Number(latest.version); note.error = ''
      note.document = note.savedDocument = documentFor(latest.notesDocument, note.value)
      note.annotations = note.savedAnnotations = materialAnnotations(latest.noteAnnotations, id)
    } catch (cause) { note.error = errorText(cause) }
    finally {
      // Do not let a debounce created during the read silently save unmerged text after an error.
      clearTimeout(timers.current.get(id)); timers.current.delete(id)
      note.busy = false; changed()
    }
  }
  const note = snapshot.get(id)
  const annotations = note?.annotations || emptyAnnotations
  const visibleAnnotations = useVisibleAnnotations(annotations, source.sourceMaterialId)
  function exportText() {
    const current = entries.current.get(id)
    const active = current?.annotations || emptyAnnotations
    const exported = current?.error ? [...active, ...current.removed.map(entry => entry.annotation).filter(entry => !active.some(item => annotationsEqual([item], [entry])))] : active
    return [current?.value, ...exported.map(entry => [entry.anchors.map(anchor => (anchor.time ? '[' + anchor.time + '] ' : '') + anchor.quote).join('\n'), entry.thought && '我的想法：' + entry.thought].filter(Boolean).join('\n\n'))].filter(Boolean).join('\n\n')
  }
  return { get value() { return input.getSnapshot() }, input, source, annotations, visibleAnnotations, get exportText() { return exportText() }, annotate, updateThought, remove, undoRemove, removedCount: note?.removed.length || 0, ready: !!note, dirty: !!note && dirty(note), busy: note?.busy || false, error: note?.error || '', status: note?.busy ? '正在保存…' : note && dirty(note) ? '尚未保存' : '已保存', edit, append, save, flush, reload, cancelReload, confirmReload, reloadRequested: reloadPrompt?.sourceId === id }
}
