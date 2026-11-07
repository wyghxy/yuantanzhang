'use client'

import {
  writingCardSection,
  writingSegments,
  writingError,
  writingObject as obj,
  writingText as text,
  type WritingRecord,
} from '../studio-writing-model'
import { serializeWritingInput } from './writing-rebase'

export type Props = { draftId: string; initialMode?: 'original' | 'editor'; initialTab?: string; onClose: () => void; onChanged?: () => void; onSwitch?: (id: string) => void; onPick?: (kind: 'topic' | 'source', id: string) => void }

export type View = 'markdown' | 'director' | 'teleprompter' | 'cards'

export type Candidate = WritingRecord & {
  id: string
  target?: WritingRecord
  output?: WritingRecord
  status?: string
}

export type Task = WritingRecord & {
  id: string
  status: string
  phase?: string
  progress?: number
  result?: WritingRecord
  error?: string
}

export type SavedRevision = {
  version: number
  data: WritingRecord
  reason?: string
  createdAt?: string
}

export type HandoffPreview = {
  sourceDigest: string
  draftVersion: number
  expectedMasterVersion: number
  targetProjectId: number | null
  title: string
  body: string
}

export type TextDownload = {
  format: 'markdown' | 'txt'
  version: number
  filename: string
  href: string
}

export const active = (task: Task | null) => !!task && ['queued', 'running'].includes(task.status)

export const base = '/api/workspace/studio/'

export const taskNames: Record<string, string> = {
  queued: '排队中',
  running: '处理中',
  succeeded: '已完成',
  blocked: '需要配置或人工处理',
  failed: '未完成',
  cancelled: '已停止',
}

export const date = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

export const candidateBody = (value: Candidate) =>
  text(obj(value.output?.generated).scriptMarkdown) || text(value.output?.body)

export const serialize = serializeWritingInput

export function writingPickerTitle(mode: 'topic' | 'source' | 'draft', draftTitle: string, entityTitle: unknown) {
  return (mode === 'draft' ? draftTitle : text(entityTitle) || draftTitle) || '未命名稿件'
}

export function parseWritingBody(body: string) {
  try {
    const section = writingCardSection(body),
      segments = writingSegments(body)
    return {
      segments,
      cards: section.hasSection
        ? section.cards
        : segments
            .filter((s) => s.role !== '开场')
            .map((s, i) => ({
              id: `C${String(i + 1).padStart(2, '0')}`,
              title: s.role,
              content: s.narration,
              type: '台词文字卡',
            })),
      error: '',
    }
  } catch (e) {
    return { segments: [], cards: [], error: writingError(e) }
  }
}
