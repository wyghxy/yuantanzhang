'use client'

import { useId } from 'react'
import type { ScriptStatement } from '@/lib/creation-validation'
import type { CreationSource } from '@/lib/creation-types'

export default function CreationScriptStatements({ title, description, value, sources, facts = false, onChange }: {
  title: string; description: string; value: ScriptStatement[]; sources: CreationSource[]; facts?: boolean; onChange: (value: ScriptStatement[]) => void
}) {
  const id = useId()
  const available = facts ? sources.filter((source) => source.status === 'verified') : sources
  function update(index: number, patch: Partial<ScriptStatement>) { onChange(value.map((item, position) => position === index ? { ...item, ...patch } : item)) }
  return <section aria-labelledby={`${id}-title`} className="rounded-xl border border-border p-4">
    <h3 id={`${id}-title`} className="font-medium">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    {!value.length && <p className="mt-3 text-sm text-muted-foreground">暂无{title}条目，按需要添加。</p>}
    <div className="mt-3 space-y-4">{value.map((item, index) => <div key={index} className="space-y-3 rounded-lg bg-[var(--ui-surface-secondary)] p-3">
      <label className="radar-field"><span>{title} {index + 1}</span><textarea required rows={3} maxLength={3000} value={item.text} onChange={(event) => update(index, { text: event.target.value })} /></label>
      <div className="flex flex-wrap gap-2">{item.sourceItemIds.map((sourceId) => {
        const source = sources.find((entry) => entry.id === sourceId)
        const invalid = !source || (facts && source.status !== 'verified')
        return <span key={sourceId} className={`inline-flex max-w-full items-center gap-2 rounded-lg border p-2 text-sm ${invalid ? 'border-[var(--ui-danger)] text-[var(--ui-danger)]' : 'border-border text-muted-foreground'}`}><span className="min-w-0 break-words">#{sourceId} {source?.title || '来源不可用'}{invalid ? ' · 须重新核实' : ''}</span><button type="button" aria-label={`移除来源 ${sourceId}`} className="min-h-11 shrink-0 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => update(index, { sourceItemIds: item.sourceItemIds.filter((entry) => entry !== sourceId) })}>移除</button></span>
      })}</div>
      <label className="radar-field"><span>{facts ? '添加已核实来源（每条至少一个）' : '添加参考来源（可选）'}</span><select value="" onChange={(event) => { if (event.target.value) update(index, { sourceItemIds: [...item.sourceItemIds, Number(event.target.value)] }) }}><option value="">选择原始来源</option>{available.filter((source) => !item.sourceItemIds.includes(source.id)).map((source) => <option key={source.id} value={source.id}>#{source.id} · {source.title}</option>)}</select></label>
      {facts && !item.sourceItemIds.length && <p className="text-sm text-[var(--ui-warning)]">请为这条事实添加至少一个已核实来源。</p>}
      <button type="button" className="min-h-11 text-sm text-[var(--ui-danger)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onChange(value.filter((_, position) => position !== index))}>删除这条{title}</button>
    </div>)}</div>
    <button type="button" disabled={value.length >= 100} className="mt-3 min-h-11 rounded-lg border border-border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40" onClick={() => onChange([...value, { text: '', sourceItemIds: [] }])}>添加{title}</button>
  </section>
}
