import createDOMPurify, { type WindowLike } from 'dompurify'

const imageHosts = new Set(['mmbiz.qpic.cn', 'mmbiz.qlogo.cn', 'wx.qlogo.cn'])
export function articleOriginalUrl(value: unknown) {
  try {
    const url = new URL(typeof value === 'string' ? value : '')
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'mp.weixin.qq.com' || url.username || url.password || url.port) return ''
    url.protocol = 'https:'
    return url.toString()
  } catch { return '' }
}
export function articleImageUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !imageHosts.has(url.hostname) || url.username || url.password || url.port) return ''
    url.protocol = 'https:'
    return url.toString()
  } catch { return '' }
}

// CSSOM parses declarations; only non-resource typography/flow properties survive.
const styleProperties = new Set(('color background-color font-family font-size font-weight font-style line-height letter-spacing word-spacing text-align text-indent text-decoration text-decoration-line text-decoration-color white-space overflow-wrap word-break vertical-align display width max-width min-width margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-width border-style border-color border-radius border-top border-right border-bottom border-left border-collapse border-spacing list-style-type list-style-position').split(' '))
function safeStyle(value: string, document: Document) {
  const parsed = document.createElement('span').style, result = document.createElement('span').style
  parsed.cssText = value
  for (const name of Array.from(parsed)) {
    const content = parsed.getPropertyValue(name)
    if (styleProperties.has(name) && !/[\\@]|url\s*\(|expression\s*\(|var\s*\(/i.test(content)) result.setProperty(name, content)
  }
  return result.cssText
}

export function articleDocument(html: string, window: Window & typeof globalThis, heading: { title?: string; author?: string; publishedAt?: string } = {}) {
  // Browser Trusted Types is optional; DOMPurify handles its absence at runtime.
  const purifier = createDOMPurify(window as WindowLike)
  purifier.addHook('beforeSanitizeAttributes', node => {
    if (node.nodeName === 'IMG') {
      const src = articleImageUrl(node.getAttribute('data-src') || node.getAttribute('src') || '')
      node.setAttribute('src', src)
      node.setAttribute('loading', 'lazy')
      node.setAttribute('referrerpolicy', 'no-referrer')
      node.setAttribute('alt', node.getAttribute('alt') || '原文图片')
    }
  })
  purifier.addHook('uponSanitizeAttribute', (node, event) => {
    if (event.attrName === 'style') event.attrValue = safeStyle(event.attrValue, window.document)
    if (event.attrName === 'src') {
      event.attrValue = node.nodeName === 'IMG' ? articleImageUrl(event.attrValue) : ''
      event.keepAttr = !!event.attrValue
    }
  })
  const clean = purifier.sanitize(html, {
    ALLOWED_TAGS: ['section', 'article', 'div', 'p', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sup', 'sub', 'small', 'blockquote', 'pre', 'code', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'figure', 'figcaption', 'img', 'a'],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'title', 'loading', 'referrerpolicy', 'colspan', 'rowspan', 'start', 'reversed', 'dir', 'lang'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, SANITIZE_NAMED_PROPS: true,
  })
  const header = window.document.createElement('header')
  if (heading.title) { const title = window.document.createElement('h1'); title.textContent = heading.title; header.append(title) }
  const byline = [heading.author, heading.publishedAt].filter(Boolean).join(' · ')
  if (byline) { const p = window.document.createElement('p'); p.textContent = byline; header.append(p) }
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src https://mmbiz.qpic.cn https://mmbiz.qlogo.cn https://wx.qlogo.cn; base-uri \'none\'; form-action \'none\'; frame-src \'none\'; object-src \'none\'">' +
    '<style>html{color-scheme:light;background:#fff;color:#222}body{margin:0;padding:20px;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;overflow-wrap:anywhere}body>*{max-width:100%;box-sizing:border-box}header{margin-bottom:24px}header h1{font-size:24px;line-height:1.4}header p{color:#666;font-size:14px}img{max-width:100%!important;height:auto!important}table{max-width:100%}pre{white-space:pre-wrap}a{cursor:text}.image-unavailable{display:block;margin:12px 0;padding:8px;border:1px solid #ddd;color:#666;font-size:14px}</style></head><body>' + header.outerHTML + clean + '</body></html>'
}

/** Parent-controlled error UI. The article frame never executes source scripts. */
export function observeArticleImages(document: Document, failed: (count: number) => void) {
  let count = 0
  const cleanups: Array<() => void> = []
  for (const img of Array.from(document.images)) {
    let replaced = false
    const unavailable = () => {
      if (replaced) return
      replaced = true
      const note = document.createElement('span')
      note.className = 'image-unavailable'
      note.textContent = '此图片暂时无法显示，可打开原网页查看。'
      img.replaceWith(note)
      failed(++count)
    }
    if (!img.getAttribute('src') || img.complete && !img.naturalWidth) unavailable()
    else { img.addEventListener('error', unavailable); cleanups.push(() => img.removeEventListener('error', unavailable)) }
  }
  return () => cleanups.forEach(cleanup => cleanup())
}
