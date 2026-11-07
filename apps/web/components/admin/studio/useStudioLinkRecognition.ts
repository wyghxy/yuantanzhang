'use client'
import { useEffect, useState } from 'react'
import { api, errorText, object, type RecordData } from './studio-client'

/** Classifying a pasted link never starts collection or resolves a remote redirect. */
export function useStudioLinkRecognition(value: string, active: boolean, _onTask: (id: string) => void) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ input: '', attempt: 0, link: null as RecordData | null, pending: false, error: '' })
  useEffect(() => {
    const controller = new AbortController()
    if (!active || !value.trim()) return () => controller.abort()
    const timer = setTimeout(() => {
      setState({ input: value, attempt: retry, link: null, pending: true, error: '' })
      void api('links', 'POST', { text: value }, controller.signal).then(data => {
        if (!controller.signal.aborted) setState({ input: value, attempt: retry, link: object(data.link), pending: false, error: '' })
      }).catch(error => {
        if (!controller.signal.aborted) setState({ input: value, attempt: retry, link: null, pending: false, error: errorText(error) })
      })
    }, 400)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [value, active, retry])
  const current = active && state.input === value && state.attempt === retry
  return {
    recognized: current ? state.link : null,
    recognizing: active && !!value.trim() && (!current || state.pending),
    resolveTask: '', recognitionError: current ? state.error : '',
    recognize: () => setRetry(value => value + 1),
  }
}
