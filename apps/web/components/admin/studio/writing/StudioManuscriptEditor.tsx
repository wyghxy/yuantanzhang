'use client'

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { PlaybackTranscript } from '@ytz/contracts/studio-playback'
import type { WritingInput } from '../studio-writing-model'
import { editManuscript, manuscriptProjection, sourceManuscriptTimeline } from './manuscript-timeline'
import { manuscriptBlocks, manuscriptDocument, manuscriptTextOffset, MANUSCRIPT_LIMIT, type ManuscriptHandle } from './manuscript-rich-document'
import { useManuscriptInsertion } from './StudioManuscriptInsertion'
import { NoteRichEditor } from './NoteRichEditor'
import styles from './StudioManuscriptEditor.module.css'

const timeLabels = new PluginKey<ReturnType<typeof manuscriptProjection>['anchors']>('manuscriptTimeLabels')
const manuscriptExtensions = [Extension.create({ name: 'manuscriptTimeLabels', addProseMirrorPlugins: () => [new Plugin({
  key: timeLabels,
  state: { init: () => [], apply: (transaction, previous) => transaction.getMeta(timeLabels) ?? previous },
  props: { decorations(state) {
    const times = new Map((timeLabels.getState(state) ?? []).map(anchor => [anchor.offset, anchor.label]))
    return DecorationSet.create(state.doc, manuscriptBlocks(state.doc).flatMap(block => {
      const time = times.get(block.offset)
      return time ? [Decoration.node(block.position, block.position + block.node.nodeSize, { 'data-manuscript-time': time })] : []
    }))
  } },
})] })]

export function StudioManuscriptEditor({ input, setInput, textarea: textareaRef, frozen, hidden, dirty, busy, save, onSelection, sourceTranscript, toolbarTarget, onCompose }: {
  input: WritingInput; setInput: Dispatch<SetStateAction<WritingInput>>
  textarea: RefObject<ManuscriptHandle | null>; frozen: boolean; hidden: boolean
  dirty: boolean; busy: string; save: () => Promise<void>; onSelection: (value: string) => void
  sourceTranscript?: PlaybackTranscript
  toolbarTarget?: HTMLElement | null
  onCompose?: (value: boolean) => void
}) {
  const [editor, ready] = useState<Editor | null>(null)
  const [revision, refresh] = useState(0)
  const register = useManuscriptInsertion()?.register
  const composing = useRef(false), focused = useRef(false)
  const pending = useRef<{ text: string; resolve: (success: boolean) => void }[]>([])
  const timelineBody = useMemo(() => sourceManuscriptTimeline(input.body, sourceTranscript), [input.body, sourceTranscript])
  const projection = useMemo(() => manuscriptProjection(timelineBody), [timelineBody])
  const latest = useRef({ onSelection, projection })
  const history = useRef(new Map<string, string>())
  useLayoutEffect(() => {
    latest.current = { onSelection, projection }
    history.current.set(projection.text, timelineBody)
    if (history.current.size > 120) history.current.delete(history.current.keys().next().value!)
    if (editor && !editor.isDestroyed)
      editor.view.dispatch(editor.state.tr.setMeta(timeLabels, projection.anchors).setMeta('addToHistory', false))
  }, [editor, onSelection, projection, timelineBody])
  useImperativeHandle<ManuscriptHandle | null, ManuscriptHandle | null>(textareaRef, () => editor ? {
    get selectionStart() { return manuscriptTextOffset(editor.state.doc, editor.state.selection.from) },
    get selectionEnd() { return manuscriptTextOffset(editor.state.doc, editor.state.selection.to) },
    focus() { editor.commands.focus() },
  } : null, [editor])
  useEffect(() => {
    if (!editor) return
    const selection = () => {
      const { from, to } = editor.state.selection
      latest.current.onSelection(editor.state.doc.textBetween(from, to, '\n', '\n'))
    }
    const focus = () => { focused.current = true }
    editor.on('selectionUpdate', selection); editor.on('focus', focus)
    return () => { editor.off('selectionUpdate', selection); editor.off('focus', focus) }
  }, [editor])
  useEffect(() => register?.(text => new Promise<boolean>(resolve => {
    pending.current.push({ text, resolve }); refresh(value => value + 1)
  })), [register])
  useEffect(() => () => { pending.current.splice(0).forEach(request => request.resolve(false)) }, [])
  useEffect(() => {
    if (!editor || composing.current || hidden) return
    for (const request of pending.current.splice(0)) {
      if (frozen || editor.isDestroyed) { request.resolve(false); continue }
      const { from, to } = editor.state.selection
      const start = focused.current ? from : editor.state.doc.content.size - 1
      const end = focused.current ? to : start
      const before = editor.state.doc
      // Structured inline nodes preserve line breaks through later DOM/IME edits; never parse note HTML.
      const content = request.text.split('\n').flatMap((line, index) => [
        ...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : []),
      ])
      const accepted = editor.chain().focus().insertContentAt({ from: start, to: end }, content).run()
      request.resolve(accepted && !before.eq(editor.state.doc))
    }
  }, [editor, revision, frozen, hidden])
  const compose = useCallback((value: boolean) => { composing.current = value; onCompose?.(value); if (!value) refresh(prior => prior + 1) }, [onCompose])
  return <div className={styles.editor} data-timed={projection.anchors.length > 0} hidden={hidden}
    onKeyDown={event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); if (dirty && !busy && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) void save()
      }
    }}>
    <NoteRichEditor manuscript id="cw-manuscript" label="我的稿件正文" value={projection.text}
      document={manuscriptDocument(input.config.manuscriptDocument, projection.text)} maxLength={MANUSCRIPT_LIMIT}
      placeholder="从一个想法开始，写下你的正文…" disabled={frozen || hidden} toolbarTarget={toolbarTarget} onReady={ready} extensions={manuscriptExtensions} onCompose={compose}
      onChange={(value, document) => setInput(current => ({ ...current,
        body: value === projection.text ? current.body : history.current.get(value) ?? editManuscript(current.body === input.body ? timelineBody : current.body, value),
        config: { ...current.config, manuscriptDocument: document },
      }))} />
  </div>
}
