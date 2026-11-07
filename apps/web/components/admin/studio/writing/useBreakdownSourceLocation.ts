'use client'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { BREAKDOWN_LOCATE_EVENT, breakdownDomTargets, breakdownTextRange, verifyBreakdownSource, type BreakdownLocateRequest } from './breakdown-source-location'
import styles from './BreakdownSourceLocation.module.css'

type Options = {
  owner: RefObject<HTMLElement | null>; materialId: string; version: number; body: string
  reveal: (trigger: HTMLElement) => string | void; readRoot: () => HTMLElement | null
}

/** An ephemeral visual location reuses the current reader; it never edits notes or saved text. */
export function useBreakdownSourceLocation(options: Options) {
  const latest = useRef(options), sequence = useRef({ value: 0 }), clear = useRef<() => void>(() => {})
  useLayoutEffect(() => { latest.current = options })
  useEffect(() => {
    sequence.current.value++; clear.current()
  }, [options.materialId, options.version, options.body])
  useEffect(() => {
    const counter = sequence.current
    const locate = (event: Event) => {
      const request = (event as CustomEvent<BreakdownLocateRequest>).detail
      if (!request?.binding || !request.trigger || !latest.current.owner.current?.contains(request.trigger)) return
      const generation = ++counter.value, current = latest.current
      const unchanged = () => generation === counter.value && latest.current.materialId === current.materialId &&
        latest.current.version === current.version && latest.current.body === current.body
      request.receive((async () => {
        try {
          const paragraphs = await verifyBreakdownSource(request.binding, current)
          if (!unchanged()) throw new Error('参考作品已切换；未定位到其他作品。')
          const problem = current.reveal(request.trigger)
          if (problem) return problem
          let root: HTMLElement | null = null
          for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
            if (!unchanged()) throw new Error('参考作品已切换；未定位到其他作品。')
            root = latest.current.readRoot()
            if (root && root.dataset.breakdownReadingRoot === current.materialId && Number(root.dataset.breakdownReadingVersion) === current.version &&
                !root.closest('[hidden]') && root.clientHeight > 0) break
            root = null
          }
          if (!root) return '原文阅读区尚未就绪；已保留引用，请稍后再定位。'
          const targets = breakdownDomTargets(root, request.binding, paragraphs)
          if (!targets.length) return '未取得可唯一定位的原文；已保留冻结引用。'
          const ranges = targets.map(breakdownTextRange)
          clear.current()
          const native = window as unknown as { Highlight?: new (...ranges: Range[]) => unknown;
            CSS?: { highlights?: { set: (name: string, value: unknown) => void; get: (name: string) => unknown; delete: (name: string) => void } } }
          const highlight = native.Highlight ? new native.Highlight(...ranges) : null
          if (highlight) native.CSS?.highlights?.set('studio-breakdown-source', highlight)
          const previous = targets.map(({ element }) => ({ element, tabIndex: element.getAttribute('tabindex') }))
          for (const { element } of targets) { element.classList.add(styles.target); element.tabIndex = -1 }
          clear.current = () => {
            if (highlight && native.CSS?.highlights?.get('studio-breakdown-source') === highlight)
              native.CSS.highlights.delete('studio-breakdown-source')
            for (const { element, tabIndex } of previous) {
              element.classList.remove(styles.target)
              if (tabIndex === null) element.removeAttribute('tabindex'); else element.setAttribute('tabindex', tabIndex)
            }
          }
          targets[0].element.scrollIntoView({ block: 'center', behavior: 'instant' })
          let container = targets[0].element.parentElement
          while (container && !/(auto|scroll)/.test(getComputedStyle(container).overflowY)) container = container.parentElement
          if (container) {
            const target = ranges[0].getBoundingClientRect(), frame = container.getBoundingClientRect()
            container.scrollTo({ top: container.scrollTop + target.top - frame.top - container.clientHeight / 3, behavior: 'instant' })
          }
          targets[0].element.focus({ preventScroll: true })
          return ''
        } catch (error) { return error instanceof Error ? error.message : '暂时无法定位；已保留冻结原文。' }
      })())
    }
    window.addEventListener(BREAKDOWN_LOCATE_EVENT, locate)
    return () => { counter.value++; clear.current(); window.removeEventListener(BREAKDOWN_LOCATE_EVENT, locate) }
  }, [])
}
