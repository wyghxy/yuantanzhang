/** AI writing associations use existing owned article identities, never client supplied evidence. */
export const ASSISTANT_RELATED_DRAFT_LIMIT = 10
export const ASSISTANT_CONTEXT_CHARACTER_LIMIT = 100000
export const ASSISTANT_PLAN_VERSION = 2
/** New snapshots require an explicit search choice. Old frozen inputs retain
 * their original connection-bound search decision and budget. */
export function assistantUsesWebSearch(input: Record<string, unknown>, legacyAvailable: boolean) {
  return input.assistantPlanVersion === ASSISTANT_PLAN_VERSION ? input.webSearch === true
    : typeof input.webSearch === 'boolean' ? input.webSearch : legacyAvailable
}
export type AssistantDraftAssociation = { draftId: string; expectedVersion: number }
export type AssistantCoverageItem = {
  kind: 'draft' | 'material' | 'reference' | 'selection' | 'analysis' | 'profile' | 'conversation'
  id: string; title: string; version?: number; primaryId?: string; primaryVersion?: number
  sourceRef?: string; digest: string; characters: number; scope: 'full' | 'excerpt'
}
export type AssistantCoverage = {
  version: 1; items: AssistantCoverageItem[]; serializedCharacters: number
  characterLimit: number; omittedConversationRounds: number; legacyConversationCoverage: boolean
}

/** Same editable text projection used by the manuscript editor, without changing saved timecodes. */
export function assistantManuscriptText(body: string) {
  return body.replace(/\r\n?/g, '\n').replace(/^(\[(?:\d{1,2}:)?\d{2,3}:[0-5]\d(?:[.,]\d{1,3})?\])[ \t]*/gm, '')
}
