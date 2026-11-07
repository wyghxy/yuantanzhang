export const studioPrivacyKey = 'yuantanzhang-studio-privacy'

/** Legacy WeChat receipts contain HTTP image URLs; these CDN hosts serve HTTPS. */
export function studioAvatarSource(value: unknown) {
  const source = typeof value === 'string' ? value.trim() : ''
  try {
    const url = new URL(source)
    const wechatImage = ['qlogo.cn', 'qpic.cn'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
    if (url.protocol === 'http:' && wechatImage && !url.port && !url.username && !url.password)
      return source.replace(/^http:/i, 'https:')
  } catch { /* The avatar component retains its existing invalid URL fallback. */ }
  return source
}

const privatePlatforms: Record<string, string> = {
  douyin: '抖', bili: 'B', bilibili: 'B', xiaohongshu: '书',
  youtube: 'Y', tiktok: 'T', wechat_official: '公', wechat_channels: '视', kuaishou: '快',
}

export function privacyPlatform(value: string, fallback: string) {
  return privatePlatforms[value] || fallback
}

export function privacyCreator(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) return '博'
  return new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    .segment(name)[Symbol.iterator]().next().value?.segment || '博'
}

/** Grapheme-safe title projection. Never alter stored source or manuscript data. */
export function privacyMaterialTitle(value: string) {
  const parts = [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)].map(part => part.segment)
  if (parts.length > 4) return parts.slice(0, 2).join('') + '***' + parts.slice(-2).join('')
  if (parts.length > 2) return parts[0] + '*'.repeat(parts.length - 2) + parts.at(-1)
  return parts.length === 2 ? parts[0] + '*' : parts.length === 1 ? '*' : ''
}

/** Mask explicit identity/source-title fields; user drafts, prose, links and IDs stay intact. */
export function privacyDetails(value: unknown, identity = false, material = false): unknown {
  if (Array.isArray(value)) return value.map(entry => privacyDetails(entry, identity, material))
  if (!value || typeof value !== 'object') return value
  const row = value as Record<string, unknown>
  const isIdentity = identity || !!(row.platform && row.name) || 'avatarUrl' in row || 'avatar_url' in row
  const isMaterial = material || row.kind === 'material' || row.kind === 'materials'
  return Object.fromEntries(Object.entries(row).map(([key, entry]) => {
    if (['avatarUrl', 'avatar_url', 'avatar'].includes(key)) return [key, '头像已隐藏']
    if (['author', 'authorName', 'creatorName', 'accountName', 'nickname', 'displayName'].includes(key) && typeof entry === 'string')
      return [key, privacyCreator(entry)]
    if (key === 'name' && isIdentity) return [key, privacyCreator(entry)]
    if (key === 'platform' && typeof entry === 'string') return [key, privacyPlatform(entry, entry)]
    if ((key === 'title' && isMaterial || ['sourceTitle', 'materialTitle', 'videoTitle', 'video_title'].includes(key)) && typeof entry === 'string')
      return [key, privacyMaterialTitle(entry)]
    const childIdentity = ['account', 'accounts', 'author', 'creator', 'creators', 'identity', 'identities'].includes(key)
    const childMaterial = ['material', 'materials', 'sourceMaterial', 'sourceMaterials'].includes(key)
    return [key, privacyDetails(entry, childIdentity, childMaterial)]
  }))
}

export function createStudioPrivacyStore(browser: () => Window | undefined) {
  let current: boolean | null = null
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())
  const read = () => {
    try { return browser()?.localStorage.getItem(studioPrivacyKey) === 'on' }
    catch { return false }
  }
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== studioPrivacyKey) return
    try { if (event.storageArea && event.storageArea !== browser()?.localStorage) return } catch { return }
    current = read()
    emit()
  }
  return {
    snapshot: () => current,
    subscribe(listener: () => void) {
      if (!listeners.size) {
        if (current === null) current = read()
        browser()?.addEventListener('storage', storage)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (!listeners.size) browser()?.removeEventListener('storage', storage)
      }
    },
    set(enabled: boolean) {
      current = enabled
      try { browser()?.localStorage.setItem(studioPrivacyKey, enabled ? 'on' : 'off') }
      catch { /* Keep the current session preference when storage is unavailable. */ }
      emit()
    },
  }
}
