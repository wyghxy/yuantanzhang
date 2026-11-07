'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, Extension, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline, List, ListOrdered, Undo2, Redo2, Eraser } from 'lucide-react'
import { materialNoteDocumentFromText, materialNoteDocumentText, validMaterialNoteDocument, MATERIAL_NOTE_COLORS, MATERIAL_NOTE_HIGHLIGHT_COLORS, type MaterialNoteDocument } from '@ytz/contracts/studio-note-document'
import styles from './NoteRichEditor.module.css'

type Props = {
  value: string; document?: MaterialNoteDocument | null; label: string; disabled?: boolean
  onChange: (text: string, document: MaterialNoteDocument) => void
  onCompose?: (composing: boolean) => void; onBlur?: () => void
  simple?: boolean; manuscript?: boolean; maxLength?: number; id?: string; placeholder?: string
  onReady?: (editor: Editor | null) => void; extensions?: Extension[]
  toolbarTarget?: HTMLElement | null
}
const inkNames = ['正文', '灰色', '红色', '蓝色', '绿色', '紫色']
const highlightNames = ['黄色', '蓝色', '绿色', '粉色']
const NoteTextStyle = TextStyle.extend({
  parseHTML() { return [{ tag: 'span[data-note-ink]' }, ...(this.parent?.() || [])] },
})
const Ink = Color.extend({
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { color: {
      default: null,
      parseHTML: element => element.getAttribute('data-note-ink') || element.style.color,
      renderHTML: attributes => attributes.color ? { 'data-note-ink': attributes.color } : {},
    } } }]
  },
})
const Marker = Highlight.extend({
  addAttributes() {
    return { color: {
      default: null,
      parseHTML: element => element.getAttribute('data-note-highlight') || element.getAttribute('data-color') || element.style.backgroundColor,
      renderHTML: attributes => attributes.color ? { 'data-color': attributes.color } : {},
    } }
  },
  renderHTML({ HTMLAttributes }) { return ['mark', { 'data-note-highlight': HTMLAttributes['data-color'] || MATERIAL_NOTE_HIGHLIGHT_COLORS[0] }, 0] },
}).configure({ multicolor: true })

/** Retain only our document schema; pasted HTML is parsed by ProseMirror, never rendered raw. */
function cleanDocument(node: JSONContent): MaterialNoteDocument {
  function clean(current: JSONContent): JSONContent {
    const result: JSONContent = { type: current.type }
    if (current.text !== undefined) result.text = current.text
    if (current.content?.length) result.content = current.content.map(clean)
    if (current.type === 'heading') result.attrs = { level: current.attrs?.level }
    if (current.type === 'orderedList') result.attrs = { start: current.attrs?.start || 1 }
    const marks = current.marks?.flatMap(mark => {
      if (['bold', 'italic', 'underline'].includes(mark.type)) return [{ type: mark.type }]
      const allowed = mark.type === 'textStyle' ? MATERIAL_NOTE_COLORS : mark.type === 'highlight' ? MATERIAL_NOTE_HIGHLIGHT_COLORS : []
      const color = typeof mark.attrs?.color === 'string' ? mark.attrs.color.toLowerCase() : ''
      if (allowed.some(value => value === color)) return [{ type: mark.type, attrs: { color } }]
      return []
    })
    if (marks?.length) result.marks = marks
    return result
  }
  return clean(node) as MaterialNoteDocument
}

