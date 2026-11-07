'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { autoUpdate, computePosition, flip, hide, offset, shift } from '@floating-ui/dom'
import { X } from 'lucide-react'
import styles from './TranscriptAnnotations.module.css'
import { checkboxNotePlacement } from './transcript-note-placement'

export type NotePosition = { target: Range | HTMLElement; root: HTMLElement }

/** Non-modal reading tool: retain the selection and keep the source panel scrollable. */
export function TranscriptNotePopover({ position, title, close, children, keepOpenFor, restoreFocus }: {
  position: NotePosition; title: string; close: () => void; children: ReactNode
  keepOpenFor?: (target: EventTarget | null) => boolean
  restoreFocus?: () => boolean
}) {
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState({ left: 12, top: 12, visible: false })
  useLayoutEffect(() => {
    if (!content) return
    let active = true, sequence = 0
    const root = position.root
    const reference = {
      contextElement: position.target instanceof HTMLElement ? position.target : root,
      getBoundingClientRect: () => {
        const rects = position.target.getClientRects()
        return rects[rects.length - 1] || position.target.getBoundingClientRect()
      },
    }
    const update = () => {
      const request = ++sequence
      if (!root.isConnected || root.closest('[hidden]') || !root.getClientRects().length) {
        setPlacement(previous => ({ ...previous, visible: false })); return
      }
      const checkbox = position.target instanceof HTMLInputElement && position.target.hasAttribute('data-excerpt-checkbox')
      const reserved = checkbox ? checkboxNotePlacement(root.getBoundingClientRect(), position.target.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight }) : null
      if (checkbox && !reserved) { setPlacement(previous => ({ ...previous, visible: false })); return }
      content.style.width = reserved ? `${reserved.width}px` : ''
      // A checkbox-anchored panel may extend vertically into the next source,
      // but never cover its checkbox column. Do not let viewport shift undo it.
      const bounds = reserved ? { boundary: [] as Element[], rootBoundary: reserved.boundary, padding: 0 } : { padding: 12 }
      void computePosition(reference, content, {
        strategy: 'fixed', placement: checkbox ? 'right-start' : 'bottom-start',
        middleware: [offset(10), flip({ ...bounds, ...(checkbox ? { fallbackPlacements: ['right-end' as const] } : {}) }),
          shift({ ...bounds, crossAxis: true }), hide({ boundary: root })],
      }).then(({ x, y, middlewareData }) => {
        if (active && request === sequence) setPlacement({ left: x, top: y, visible: !middlewareData.hide?.referenceHidden })
      }).catch(() => {
        if (active && request === sequence) setPlacement(previous => ({ ...previous, visible: false }))
      })
    }
    const cleanup = autoUpdate(reference, content, update)
    // A Range uses the source root as its context; autoUpdate watches ancestors,
    // so also track scrolling of that root and its nested reading containers.
    root.addEventListener('scroll', update, { capture: true, passive: true })
    const visibility = new MutationObserver(update)
    for (let element: HTMLElement | null = root; element; element = element.parentElement)
      visibility.observe(element, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] })
    return () => {
      active = false; cleanup(); root.removeEventListener('scroll', update, true); visibility.disconnect()
    }
  }, [position, content])
  return <Dialog.Root open onOpenChange={open => { if (!open) close() }} modal={false}>
    <Dialog.Portal><Dialog.Content className={styles.popover} ref={setContent} aria-describedby={undefined}
      style={{ left: placement.left, top: placement.top, visibility: placement.visible ? 'visible' : 'hidden' }}
      onOpenAutoFocus={event => { if (position.target instanceof Range || keepOpenFor?.(position.target)) event.preventDefault() }}
      onCloseAutoFocus={event => {
        event.preventDefault()
        if (restoreFocus && !restoreFocus()) return
        if (position.target instanceof HTMLElement &&
          (document.activeElement === document.body || content?.contains(document.activeElement)))
          (position.target.isConnected ? position.target.closest<HTMLElement>('button, input, [tabindex]') || position.root : position.root).focus({ preventScroll: true })
      }}
      onInteractOutside={event => {
        if (keepOpenFor?.(event.target) || event.target instanceof Node && position.root.contains(event.target) && window.getSelection()?.isCollapsed === false) event.preventDefault()
      }}>
      <header className={styles.popoverHeader}><Dialog.Title>{title}</Dialog.Title><Dialog.Close className={styles.iconButton} aria-label="关闭笔记浮层"><X size={18} aria-hidden /></Dialog.Close></header>
      {children}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
