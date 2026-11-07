'use client'

import { useState, type ReactNode } from 'react'
import { api, errorText, text, type RecordData } from './studio-client'
import { Field, Modal } from './StudioUI'
import StudioDashboardClock from './StudioDashboardClock'
import s from './StudioDashboard.module.css'

export default function StudioRadarIntro({ preferences, onPreferences, title = '情报看板', emblem, compactContext = false }: {
  preferences: RecordData | null
  onPreferences: (value: RecordData) => void
  title?: string
  emblem?: ReactNode
  compactContext?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [quote, setQuote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<RecordData | null>(null)
  const open = () => { setQuote(text(preferences?.quote)); setCurrent(preferences); setError(''); setEditing(true) }
  const save = async () => {
    if (!current || saving) return
    setSaving(true); setError('')
    try {
      const value = await api('preferences', 'PATCH', { expectedVersion: current.version, quote: quote.trim() })
      onPreferences(value); setEditing(false)
    } catch (cause) { setError(errorText(cause)) } finally { setSaving(false) }
  }
  return <>
    <header className={'page-heading workspace-intro' + (compactContext ? ' workspace-context' : '')}>
      <span className="intro-optics" aria-hidden="true" />
      <div className="intro-copy">
        <div className="intro-title"><span className="workspace-emblem">{emblem || <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 7-7" /><circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none" /></svg>}</span><h1>{title}</h1></div>
      </div>
      <button className="daily-quote" onClick={open} disabled={!preferences} aria-label="编辑今日语录">
        <span className="daily-quote-label"><span className="daily-quote-caption">今日语录</span><span className="quote-edit"><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M12 3v5h5m-5-5 3 3m1 5 3-3 3 3-8 8-4 1 1-4 5-5Z" /></svg></span></span>
        <span className="daily-quote-content"><span className="daily-quote-decoration" aria-hidden="true">“</span><span className="daily-quote-text">{text(preferences?.quote) || (preferences ? '写下今日语录' : '正在读取语录…')}</span><span className="daily-quote-decoration" aria-hidden="true">”</span></span>
      </button>
      <StudioDashboardClock />
    </header>
    {editing && <Modal title="今日语录" close={() => setEditing(false)} closeDisabled={saving}>
      <div className={s.form}>
        <Field label="写给自己的一句话"><textarea autoFocus value={quote} maxLength={160} rows={3} onChange={event => setQuote(event.target.value)} placeholder="今天想对自己说些什么？" /></Field>
        <span className={s.muted}>{Array.from(quote).length} / 160 · 保存后会保留在你的工作台</span>
        {error && <p role="alert">{error}</p>}
        <div className={s.formActions}>
          {error && <button className="btn ghost" disabled={saving} onClick={() => void api('preferences').then(value => { setCurrent(value); onPreferences(value); setError('已读取最新版本，你正在编辑的文字已保留。') }).catch(cause => setError(errorText(cause)))}>读取最新版本</button>}
          <button className="btn primary" disabled={saving || !current} onClick={() => void save()}>{saving ? '保存中…' : '保存语录'}</button>
        </div>
      </div>
    </Modal>}
  </>
}