export const NoteRichEditor = memo(function NoteRichEditor({ value, document: richDocument, label, disabled = false, onChange, onCompose, onBlur, simple = false, manuscript = false, maxLength = 12000, id, placeholder = '写下想法…', onReady, extensions = [], toolbarTarget }: Props) {
  const latest = useRef({ onChange, onCompose, onBlur, value, richDocument })
  latest.current = { onChange, onCompose, onBlur, value, richDocument }
  const composing = useRef(false)
  const lastEmitted = useRef('')
  const [error, setError] = useState('')
  const editor = useEditor({
    immediatelyRender: false, shouldRerenderOnTransaction: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, code: false, codeBlock: false, blockquote: false, strike: false, horizontalRule: false, trailingNode: false }), NoteTextStyle, Ink, Marker, Placeholder.configure({ placeholder }),
      Extension.create({ name: 'noteDocumentLimit', addProseMirrorPlugins: () => [new Plugin({ filterTransaction(transaction) {
        if (!transaction.docChanged) return true
        const valid = validMaterialNoteDocument(cleanDocument(transaction.doc.toJSON()), undefined, maxLength)
        if (!valid) setError(`内容过长，最多 ${maxLength} 字；本次输入未插入，原内容已保留。`)
        return valid
      } })] }), ...extensions,
    ],
    content: validMaterialNoteDocument(richDocument, value, maxLength) ? richDocument : materialNoteDocumentFromText(value, maxLength), editable: !disabled,
    editorProps: { attributes: { ...(id ? { id } : {}), role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', spellcheck: 'false' } },
    onUpdate: ({ editor: current }) => {
      const document = cleanDocument(current.getJSON())
      if (!validMaterialNoteDocument(document, undefined, maxLength)) { setError(`内容过长，请缩短到 ${maxLength} 字以内。`); return }
      const text = materialNoteDocumentText(document, maxLength)
      lastEmitted.current = JSON.stringify(document)
      setError(''); latest.current.onChange(text, document)
    },
  })
  useEffect(() => { onReady?.(editor); return () => onReady?.(null) }, [editor, onReady])
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'),
    bullet: current.isActive('bulletList'), ordered: current.isActive('orderedList'),
    heading: current.isActive('heading') ? String(current.getAttributes('heading').level) : '0',
    ink: current.getAttributes('textStyle').color || '', marker: current.getAttributes('highlight').color || '',
    undo: current.can().undo(), redo: current.can().redo(),
  } : null })
  useEffect(() => { editor?.setEditable(!disabled, false) }, [disabled, editor])
  useEffect(() => {
    if (!editor || composing.current) return
    const incoming = cleanDocument(validMaterialNoteDocument(richDocument, value, maxLength) ? richDocument : materialNoteDocumentFromText(value, maxLength))
    const serialized = JSON.stringify(incoming)
    if (serialized === lastEmitted.current || serialized === JSON.stringify(cleanDocument(editor.getJSON()))) return
    editor.commands.setContent(incoming, { emitUpdate: false })
    lastEmitted.current = serialized
  }, [value, richDocument, editor, maxLength])
  useEffect(() => () => { latest.current.onCompose?.(false) }, [])
  const tool = (name: string, icon: React.ReactNode, active: boolean | undefined, action: () => void, unavailable = false) =>
    <button type="button" title={name} aria-label={name} aria-pressed={active} disabled={disabled || !editor || unavailable}
      onMouseDown={event => event.preventDefault()} onClick={() => { if (!composing.current) action() }}>{icon}</button>
  const toolbar = !simple && <div className={styles.toolbar} role="group" aria-label={label + '格式工具'} data-component-ui>
      <select aria-label="段落样式" title="段落样式" value={state?.heading || '0'} disabled={disabled || !editor}
        onChange={event => { if (composing.current) return; const level = Number(event.target.value); if (level) editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(); else editor?.chain().focus().setParagraph().run() }}>
        <option value="0">正文</option><option value="1">标题 1</option><option value="2">标题 2</option><option value="3">标题 3</option>
      </select>
      {tool('加粗 (Ctrl+B)', <Bold size={17} />, state?.bold, () => editor?.chain().focus().toggleBold().run())}
      {tool('斜体 (Ctrl+I)', <Italic size={17} />, state?.italic, () => editor?.chain().focus().toggleItalic().run())}
      {tool('下划线 (Ctrl+U)', <Underline size={17} />, state?.underline, () => editor?.chain().focus().toggleUnderline().run())}
      <select aria-label="文字颜色" title="文字颜色" value={state?.ink || ''} disabled={disabled || !editor} onChange={event => { if (composing.current) return; if (event.target.value) editor?.chain().focus().setColor(event.target.value).run(); else editor?.chain().focus().unsetColor().run() }}>
        <option value="">字色</option>{MATERIAL_NOTE_COLORS.map((color, index) => <option key={color} value={color}>{inkNames[index]}</option>)}
      </select>
      <select aria-label="高亮标记" title="高亮标记" value={state?.marker || ''} disabled={disabled || !editor} onChange={event => { if (composing.current) return; if (event.target.value) editor?.chain().focus().setHighlight({ color: event.target.value }).run(); else editor?.chain().focus().unsetHighlight().run() }}>
        <option value="">无高亮</option>{MATERIAL_NOTE_HIGHLIGHT_COLORS.map((color, index) => <option key={color} value={color}>{highlightNames[index]}</option>)}
      </select>
      {tool('项目列表', <List size={17} />, state?.bullet, () => editor?.chain().focus().toggleBulletList().run())}
      {tool('编号列表', <ListOrdered size={17} />, state?.ordered, () => editor?.chain().focus().toggleOrderedList().run())}
      {tool('清除格式', <Eraser size={17} />, undefined, () => editor?.chain().focus().unsetAllMarks().clearNodes().run())}
      {tool('撤销', <Undo2 size={17} />, undefined, () => editor?.chain().focus().undo().run(), !state?.undo)}
      {tool('重做', <Redo2 size={17} />, undefined, () => editor?.chain().focus().redo().run(), !state?.redo)}
    </div>
  return <div className={`${styles.editor}${manuscript ? ` ${styles.manuscript}` : ""}`} data-note-rich-editor data-simple={simple || undefined} data-disabled={disabled || undefined}
    onCompositionStart={() => { composing.current = true; latest.current.onCompose?.(true) }}
    onCompositionEnd={() => { composing.current = false; latest.current.onCompose?.(false) }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !toolbarTarget?.contains(event.relatedTarget)) { if (!composing.current) latest.current.onBlur?.() } }}>
    {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}
    <EditorContent editor={editor} className={styles.content} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>
})
