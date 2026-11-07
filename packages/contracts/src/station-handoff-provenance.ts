/** Read-only presentation of the immutable PG handoff snapshot. No live source lookup. */
export type HandoffProvenanceSummary = {
  id: number
  stationInstanceId: string
  stationDraftId: string
  stationDraftVersion: number
  masterScriptVersion: number | null
  currentMasterVersion: number
  isCurrentMaster: boolean
  handedOffAt: string
  sourceDigest: string
  sourceDraftUrl: string
}

export type HandoffKnowledgeSource = {
  id: number | null
  version: number | null
  title: string
  bodyMarkdown: string
  sourceRef: string
  sourceUrl: string | null
  origin: 'material' | 'draft_reference'
}

export type HandoffProvenance = HandoffProvenanceSummary & {
  draft: { title: string; body: string }
  material: null | {
    id: string
    version: number | null
    title: string
    platform: string
    author: string
    url: string | null
    originalUrl: string | null
    sourceRef: string
    isSample: boolean
    transcript: { raw: string; corrected: string; source: string; version: number | null; segments: { start: number | null; end: number | null; text: string }[] }
  }
  topic: null | { id: string; title: string; body: string }
  knowledge: HandoffKnowledgeSource[]
}

export type ProjectHandoffProvenance = {
  projectId: number
  currentMasterVersion: number
  items: HandoffProvenanceSummary[]
  total: number
  offset: number
  hasMore: boolean
  nextOffset: number
}

type SavedHandoff = {
  id: number; stationInstanceId: string; stationDraftId: string; stationDraftVersion: number
  masterScriptVersion: number | null; sourceDigest: string; updatedAt: Date
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown) { return typeof value === 'string' ? value : '' }
function version(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null }
function seconds(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }

/** A saved URL is untrusted content. Only http(s) and the two known local source readers are links. */
export function handoffSourceUrl(value: unknown): string | null {
    // eslint-disable-next-line no-control-regex -- Reject embedded control characters in URLs.
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) return null
  if (/^\/admin\/(?:reading\?book|review\?reviewId)=[1-9]\d*$/.test(value)) return value
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function summarizeHandoffProvenance(handoff: SavedHandoff, currentMasterVersion: number): HandoffProvenanceSummary {
  const params = new URLSearchParams({ stationInstanceId: handoff.stationInstanceId, stationDraftId: handoff.stationDraftId, stationDraftVersion: String(handoff.stationDraftVersion) })
  return {
    id: handoff.id, stationInstanceId: handoff.stationInstanceId, stationDraftId: handoff.stationDraftId,
    stationDraftVersion: handoff.stationDraftVersion, masterScriptVersion: handoff.masterScriptVersion,
    currentMasterVersion, isCurrentMaster: handoff.masterScriptVersion !== null && handoff.masterScriptVersion === currentMasterVersion,
    handedOffAt: handoff.updatedAt.toISOString(), sourceDigest: handoff.sourceDigest, sourceDraftUrl: '/admin/viral?' + params,
  }
}

export function projectHandoffProvenance(handoff: SavedHandoff & { sourceSnapshot: unknown }, currentMasterVersion: number): HandoffProvenance {
  const snapshot = object(handoff.sourceSnapshot), draft = object(snapshot.draft), material = object(snapshot.material), transcript = object(material.transcript), topic = object(snapshot.topic)
  const knowledge: HandoffKnowledgeSource[] = []
  const addKnowledge = (value: unknown, origin: HandoffKnowledgeSource['origin']) => {
    const item = object(value)
    if (!Object.keys(item).length) return
    knowledge.push({ id: version(item.id), version: version(item.version), title: text(item.title), bodyMarkdown: text(item.bodyMarkdown), sourceRef: text(item.sourceRef), sourceUrl: handoffSourceUrl(item.sourceUrl), origin })
  }
  addKnowledge(material.knowledgeReference, 'material')
  const config = object(draft.config)
  if (Array.isArray(config.knowledgeReferences)) for (const reference of config.knowledgeReferences) addKnowledge(reference, 'draft_reference')
  return {
    ...summarizeHandoffProvenance(handoff, currentMasterVersion),
    draft: { title: text(draft.title), body: text(draft.body) },
    material: Object.keys(material).length ? {
      id: text(material.id), version: version(material.version), title: text(material.title), platform: text(material.platform), author: text(material.author),
      url: handoffSourceUrl(material.url), originalUrl: handoffSourceUrl(material.originalUrl), sourceRef: text(material.sourceRef),
      isSample: material.isSample === true || material.sample === true || material.sampleOrigin === 'public-trial',
      transcript: {
        raw: text(transcript.raw), corrected: text(transcript.corrected), source: text(transcript.source), version: version(transcript.version),
        segments: Array.isArray(transcript.segments) ? transcript.segments.map(value => { const item = object(value); return { start: seconds(item.start), end: seconds(item.end), text: text(item.text) } }) : [],
      },
    } : null,
    topic: Object.keys(topic).length ? { id: text(topic.id), title: text(topic.title), body: text(topic.body) || text(topic.angle) || text(topic.description) } : null,
    knowledge,
  }
}
