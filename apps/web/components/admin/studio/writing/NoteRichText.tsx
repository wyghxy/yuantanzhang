import { createElement, type ReactNode } from 'react'
import { validMaterialNoteDocument, type MaterialNoteDocument, type MaterialNoteNode } from '@ytz/contracts/studio-note-document'
import styles from './NoteRichEditor.module.css'

/** React escapes all text; only the validated, closed document vocabulary is rendered. */
export function NoteRichText({ text, document }: { text: string; document?: MaterialNoteDocument | null }) {
  if (!document || !validMaterialNoteDocument(document, text)) return <div className={styles.readOnly}>{text}</div>
  function render(node: MaterialNoteNode, key: number): ReactNode {
    if (node.type === 'text') {
      let child: ReactNode = node.text
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') child = <strong>{child}</strong>
        else if (mark.type === 'italic') child = <em>{child}</em>
        else if (mark.type === 'underline') child = <u>{child}</u>
        else if (mark.type === 'textStyle') child = <span data-note-ink={mark.attrs?.color}>{child}</span>
        else if (mark.type === 'highlight') child = <mark data-note-highlight={mark.attrs?.color}>{child}</mark>
      }
      return <span key={key}>{child}</span>
    }
    if (node.type === 'hardBreak') return <br key={key} />
    const tag = node.type === 'heading' ? 'h' + node.attrs?.level : node.type === 'bulletList' ? 'ul' : node.type === 'orderedList' ? 'ol' : node.type === 'listItem' ? 'li' : 'p'
    const children = node.content?.map(render)
    return createElement(tag, { key, ...(node.type === 'orderedList' ? { start: node.attrs?.start } : {}) }, children?.length ? children : <br />)
  }
  return <div className={styles.readOnly}>{document.content?.map(render)}</div>
}
