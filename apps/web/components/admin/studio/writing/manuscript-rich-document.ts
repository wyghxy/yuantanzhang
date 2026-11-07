import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { validMaterialNoteDocument } from '@ytz/contracts/studio-note-document'

export type ManuscriptHandle = { readonly selectionStart: number; readonly selectionEnd: number; focus: () => void }
export const MANUSCRIPT_LIMIT = 100000

/** Formatting stays alongside the plain body, never interpreted as HTML or sent as narration. */
export function manuscriptDocument(value: unknown, plain: string) {
  return validMaterialNoteDocument(value, plain, MANUSCRIPT_LIMIT) ? value : null
}

export function manuscriptBlocks(doc: ProseMirrorNode) {
  const blocks: { node: ProseMirrorNode; position: number; offset: number; text: string }[] = []
  let offset = 0
  doc.descendants((node, position) => {
    if (!node.isTextblock) return true
    const text = node.textBetween(0, node.content.size, '', '\n')
    blocks.push({ node, position, offset, text }); offset += text.length + 1
    return false
  })
  return blocks
}

/** Translate a ProseMirror selection to the unchanged plain-body contract used by AI context. */
export function manuscriptTextOffset(doc: ProseMirrorNode, position: number) {
  let end = 0
  for (const block of manuscriptBlocks(doc)) {
    if (position < block.position + 1) return end
    if (position <= block.position + block.node.nodeSize - 1)
      return block.offset + block.node.textBetween(0, Math.max(0, position - block.position - 1), '', '\n').length
    end = block.offset + block.text.length
  }
  return end
}
