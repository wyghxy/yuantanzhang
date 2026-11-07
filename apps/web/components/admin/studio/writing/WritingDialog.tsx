'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { X } from 'lucide-react'

import styles from '../StudioWriting.module.css'

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  closeDisabled = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  closeDisabled?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    if (!root) return
    root.showModal()
    return () => {
      root.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeDisabled) onClose()
      }}
    >
      <header>
        <h2>{title}</h2>
        <button onClick={onClose} disabled={closeDisabled} aria-label="关闭弹窗">
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  )
}
