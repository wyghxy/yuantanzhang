'use client'
import { useEffect, useState } from 'react'
import { Files } from 'lucide-react'
import { ASSISTANT_RELATED_DRAFT_LIMIT, type AssistantDraftAssociation } from '@ytz/contracts/studio-assistant'
import { api, errorText, list, text, type RecordData } from './studio-client'

export type AssistantArticleChoice = AssistantDraftAssociation & { title: string }

/** Explicit existing articles form the context set. Searching never reads their bodies. */
export default function StudioAssistantArticles({ value, change, open, disabled, currentDraftId }: {
  value: AssistantArticleChoice[]; change: (value: AssistantArticleChoice[]) => void
  open: boolean; disabled: boolean; currentDraftId?: string
}) {
  const [query, setQuery] = useState(''), [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const selectionKey = value.map(row => `${row.draftId}:${row.expectedVersion}`).join('|')
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      void api('drafts?projection=summary&limit=20&sample=all&q=' + encodeURIComponent(query), 'GET', undefined, abort.signal)
        .then(data => setRows(list(data.items)))
        .catch(cause => { if (!abort.signal.aborted) setError(errorText(cause)) })
        .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); abort.abort() }
  }, [open, query, currentDraftId, selectionKey])
  const choices = rows.filter(row => row.id !== currentDraftId && !value.some(chosen => chosen.draftId === row.id))
  function add(id: string) {
    const row = choices.find(choice => choice.id === id)
    if (!row || value.length >= ASSISTANT_RELATED_DRAFT_LIMIT || !Number.isSafeInteger(row.version)) return
    change([...value, { draftId: id, expectedVersion: Number(row.version), title: text(row.title, '未命名稿件') }])
  }
  return <fieldset disabled={disabled}>
    <legend><Files size={16} />关联我的稿件</legend>
    <p className="ai-source-hint">{currentDraftId ? '当前稿件已关联，可再选择其他文章一起参考。' : '选择一篇或多篇已有稿件作为本次创作依据。'}</p>
    {value.map(row => <label className="ai-check" key={row.draftId}><input type="checkbox" checked onChange={() => change(value.filter(chosen => chosen.draftId !== row.draftId))} />{row.title} · v{row.expectedVersion}</label>)}
    <label htmlFor="ai-article-search">查找我的稿件</label>
    <input id="ai-article-search" type="search" placeholder="按稿件标题搜索" value={query} onChange={event => setQuery(event.target.value)} />
    <label htmlFor="ai-article-select" className="sr-only">添加关联稿件</label>
    <select id="ai-article-select" value="" disabled={disabled || value.length >= ASSISTANT_RELATED_DRAFT_LIMIT} onChange={event => add(event.target.value)}>
      <option value="">{value.length >= ASSISTANT_RELATED_DRAFT_LIMIT ? '已达到关联上限' : '选择一篇稿件加入'}</option>
      {choices.map(row => <option key={text(row.id)} value={text(row.id)}>{text(row.title, '未命名稿件')} · v{Number(row.version)}</option>)}
    </select>
    {loading && <small role="status">正在查找稿件…</small>}
    {!loading && !error && !choices.length && <p className="ai-source-hint">没有可添加的稿件，可修改搜索条件。</p>}
    {error && <p role="alert">稿件读取失败：{error}</p>}
  </fieldset>
}
