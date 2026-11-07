'use client'
import { useEffect, useRef, useState } from 'react'
import { api, errorText, object, text, type RecordData } from './studio-client'
import { resolvedStudioLink } from './StudioMaterialHelpers'

/** Each input owns its requests; a late short-link result cannot replace a newer paste. */
export function useStudioLinkRecognition(value: string, active: boolean, onTask: (id: string) => void) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ input: '', attempt: 0, link: null as RecordData | null, pending: false, task: '', error: '' })
  const taskCallback = useRef(onTask)
  useEffect(() => { taskCallback.current = onTask }, [onTask])
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const update = (next: Partial<typeof state>) => {
      if (!controller.signal.aborted) setState(current => ({ ...current, input: value, attempt: retry, ...next }))
    }
    if (!active || !value.trim()) return () => controller.abort()
    async function poll(id: string) {
      try {
        const task = object((await api(`tasks/${encodeURIComponent(id)}?projection=result`, 'GET', undefined, controller.signal)).task)
        if (controller.signal.aborted) return
        if (task.status === 'succeeded') {
          const link = resolvedStudioLink(task.output || task.result)
          if (link.detectedKind === 'unknown') throw new Error('链接未能识别为作品或博主主页，请使用完整链接重试')
          update({ link, task: '', pending: false })
        } else if (['failed', 'blocked', 'cancelled'].includes(text(task.status))) {
          throw new Error(text(object(task.error).message, text(task.error, '短链还原未完成，请使用完整链接重试')))
        } else timer = setTimeout(() => void poll(id), 1500)
      } catch (error) { update({ error: errorText(error), task: '', pending: false }) }
    }
    async function recognize() {
      update({ link: null, pending: true, task: '', error: '' })
      try {
        const link = object((await api('links', 'POST', { text: value }, controller.signal)).link)
        if (controller.signal.aborted) return
        update({ link })
        if (!link.requiresResolution) { update({ pending: false }); return }
        const data = await api('tasks', 'POST', { kind: 'classify', url: link.url, idempotencyKey: crypto.randomUUID() }, controller.signal)
        if (controller.signal.aborted) return
        const id = text(object(data.task).id)
        if (!id) throw new Error('未能创建链接识别任务，请重试')
        update({ task: id })
        taskCallback.current(id)
        void poll(id)
      } catch (error) { update({ error: errorText(error), task: '', pending: false }) }
    }
    timer = setTimeout(() => void recognize(), 400)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [value, active, retry])
  const current = active && state.input === value && state.attempt === retry
  return {
    recognized: current ? state.link : null,
    recognizing: active && !!value.trim() && (!current || state.pending),
    resolveTask: current ? state.task : '',
    recognitionError: current ? state.error : '',
    recognize: () => setRetry(value => value + 1),
  }
}
