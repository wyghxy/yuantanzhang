import type { WritingAnalysis, WritingConfig, WritingDocument, WritingProfile } from './writing-domain'
export interface WritingSnapshot {
  connectionVersion?: number
  forceAsr?: boolean
  projectId: number; masterVersion: number; profileRevision: number; settingsRevision: number
  profile: WritingProfile; config: WritingConfig
  material: { id: number; revision: number; title: string; url: string | null; text: string; sourceItemId: number | null; analysis: WritingAnalysis | null; analysisRevision: number | null } | null
  draft: { id: number; revision: number; document: WritingDocument } | null
  master: { title: string; body: string; confirmed: boolean } | null
  instruction: string; segmentId: string | null
}
