'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/** Let the browser finish its native selection before placing controls beside it. */
export function useTranscriptSelection(root: RefObject<HTMLDivElement | null>, enabled: boolean, capture: () => void) {
  const pending = useRef(false)
  const [interaction, setInteraction] = useState<{ capture: () => void; selecting: boolean } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let pointer: number | null = null, keyboard = false, timer: ReturnType<typeof setTimeout> | undefined
    let ignored: { anchor: Node | null; focus: Node | null; start: number; end: number } | null = null
    const ignoredSelection = () => {
      const selection = window.getSelection()
      return !!ignored && selection?.anchorNode === ignored.anchor && selection.focusNode === ignored.focus &&
        selection.anchorOffset === ignored.start && selection.focusOffset === ignored.end
    }
    const busy = (value: boolean) => {
      pending.current = value
      setInteraction(previous => previous?.capture === capture && previous.selecting === value ? previous : { capture, selecting: value })
      // Stop an already running smooth follow-scroll without changing the media.
      if (value && root.current) root.current.scrollTo({ top: root.current.scrollTop, behavior: 'instant' })
    }
    const inside = () => {
      const selection = window.getSelection()
      return !!selection?.anchorNode && !!selection.focusNode && !!root.current?.contains(selection.anchorNode) && root.current.contains(selection.focusNode)
    }
    const settle = (delay = 0) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (pointer !== null || keyboard) return
        if (!ignoredSelection()) capture()
        busy(false)
      }, delay)
    }
    const discardPreservedSelection = () => {
      pointer = null; keyboard = false; clearTimeout(timer)
      const selected = window.getSelection()
      ignored = selected ? { anchor: selected.anchorNode, focus: selected.focusNode, start: selected.anchorOffset, end: selected.focusOffset } : null
      if (pending.current) busy(false)
    }
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return
      if (!root.current?.contains(event.target.closest('[data-note-text]'))) {
        // A button/checkbox in another source must not let this source's delayed
        // selection timer reclaim ownership using the browser's preserved range.
        discardPreservedSelection()
        return
      }
      ignored = null
      pointer = event.pointerId
      clearTimeout(timer)
      busy(true)
    }
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return
      pointer = null
      // Native touch selection may cancel a pointer before its handles appear.
      settle(event.type === 'pointercancel' ? 160 : 0)
    }
    const editing = () => document.activeElement?.matches('input, textarea, [contenteditable="true"]')
    const focus = (event: FocusEvent) => {
      // Tab/Space can hand control to another source without a pointer event.
      if (!(event.target instanceof Element) || !root.current?.contains(event.target.closest('[data-note-text]')))
        discardPreservedSelection()
    }
    const selection = () => {
      // Textarea caret changes can emit selectionchange while the old source range remains.
      if (editing()) return
      if (!inside()) return
      if (ignoredSelection()) return
      if (window.getSelection()?.isCollapsed === false) busy(true)
      if (pointer === null && !keyboard) settle(160)
    }
    const keydown = (event: KeyboardEvent) => {
      if (editing()) return
      if (event.shiftKey && /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(event.key) && inside()) {
        keyboard = true; clearTimeout(timer); busy(true)
      }
    }
    const keyup = (event: KeyboardEvent) => {
      if (keyboard && (event.key === 'Shift' || !event.shiftKey)) { keyboard = false; settle() }
    }
    const blur = () => { pointer = null; keyboard = false; settle() }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('selectionchange', selection)
    document.addEventListener('focusin', focus, true)
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('keyup', keyup, true)
    window.addEventListener('blur', blur)
    return () => {
      clearTimeout(timer)
      pending.current = false
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      document.removeEventListener('selectionchange', selection)
      document.removeEventListener('focusin', focus, true)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('keyup', keyup, true)
      window.removeEventListener('blur', blur)
    }
  }, [root, enabled, capture])
  return { pending, selecting: enabled && interaction?.capture === capture && interaction.selecting }
}
