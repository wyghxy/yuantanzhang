'use client'
import type { ManuscriptHandle } from './writing/manuscript-rich-document'
import { useLayoutEffect, type Dispatch, type SetStateAction, type RefObject } from 'react'
import type { WritingDraft, WritingInput } from './studio-writing-model'
import { editManuscript, manuscriptProjection } from './writing/manuscript-timeline'

export type AssistantContext = {
  draftId?: string; materialId?: string; expectedVersion?: number
  title: string; body: string; selectionStart?: number; selectionEnd?: number
  sourceMaterialId?: string; sourceTitle?: string; sourceReady?: boolean
  sourceVersion?: number; sourceAnalysisFingerprint?: string
  intent?: 'replicate' | 'structure' | 'account'
  writingPending?: boolean; writingError?: string
}
type ContextRequest = { receive: (context: AssistantContext) => void }
export type AssistantApplyMode = 'append' | 'replace' | 'whole'
type ApplyRequest = { context: AssistantContext; content: string; mode: AssistantApplyMode; receive: (error?: string) => void }

export function currentAssistantContext(): AssistantContext {
  let context: AssistantContext = { title: '创作工作台', body: '' }
  window.dispatchEvent(new CustomEvent<ContextRequest>('studio-ai-context', { detail: { receive: value => { context = value } } }))
  return context
}
/** The structure bridge names the displayed source, independently of the draft. */
export function assistantContextFromOpenEvent(detail: unknown, current = currentAssistantContext()): AssistantContext {
  const value = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail as Record<string, unknown> : {}
  const intent = ['replicate', 'structure', 'account'].includes(String(value.intent)) ? value.intent as AssistantContext['intent'] : undefined
  const explicitSource = typeof value.sourceMaterialId === 'string'
  const sourceMaterialId = explicitSource ? value.sourceMaterialId as string : current.sourceMaterialId
  return { ...current, ...(intent ? { intent } : {}), ...(explicitSource || sourceMaterialId ? {
    sourceMaterialId,
    sourceTitle: typeof value.sourceTitle === 'string' ? value.sourceTitle : explicitSource ? undefined : current.sourceTitle,
    sourceReady: explicitSource ? undefined : current.sourceReady,
    sourceVersion: Number.isSafeInteger(value.sourceVersion) && Number(value.sourceVersion) > 0 ? Number(value.sourceVersion) : explicitSource ? undefined : current.sourceVersion,
    sourceAnalysisFingerprint: typeof value.sourceAnalysisFingerprint === 'string' ? value.sourceAnalysisFingerprint : explicitSource ? undefined : current.sourceAnalysisFingerprint,
  } : {}) }
}
export async function readyAssistantContext(draftId?: string, signal?: AbortSignal): Promise<AssistantContext> {
  const deadline = Date.now() + 15000
  while (true) {
    signal?.throwIfAborted()
    const current = currentAssistantContext()
    if (current.draftId !== draftId) throw new Error('当前稿件已切换，请关闭助手后重新打开。')
    if (current.writingError) throw new Error(current.writingError)
    if (!current.writingPending) return current
    if (Date.now() >= deadline) throw new Error('稿件仍在保存，请稍后再发送。')
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
}
export function applyAssistantResult(context: AssistantContext, content: string, mode: AssistantApplyMode) {
  let handled = false, error = ''
  window.dispatchEvent(new CustomEvent<ApplyRequest>('studio-ai-apply', {
    detail: { context, content, mode, receive: value => { handled = true; error = value || '' } },
  }))
  return handled ? error : '请回到生成建议时的稿件，再采用这段内容。'
}
export function useAssistantWritingContext(draft: WritingDraft | null, input: WritingInput,
  setInput: Dispatch<SetStateAction<WritingInput>>, textarea: RefObject<ManuscriptHandle | null>,
  blocked: boolean, onNotice: (message: string) => void, material?: Record<string, unknown> | null,
  writingPending = false, writingError = '') {
  useLayoutEffect(() => {
    if (!draft) return
    const plainBody = manuscriptProjection(input.body).text
    const get = (event: Event) => {
      const node = textarea.current, start = node?.selectionStart ?? 0, end = node?.selectionEnd ?? 0
      ;(event as CustomEvent<ContextRequest>).detail.receive({
        draftId: draft.id, expectedVersion: draft.version, title: input.title, body: plainBody,
        writingPending, writingError,
        sourceMaterialId: String(material?.id || draft.materialId || ''), sourceTitle: String(material?.title || ''),
        ...(Number.isSafeInteger(material?.version) ? { sourceVersion: Number(material?.version) } : {}),
        ...(typeof (material?.analysis as Record<string, unknown> | undefined)?.fingerprint === 'string'
          ? { sourceAnalysisFingerprint: String((material!.analysis as Record<string, unknown>).fingerprint) } : {}),
        sourceReady: !!material?.analysis && (material.analysis as Record<string, unknown>).stale !== true,
        ...(end > start ? { selectionStart: start, selectionEnd: end } : {}),
      })
    }
    const apply = (event: Event) => {
      const request = (event as CustomEvent<ApplyRequest>).detail, source = request.context
      if (source.draftId !== draft.id || source.expectedVersion !== draft.version || source.body !== plainBody || source.title !== input.title) {
        request.receive('稿件已经变化，请复制建议，或基于当前稿件重新提问。'); return
      }
      if (writingError) { request.receive(writingError); return }
      if (blocked || writingPending) { request.receive('请等待当前稿件保存完成后再采用。'); return }
      const start = source.selectionStart, end = source.selectionEnd
      if (request.mode === 'replace' && (start === undefined || end === undefined || end <= start)) {
        request.receive('没有可以替换的选段。'); return
      }
      const body = request.mode === 'whole' ? request.content : request.mode === 'replace'
        ? plainBody.slice(0, start) + request.content + plainBody.slice(end)
        : plainBody + (plainBody.trim() ? '\n\n' : '') + request.content
      setInput({ ...input, body: editManuscript(input.body, body) }); onNotice('建议已放入稿件，保存后生效。'); request.receive()
    }
    window.addEventListener('studio-ai-context', get); window.addEventListener('studio-ai-apply', apply)
    window.dispatchEvent(new Event('studio-ai-context-changed'))
    return () => { window.removeEventListener('studio-ai-context', get); window.removeEventListener('studio-ai-apply', apply) }
  }, [draft, input, setInput, textarea, blocked, onNotice, material, writingPending, writingError])
}
