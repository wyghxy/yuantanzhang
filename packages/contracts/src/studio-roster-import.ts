type StudioPayload = Record<string, unknown>
export type StudioRosterRow = {
  key: string; documentId: number; documentVersion: number; sourceTitle: string; line: number; originalInput: string
  status: 'ready' | 'duplicate' | 'failure'; account: StudioPayload | null; existingAccountId: string | null; duplicateOf: string | null
  requiresResolution: boolean; error: { code: string; message: string } | null
}
