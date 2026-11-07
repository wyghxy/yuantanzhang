const sessionEnded = 'ytz:studio-session-ended'

/** A successful logout invalidates media already buffered in other same-origin tabs. */
export function notifyStudioSessionEnded() {
  window.dispatchEvent(new Event(sessionEnded))
  try { localStorage.setItem(sessionEnded, `${Date.now()}:${Math.random()}`) } catch { /* Storage may be disabled. */ }
  try {
    const channel = new BroadcastChannel(sessionEnded)
    channel.postMessage('logout'); channel.close()
  } catch { /* Storage events remain the fallback. */ }
}

export function onStudioSessionEnded(stop: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === sessionEnded && event.newValue) stop() }
  window.addEventListener(sessionEnded, stop)
  window.addEventListener('storage', storage)
  let channel: BroadcastChannel | undefined
  try {
    channel = new BroadcastChannel(sessionEnded)
    channel.onmessage = event => { if (event.data === 'logout') stop() }
  } catch { /* The same-page and storage listeners still protect the player. */ }
  return () => {
    window.removeEventListener(sessionEnded, stop)
    window.removeEventListener('storage', storage)
    channel?.close()
  }
}
