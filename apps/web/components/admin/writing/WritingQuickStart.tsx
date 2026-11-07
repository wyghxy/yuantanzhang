'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function WritingQuickStart({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try {
      const response = await fetch('/api/workspace/content-projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'writing', title: form.get('title') }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '创建失败')
      router.push(`/workspace/creation/${result.project.id}`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '创建失败'); setBusy(false) }
  }
  return <form onSubmit={(e) => { void submit(e) }} className="creation-list-quick-start" aria-busy={busy}>
    <div><h2>新建文案</h2><p>先给文案起个名字，进入后添加视频链接或逐字稿。</p></div>
    <div className="creation-list-quick-fields"><label className="radar-field"><span className="sr-only">文案标题</span><input name="title" required maxLength={240} placeholder="这次准备讲什么？" disabled={busy} /></label><button className="radar-primary-button" disabled={busy} type="submit">{busy ? '正在创建…' : '开始创作'}</button>{onCancel && <button className="radar-ghost-button" disabled={busy} type="button" onClick={onCancel}>取消</button>}</div>
    {error && <p role="alert" className="creation-list-notice is-error">{error}</p>}
  </form>
}
