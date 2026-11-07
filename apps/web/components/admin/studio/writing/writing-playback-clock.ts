'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { activePlaybackIndex } from '@ytz/contracts/studio-playback'

/** Media ticks must not invalidate material, note or editor context. */
export function createPlaybackClock() {
  let time = 0
  const listeners = new Set<() => void>()
  return {
    getTime: () => time,
    setTime(next: number) {
      if (!Number.isFinite(next)) return
      const value = Math.max(0, next)
      if (value === time) return
      time = value
      listeners.forEach(notify => notify())
    },
    subscribe(notify: () => void) {
      listeners.add(notify)
      return () => { listeners.delete(notify) }
    },
  }
}

export type PlaybackClock = ReturnType<typeof createPlaybackClock>
const noSubscription = () => () => {}
const noIndex = () => -1

/** React only updates when the active paragraph/word changes, not every media tick. */
export function usePlaybackIndex(clock: PlaybackClock | undefined, items: Parameters<typeof activePlaybackIndex>[0], enabled: boolean) {
  const snapshot = useCallback(() => clock && enabled ? activePlaybackIndex(items, clock.getTime() * 1000) : -1, [clock, items, enabled])
  return useSyncExternalStore(enabled && clock ? clock.subscribe : noSubscription, snapshot, noIndex)
}
