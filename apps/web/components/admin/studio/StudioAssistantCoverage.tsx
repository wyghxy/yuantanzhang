'use client'
import { object, text } from './studio-client'
import { useStudioPrivacy } from './StudioPrivacy'

const labels: Record<string, string> = { draft: '稿件', material: '参考作品', reference: '采纳素材', selection: '选段', analysis: '爆款拆解', profile: '创作档案', conversation: '历史对话' }

export default function StudioAssistantCoverage({ value }: { value: unknown }) {
  const { materialTitle } = useStudioPrivacy()
  const coverage = object(value)
  if (coverage.version !== 1 || !Array.isArray(coverage.items)) return null
  return <details className="ai-history" aria-label="实际使用的创作依据">
    <summary>本次实际使用 {coverage.items.length} 项依据 · {Number(coverage.serializedCharacters).toLocaleString()} 字符</summary>
    <ul>{coverage.items.map((raw, index) => {
      const row = object(raw)
      return <li key={index}>{labels[text(row.kind)] || '依据'}：{['material', 'reference', 'analysis'].includes(text(row.kind)) ? materialTitle(row.title, '未命名') : text(row.title, '未命名')}{Number.isSafeInteger(row.version) ? ' · v' + row.version : ''}
        {' · ' + (row.scope === 'excerpt' ? '选取片段' : '完整内容') + ' · ' + Number(row.characters).toLocaleString() + ' 字符'}
        {typeof row.primaryId === 'string' && row.primaryId !== row.id && <small>（原文 v{Number(row.primaryVersion)}）</small>}
      </li>
    })}</ul>
    {!!Number(coverage.omittedConversationRounds) && <p className="ai-source-hint">只使用最近 5 轮对话；另有 {Number(coverage.omittedConversationRounds)} 轮较早对话未送入本次模型。</p>}
    {coverage.legacyConversationCoverage === true && <p className="ai-source-hint">包含旧版对话。旧版未记录完整覆盖清单，无法确认更早的省略范围。</p>}
  </details>
}
