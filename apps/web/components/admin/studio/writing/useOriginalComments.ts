'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { WritingRecord } from '../studio-writing-model'
import type { useMaterialNotes } from './useMaterialNotes'
import { useCommentSnapshot } from './useCommentSnapshot'

type Source = { record_id: string; video_title: string; comment_snapshot: unknown }
type Pane = { pane: HTMLElement; render: (source: Source) => void }
export type Renderer = { createPane: (options: {
  studio: HTMLElement; host: { notes: (id: string, value?: string) => string }
  ui: { showToast: (message: string) => void }; esc: (value: string) => string
}) => Pane }
const loadRenderer=()=>import('./personal-comment-pane').then(module=>module.renderer)

/** Attach the local comment reader to the reference column. */
export function useOriginalComments(props: {
  studio: RefObject<HTMLElement | null>; material: WritingRecord | null
  notes: ReturnType<typeof useMaterialNotes>; active: boolean; mounted: boolean
  frozen: boolean; notify: (message: string) => void
}) {
  const controls = useCommentSnapshot(String(props.material?.id || ''), props.active && props.mounted, props.frozen)
  const snapshot = controls.snapshot
  const snapshotRef = useRef(snapshot)
  useLayoutEffect(() => { snapshotRef.current = snapshot })
  const latest = useRef(props), instance = useRef<Pane | null>(null)
  useLayoutEffect(() => { latest.current = props })
  const render = () => {
    const { material, active } = latest.current
    instance.current?.render({ record_id: String(material?.id || ''), video_title: String(material?.title || ''), comment_snapshot: snapshotRef.current || material?.comment_snapshot })
    if (instance.current) instance.current.pane.hidden = !active
  }
  useEffect(() => {
    if (!props.mounted || !props.studio.current) return
    const studio = props.studio.current
    let disposed = false
    void loadRenderer().then(renderer => {
      if (disposed) return
      const pane = renderer.createPane({
        studio,
        host: { notes: (id, value) => {
          const { material, notes, frozen } = latest.current
          if (String(material?.id) !== id) return ''
          if (value !== undefined && notes.ready && !frozen && value.length <= 12000) {
            notes.edit(value)
            void notes.save(id)
          }
          return notes.value
        } },
        ui: { showToast: message => latest.current.notify(message) },
        esc: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!),
      })
      pane.pane.addEventListener('click', event => {
        const button = (event.target as Element).closest('[data-comment-index]')
        if (!button) return
        const { frozen, notes } = latest.current
        if (frozen || !notes.ready || notes.error) {
          event.stopImmediatePropagation()
          latest.current.notify(notes.error || '请等待当前作品笔记读取完成')
        }
        const comment = button.closest('.cw-comment')
        const sourceTitle = String(latest.current.material?.title || '')
        const projected = notes.value.length + sourceTitle.length + (comment?.textContent?.length || 0) + 32
        if (projected > 12000) {
          event.stopImmediatePropagation()
          latest.current.notify('笔记已接近 12,000 字，请先整理笔记再添加')
        }
      }, true)
      instance.current = pane
      render()
    }).catch(error => { if (!disposed) latest.current.notify(error instanceof Error ? error.message : '评论读取失败') })
    return () => { disposed = true; instance.current?.pane.remove(); instance.current = null }
  }, [props.mounted, props.studio])
  useEffect(render, [props.material, props.active, props.notes.value, snapshot])
  return controls
}
