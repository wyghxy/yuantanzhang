import type { HandoffProvenance, HandoffKnowledgeSource } from './station-handoff-provenance'
export type NativeStudioProvenanceSummary = {
  id: number; draftId: string; draftVersion: number; projectId: number; masterVersion: number
  currentMasterVersion: number; isCurrentMaster: boolean; adoptedAt: string; sourceDigest: string; sourceDraftUrl: string
}
export type NativeStudioProvenance = NativeStudioProvenanceSummary & {
  draft: { title: string; body: string }
  material: HandoffProvenance['material']
  publication: null | { id: string; title: string; platform: string; author: string; url: string | null }
  topic: HandoffProvenance['topic']
  knowledge: HandoffKnowledgeSource[]
}
export type NativeStudioProvenanceList = {
  projectId: number; currentMasterVersion: number; items: NativeStudioProvenanceSummary[]
  total: number; offset: number; hasMore: boolean; nextOffset: number
}
