import { fail, txt, type Data } from './shared'

/** Classify an entered URL locally. This never fetches a page or resolves a redirect. */
export function recognizeLink(body: Data) {
  const input = txt(body.text).trim()
  if (!input || input.length > 10000) fail(400, 'invalid_link', '请粘贴作品或博主的分享链接。')
  const raw = input.match(/https?:\/\/[^\s<>"「」]+/i)?.[0]?.replace(/[，。；！？、)）\]]+$/, '')
  let url: URL
  try { url = new URL(raw || input) } catch { return fail(400, 'invalid_link', '没有找到有效链接，请粘贴完整的 http 或 https 链接。') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(400, 'invalid_link', '请使用不含账号密码的 http 或 https 链接。')
  const host = url.hostname.toLowerCase(), path = url.pathname
  const domain = (name: string) => host === name || host.endsWith('.' + name)
  let platform = 'local', detectedKind = 'materials', nativeId = '', requiresResolution = false
  if (domain('douyin.com')) {
    platform = 'douyin'; nativeId = path.match(/\/(?:video|note)\/([^/]+)/)?.[1] || path.match(/\/user\/([^/]+)/)?.[1] || ''
    detectedKind = path.startsWith('/user/') ? 'accounts' : 'materials'; requiresResolution = host === 'v.douyin.com'
  } else if (domain('bilibili.com') || host === 'b23.tv') {
    platform = 'bili'; detectedKind = host === 'space.bilibili.com' ? 'accounts' : 'materials'
    nativeId = path.match(/\/video\/([^/]+)/)?.[1] || (detectedKind === 'accounts' ? path.split('/')[1] : '') || ''; requiresResolution = host === 'b23.tv'
  } else if (domain('xiaohongshu.com') || domain('xhslink.com')) {
    platform = 'xiaohongshu'; detectedKind = path.startsWith('/user/profile/') ? 'accounts' : 'materials'
    nativeId = path.match(/\/(?:explore|discovery\/item|user\/profile)\/([^/]+)/)?.[1] || ''; requiresResolution = domain('xhslink.com')
  } else if (domain('youtube.com') || host === 'youtu.be') {
    platform = 'youtube'; nativeId = url.searchParams.get('v') || path.match(/\/(?:shorts|live)\/([^/]+)/)?.[1] || (host === 'youtu.be' ? path.split('/')[1] : '') || ''
    detectedKind = /^\/(?:@|channel\/|c\/|user\/)/.test(path) ? 'accounts' : 'materials'
  } else if (domain('tiktok.com')) {
    platform = 'tiktok'; nativeId = path.match(/\/video\/([^/]+)/)?.[1] || ''; detectedKind = path.startsWith('/@') && !nativeId ? 'accounts' : 'materials'
    requiresResolution = ['vm.tiktok.com', 'vt.tiktok.com'].includes(host)
  } else if (host === 'mp.weixin.qq.com') platform = 'wechat_official'
  else if (host === 'channels.weixin.qq.com') platform = 'wechat_channels'
  else if (domain('kuaishou.com')) {
    platform = 'kuaishou'; detectedKind = path.startsWith('/profile/') ? 'accounts' : 'materials'
    nativeId = path.match(/\/(?:short-video|profile)\/([^/]+)/)?.[1] || ''; requiresResolution = host === 'v.kuaishou.com'
  }
  return { link: { url: url.href, platform, detectedKind: requiresResolution ? 'unknown' : detectedKind, nativeId, requiresResolution, source: 'local_recognition' } }
}
