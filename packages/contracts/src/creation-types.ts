import type { ScriptStatement } from './creation-validation'

export interface CreationSource {
  id: number; title: string; url: string; status: string; originalAt: string | null; evidenceNotes: string | null
}
export interface CreationMasterScript {
  id: number; title: string; body: string; version: number; confirmedAt: string | null
  facts: unknown; inferences: unknown; disputes: unknown; timelinessRisk: string | null
}
export interface CreationProjectData {
  id: number; title: string; status: string; dueAt: string | null; finalVideoUrl: string | null; notes: string | null
  masterScript: CreationMasterScript | null
  opportunity: { id: number; title: string; angle: string; sourceItem: CreationSource | null; eventCluster: { title: string; conflictNotes: string | null; items: { sourceItem: CreationSource }[] } | null } | null
  variants: { id: number; platform: string; status: string; sourceVersion: number; confirmedAt: string | null }[]
  publishRecords: { id: number; platform: string; status: string; publishedAt: string | null; externalUrl: string | null; sourceVersion: number | null }[]
}
export interface CreationDetailResponse { project: CreationProjectData; sources: CreationSource[]; mode: 'manual' }

export function displayStatements(value: unknown): ScriptStatement[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('text' in item) || typeof item.text !== 'string') return []
    const ids = 'sourceItemIds' in item && Array.isArray(item.sourceItemIds) ? item.sourceItemIds.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) : []
    return [{ text: item.text, sourceItemIds: ids }]
  })
}
