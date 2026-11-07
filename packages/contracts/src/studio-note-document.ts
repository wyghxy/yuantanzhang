/** Restricted Tiptap data, never HTML. Plain strings remain the interoperable projection. */
export const MATERIAL_NOTE_COLORS = ['#202124', '#5f6368', '#b42318', '#175cd3', '#067647', '#6941c6'] as const
export const MATERIAL_NOTE_HIGHLIGHT_COLORS = ['#fff3b0', '#dbeafe', '#dcfce7', '#fce7f3'] as const
export type MaterialNoteMark = {
  type: 'bold' | 'italic' | 'underline' | 'textStyle' | 'highlight'
  attrs?: Record<string, unknown>
}
export type MaterialNoteNode = {
  type: 'doc' | 'paragraph' | 'heading' | 'bulletList' | 'orderedList' | 'listItem' | 'hardBreak' | 'text'
  attrs?: Record<string, unknown>
  content?: MaterialNoteNode[]
  text?: string
  marks?: MaterialNoteMark[]
}
export type MaterialNoteDocument = MaterialNoteNode & { type: 'doc' }
const MAX_TEXT = 12000, MAX_JSON_BYTES = 200000, MAX_DEPTH = 12, MAX_NODES = 10000
const blocks = new Set(['paragraph', 'heading', 'bulletList', 'orderedList'])
const plainMarks = new Set(['bold', 'italic', 'underline'])
const inks = new Set<string>(MATERIAL_NOTE_COLORS), highlights = new Set<string>(MATERIAL_NOTE_HIGHLIGHT_COLORS)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key))
class InvalidDocument extends Error {}
function check(value: unknown): asserts value { if (!value) throw new InvalidDocument() }

function validMarks(value: unknown) {
  check(Array.isArray(value) && value.length <= 5)
  const seen = new Set<string>()
  for (const mark of value) {
    check(object(mark) && exactKeys(mark, ['type', 'attrs']) && typeof mark.type === 'string' && !seen.has(mark.type))
    seen.add(mark.type)
    if (plainMarks.has(mark.type)) {
      check(mark.attrs === undefined || object(mark.attrs) && Object.keys(mark.attrs).length === 0)
    } else {
      check((mark.type === 'textStyle' || mark.type === 'highlight') && object(mark.attrs)
        && exactKeys(mark.attrs, ['color']) && typeof mark.attrs.color === 'string'
        && (mark.type === 'textStyle' ? inks : highlights).has(mark.attrs.color))
    }
  }
}

/** A bounded walk precedes serialization, so cycles/deep input fail without overflowing JSON.stringify. */
function inspectedText(value: unknown, maxText = MAX_TEXT): string | null {
  if (!Number.isInteger(maxText) || maxText < 1 || maxText > 100000) return null
  let count = 0
  const visiting = new Set<object>()
  function walk(raw: unknown, depth: number, parent: string, index: number): string {
    check(depth <= MAX_DEPTH && ++count <= MAX_NODES && object(raw) && !visiting.has(raw))
    visiting.add(raw)
    check(typeof raw.type === 'string')
    const type = raw.type
    if (parent === '') check(type === 'doc')
    else if (parent === 'doc') check(blocks.has(type))
    else if (parent === 'paragraph' || parent === 'heading') check(type === 'text' || type === 'hardBreak')
    else if (parent === 'bulletList' || parent === 'orderedList') check(type === 'listItem')
    else if (parent === 'listItem') check(index === 0 ? type === 'paragraph' : blocks.has(type))
    else check(false)
    let result = ''
    if (type === 'text') {
      check(exactKeys(raw, ['type', 'text', 'marks']) && typeof raw.text === 'string' && raw.text.length > 0 && raw.text.length <= maxText)
      if (raw.marks !== undefined) validMarks(raw.marks)
      result = raw.text
    } else if (type === 'hardBreak') {
      check(exactKeys(raw, ['type', 'marks']))
      if (raw.marks !== undefined) validMarks(raw.marks)
      result = '\n'
    } else {
      check(exactKeys(raw, type === 'heading' || type === 'orderedList' ? ['type', 'content', 'attrs'] : ['type', 'content']))
      if (type === 'heading') {
        check(object(raw.attrs) && exactKeys(raw.attrs, ['level']) && Number.isInteger(raw.attrs.level)
          && Number(raw.attrs.level) >= 1 && Number(raw.attrs.level) <= 3)
      }
      if (type === 'orderedList' && raw.attrs !== undefined) {
        check(object(raw.attrs) && exactKeys(raw.attrs, ['start', 'type'])
          && (raw.attrs.start === undefined || Number.isInteger(raw.attrs.start) && Number(raw.attrs.start) >= 1 && Number(raw.attrs.start) <= 1000000)
          && (raw.attrs.type === undefined || raw.attrs.type === null))
      }
      check(raw.content === undefined || Array.isArray(raw.content))
      const content = raw.content === undefined ? [] : raw.content as unknown[]
      if (type === 'doc' || type === 'bulletList' || type === 'orderedList' || type === 'listItem') check(content.length > 0)
      const separator = type === 'paragraph' || type === 'heading' ? '' : '\n'
      for (let i = 0; i < content.length; i++) {
        const child = walk(content[i], depth + 1, type, i), prefix = i ? separator : ''
        check(result.length + prefix.length + child.length <= maxText)
        result += prefix + child
      }
    }
    visiting.delete(raw)
    check(result.length <= maxText)
    return result
  }
  try {
    const plain = walk(value, 1, '', 0)
    const serialized = JSON.stringify(value)
    check(typeof serialized === 'string')
    let bytes = 0
    for (const character of serialized) {
      const code = character.codePointAt(0)!
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
      if (bytes > Math.max(MAX_JSON_BYTES, maxText * 8)) return null
    }
    return plain
  } catch { return null }
}

/** Reject unsupported nodes/attributes/marks and, when supplied, any plain-projection mismatch. */
export function validMaterialNoteDocument(value: unknown, plain?: string, maxText = MAX_TEXT): value is MaterialNoteDocument {
  const text = inspectedText(value, maxText)
  return text !== null && (plain === undefined || text === plain)
}

/** Invalid/untrusted documents are never partially rendered or interpreted. */
export function materialNoteDocumentText(value: unknown, maxText = MAX_TEXT): string { return inspectedText(value, maxText) ?? '' }

/** Legacy strings remain literal text, including blank/trailing lines and HTML-looking content. */
export function materialNoteDocumentFromText(text: string, maxText = MAX_TEXT): MaterialNoteDocument {
  if (typeof text !== 'string' || text.length > maxText) throw new RangeError('material_note_text_limit')
  const paragraph = (value: string): MaterialNoteNode => ({ type: 'paragraph', ...(value ? { content: [{ type: 'text', text: value }] } : {}) })
  let document: MaterialNoteDocument = { type: 'doc', content: text.split('\n').map(paragraph) }
  // A valid old string can contain more newlines than the rich node budget.
  // Keep it intact as literal text rather than truncating or failing to open it.
  if (!validMaterialNoteDocument(document, text, maxText)) document = { type: 'doc', content: [paragraph(text)] }
  if (!validMaterialNoteDocument(document, text, maxText)) throw new RangeError('material_note_document_limit')
  return document
}
