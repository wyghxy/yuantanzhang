'use client'

type Icon = 'settings' | 'play' | 'chevron' | 'close' | 'clock'

/** The schedule reference owns these shapes; keep its artwork unchanged. */
export function StudioDispatchIcon({ name }: { name: Icon }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{name === 'settings' ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></> : name === 'play' ? <path d="m9 5 11 7-11 7Z" /> : name === 'chevron' ? <path d="m8 10 4 4 4-4" /> : name === 'close' ? <path d="m6 6 12 12M6 18 18 6" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}</svg>
}
