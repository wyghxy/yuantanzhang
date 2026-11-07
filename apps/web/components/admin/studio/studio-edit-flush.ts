type Session = { flush: () => Promise<boolean>; dirty: () => boolean; cache: () => void }
const sessions = new Set<Session>()

/** In-page editor lifecycle only; no presence server or browser-wide shared draft. */
export function registerStudioWritingSession(session: Session) {
  sessions.add(session)
  return () => {
    session.cache()
    sessions.delete(session)
  }
}

export function studioWritingEditsPending() {
  return [...sessions].some((session) => session.dirty())
}

export async function flushStudioWritingEdits() {
  const active = [...sessions]
  let failed = false
  for (const session of active) {
    try {
      session.cache()
      await session.flush()
    } catch {
      failed = true
    }
  }
  return {
    registered: active.length > 0,
    pending: failed || active.some((session) => session.dirty()),
  }
}
