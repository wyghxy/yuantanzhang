export const knowledgeCategories = {
  intelligence: '情报与素材',
  reading: '读书笔记',
  planning: '计划与目标',
  writing: '文稿与创作',
  review: '复盘',
  notes: '个人笔记',
  health: '健康管理',
} as const
export type KnowledgeCategory = keyof typeof knowledgeCategories
export type CatalogRecord = Record<string, unknown>
export type CatalogContentState = 'content' | 'metadata' | 'empty'
export interface CatalogEntry {
  workspaceId: number
  sourceType: string
  sourceId: string
  category: KnowledgeCategory
  title: string
  bodyText: string
  sourceVersion: string
  status: string
  archived: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
  contentState?: CatalogContentState
  sourceLabel?: string
}
export interface CatalogField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'select'
  options?: { value: string; label: string }[]
  nullable?: boolean
}
export interface CatalogEditor {
  fields: CatalogField[]
  values: CatalogRecord
  notice?: string
  canArchive?: boolean
  canRestore?: boolean
}
export interface CatalogDetail {
  entry: CatalogEntry
  editor: CatalogEditor | null
  originalUrl: string
  originalLabel?: string
  sourceUrl?: string
  originalBody?: string
  related: { sourceType: string; sourceId: string; title: string; category: KnowledgeCategory }[]
  history: { version: number | string; title: string; bodyText: string; createdAt: string }[]
  historyNotice?: string
  readNotice?: string
  contentState?: CatalogContentState
  relatedTruncated?: boolean
  resolvedReferences?: CatalogResolvedReference[]
}
export interface CatalogResolvedReference {
  target: string
  identity: string
  sourceType: string
  sourceId: string
  title: string
  category: KnowledgeCategory
}
/** A source can remain saved while no longer meeting the catalog's content scope. */
export interface CatalogRemovalReceipt {
  removedFromCatalog: true
  sourceType: string
  sourceId: string
  message: string
}
export type CatalogMutationResult = CatalogDetail | CatalogRemovalReceipt
export interface CatalogSyncScope {
  enabled: boolean
  categories: KnowledgeCategory[]
  keyField: string
}
export function catalogSyncScope(value: unknown): CatalogSyncScope {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as CatalogRecord : {}
  const categories = Array.isArray(input.categories)
    ? [...new Set(input.categories.filter((v): v is KnowledgeCategory => typeof v === 'string' && v in knowledgeCategories))]
    : []
  return { enabled: input.enabled === true, categories, keyField: typeof input.keyField === 'string' ? input.keyField : '元探长来源' }
}

export interface CatalogGraph {
  entries: CatalogEntry[]
  edges: { from: string; to: string; kind: 'reference' | 'association'; context: string }[]
  total: number
  limit: number
  truncated: boolean
  categories: { category: KnowledgeCategory; count: number }[]
  snapshotVersion: string
}
export const catalogIdentity = (entry: Pick<CatalogEntry, 'workspaceId' | 'sourceType' | 'sourceId'>) =>
  `${entry.workspaceId}:${entry.sourceType}:${entry.sourceId}`

export type CatalogSelectionSourceType = 'studio_materials' | 'studio_reports' | 'source_item' | 'writing_material'
/** Selection metadata only; sourceVersion is the original source CAS, not the catalog version. */
export interface CatalogSelectionState {
  workspaceId: number
  sourceType: CatalogSelectionSourceType
  sourceId: string
  title: string
  sourceVersion: string
  selected: boolean
  selectionVersion: number
  selectedAt: string | null
}
export interface CatalogSelectionInput {
  expectedSourceVersion: string
  expectedSelectionVersion: number
}
