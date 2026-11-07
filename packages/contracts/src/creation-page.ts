import type { OpportunityRanking, OpportunityScores, OpportunitySource } from './intelligence-opportunities'
export type CreationOpportunity = OpportunityScores & {
  id: number; title: string; angle: string; audienceValue: string | null; reason: string | null; status: string
  sourceItemId: number | null; eventClusterId: number | null; hookIdeas: unknown; createdAt: string
  sourceItem: OpportunitySource | null
  eventCluster: { id: number; title: string; summary: string | null; status: string; conflictNotes: string | null; items: { sourceItem: OpportunitySource }[] } | null
  projects: { id: number; title: string; status: string }[]; ranking: OpportunityRanking
}
export type CreationSource = OpportunitySource
export type CreationCluster = { id: number; title: string; status: string; conflictNotes: string | null; items: { sourceItem: OpportunitySource }[] }
export type CreationProjectSummary = { id: number; title: string; status: string; dueAt: string | null; updatedAt: string; masterScript: { version: number; confirmedAt: string | null } | null; opportunity: { title: string; angle: string } | null }
