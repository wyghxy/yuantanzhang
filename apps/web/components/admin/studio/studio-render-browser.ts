export type StudioRenderCard = { id: string; title: string; content: string; type?: string }

function wrap(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = ''
    for (const character of Array.from(paragraph)) {
      if (line && context.measureText(line + character).width > width) { lines.push(line); line = '' }
      line += character
    }
    lines.push(line)
  }
  return lines
}

/** Render every character; reject oversized cards instead of silently clipping their content. */
export async function renderStudioCard(card: StudioRenderCard, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted()
  await document.fonts.ready
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法生成贴图，请更换支持 Canvas 的浏览器')
  const font = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
  context.font = `600 52px ${font}`
  const titleLines = wrap(context, card.title, 904)
  context.font = `400 34px ${font}`
  const contentLines = wrap(context, card.content, 904)
  const height = Math.max(1080, 430 + titleLines.length * 76 + contentLines.length * 58)
  if (height > 4096) throw new Error(`${card.id} 文字过多，请拆分卡片后导出；没有截断文字`)
  canvas.width = 1080; canvas.height = height
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, height)
  context.fillStyle = '#157653'; context.fillRect(88, 82, 44, 5)
  context.font = `500 25px ${font}`; context.fillText(`元探长  /  ${card.id}`, 88, 140)
  context.fillStyle = '#172622'; context.font = `600 52px ${font}`
  let y = 238
  for (const line of titleLines) { context.fillText(line, 88, y); y += 76 }
  y += 38; context.strokeStyle = '#e4eae6'; context.beginPath(); context.moveTo(88, y - 12); context.lineTo(992, y - 12); context.stroke()
  y += 56; context.font = `400 34px ${font}`; context.fillStyle = '#34453e'
  for (const line of contentLines) { context.fillText(line, 88, y); y += 58 }
  context.font = `400 22px ${font}`; context.fillStyle = '#708077'; context.fillText('元探长 · 创作工作台', 88, height - 60)
  signal?.throwIfAborted()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('贴图生成失败，请重试')), 'image/png'))
  canvas.width = 0; canvas.height = 0
  if (blob.size > 4 * 1024 * 1024) throw new Error('贴图超过 4 MiB，请拆分卡片后导出')
  signal?.throwIfAborted(); return blob
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
export function studioRenderCrc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }
export function studioRenderZip(files: { name: string; bytes: Uint8Array }[]): Blob {
  if (!files.length || files.length > 100) throw new Error('每次导出需要 1–100 张贴图')
  const chunks: BlobPart[] = [], directory: BlobPart[] = [], names = new Set<string>()
  let offset = 0, centralSize = 0
  for (const file of files) {
  // eslint-disable-next-line no-control-regex -- Strip control characters from user-supplied attribute values.
    if (!/^[^/\\\x00-\x1f:]+\.png$/i.test(file.name) || names.has(file.name)) throw new Error('贴图文件名无效或重复')
    names.add(file.name)
    const name = new TextEncoder().encode(file.name), crc = studioRenderCrc32(file.bytes)
    const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true)
    l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, file.bytes.length, true); l.setUint32(22, file.bytes.length, true); l.setUint16(26, name.length, true); local.set(name, 30)
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 33, true)
    c.setUint32(16, crc, true); c.setUint32(20, file.bytes.length, true); c.setUint32(24, file.bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46)
    chunks.push(local.buffer, new Uint8Array(file.bytes).buffer); directory.push(central.buffer)
    offset += local.length + file.bytes.length; centralSize += central.length
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true)
  const blob = new Blob([...chunks, ...directory, end.buffer], { type: 'application/zip' })
  if (blob.size > 20 * 1024 * 1024) throw new Error('贴图包超过 20 MiB，请分批导出单张 PNG')
  return blob
}
export async function renderStudioCardsZip(cards: StudioRenderCard[], progress?: (completed: number, total: number) => void, signal?: AbortSignal) {
  const files = []
  for (const card of cards) {
    signal?.throwIfAborted()
    const blob = await renderStudioCard(card, signal)
    files.push({ name: `${card.id}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) }); progress?.(files.length, cards.length)
    await new Promise(resolve => window.setTimeout(resolve, 0))
  }
  signal?.throwIfAborted(); return studioRenderZip(files)
}
export function downloadStudioBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
