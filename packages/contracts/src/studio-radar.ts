/** Persistent radar preferences and ordered references. No browser-only mock data. */
export { originalPublication, mergeOriginalPublication } from './studio-original-publication'
export const radarPlatforms = ['douyin', 'bili', 'xiaohongshu', 'youtube', 'tiktok', 'wechat_official', 'wechat_channels', 'kuaishou'] as const
export type RadarPlatform = typeof radarPlatforms[number]
export type RadarRange = 1 | 3 | 7
/** Normalize verified provider metadata, never infer a content format from its platform. */
export function studioMaterialContentType(value: Record<string, unknown>): string {
  const normalize = (input: unknown) => typeof input === 'string' ? input.trim().toLowerCase() : ''
  const explicit = normalize(value.contentType) || normalize(value.content_type)
  if (['video', 'image', 'article'].includes(explicit)) return explicit
  if (explicit === 'text') return 'article'
  const kind = normalize(value.contentKind)
  if (kind === 'article') return 'article'
  if (kind === 'image_note') return 'image'
  const media = normalize(value.mediaType)
  if (media === 'video' || media === 'image') return media
  if (media === 'text') return 'article'
  return explicit
}
export interface RadarPreferences {
  quote: string
  interests: string[]
  version: number
}
export interface StudioReference {
  materialId: string
  anchor?: { start: number; end: number; text: string; transcriptVersion: number }
}
export function studioReferenceIds(value: Record<string, unknown>): string[] {
  if (Array.isArray(value.references)) {
    return value.references.flatMap(ref =>
      ref && typeof ref === 'object' && typeof ref.materialId === 'string' ? [ref.materialId] : [],
    )
  }
  return typeof value.materialId === 'string' && value.materialId ? [value.materialId] : []
}
/** Unknown historical reading state remains unmarked; it is included in the reading inbox. */
export function studioIsUnread(value: Record<string, unknown>): boolean {
  return value.readState !== 'read'
}
