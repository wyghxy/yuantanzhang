export type WritingCacheScope = { workspaceId: string; ownerId: string }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function writingCacheScope(value:unknown):WritingCacheScope|null {
 const row=value && typeof value==='object' ? value as Record<string,unknown> : {}
 return typeof row.workspaceId==='string' && uuid.test(row.workspaceId) &&
  typeof row.ownerId==='string' && uuid.test(row.ownerId) ?
  {workspaceId:row.workspaceId.toLowerCase(),ownerId:row.ownerId.toLowerCase()} : null
}
export function sameWritingCacheScope(a: WritingCacheScope | null, b: WritingCacheScope | null) {
  return !!a && !!b && a.ownerId === b.ownerId && a.workspaceId === b.workspaceId
}

/** Unscoped legacy copies are preserved in storage but never read for another identity. */
export function writingCacheKey(scope: WritingCacheScope | null, draftId: string) {
  return scope
    ? `yuantanzhang:studio:unsaved:v2:${scope.ownerId}:${scope.workspaceId}:${encodeURIComponent(draftId)}`
    : ''
}
