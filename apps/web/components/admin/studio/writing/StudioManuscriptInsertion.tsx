'use client'

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

type Insert = (text: string) => Promise<boolean>
type Insertion = { disabled: boolean; paste: Insert; register: (insert: Insert) => () => void }
const Context = createContext<Insertion | null>(null)

/** The provider is keyed by draft ID at the creation-workbench boundary. */
export function StudioManuscriptInsertion({ disabled, reveal, children }: {
  disabled: boolean; reveal: () => void; children: ReactNode
}) {
  const target = useRef<Insert | null>(null)
  const register = useCallback((insert: Insert) => {
    target.current = insert
    return () => { if (target.current === insert) target.current = null }
  }, [])
  const paste = useCallback<Insert>(async text => {
    if (disabled || !target.current) return false
    const result = target.current(text)
    reveal()
    return result
  }, [disabled, reveal])
  const value = useMemo(() => ({ disabled, paste, register }), [disabled, paste, register])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useManuscriptInsertion = () => useContext(Context)
