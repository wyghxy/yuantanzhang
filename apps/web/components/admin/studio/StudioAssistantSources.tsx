'use client'
import { useEffect, useState } from 'react'
import { ChevronDown, FileText, UserRound } from 'lucide-react'
import { api, errorText, list, object, platforms, text, type RecordData } from './studio-client'
import StudioAssistantArticles, { type AssistantArticleChoice } from './StudioAssistantArticles'
import { useStudioPrivacy } from './StudioPrivacy'

export type AssistantSources = {
  sourceMaterialId: string; sourceTitle: string; useStructure: boolean; useReferences: boolean
  sourceVersion?: number; sourceAnalysisFingerprint?: string
  useProfile: boolean; creatorProfileId: string; socialAccountId: string
  relatedDrafts: AssistantArticleChoice[]
}

export default function StudioAssistantSources({ value, change, open, disabled, draft, expanded, onExpanded, currentDraftId }: {
  value: AssistantSources; change: (value: AssistantSources) => void; open: boolean; disabled: boolean; draft: boolean
  expanded: boolean; onExpanded: (value: boolean) => void; currentDraftId?: string
}) {
  const { materialTitle } = useStudioPrivacy()
  const [profiles, setProfiles] = useState<RecordData[]>([]), [accounts, setAccounts] = useState<RecordData[]>([])
  const [profile, setProfile] = useState<RecordData>({}), [sources, setSources] = useState<RecordData[]>([])
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open || !expanded || !value.useProfile) return
    const abort = new AbortController()
    void api('profile?projection=assistant', 'GET', undefined, abort.signal)
      .then(data => { setProfiles(list(data.profiles)); setProfile(object(data.profile)) })
      .catch(cause => { if (!abort.signal.aborted) setError(errorText(cause)) })
    return () => abort.abort()
  }, [open, expanded, value.useProfile])
  useEffect(() => {
    if (!open || !expanded || !value.useProfile || !value.creatorProfileId) return
    const abort = new AbortController()
    void api('profile?projection=assistant&creatorProfileId=' + encodeURIComponent(value.creatorProfileId), 'GET', undefined, abort.signal)
      .then(data => setAccounts(list(data.accounts)))
      .catch(cause => { if (!abort.signal.aborted) setError(errorText(cause)) })
    return () => abort.abort()
  }, [open, expanded, value.useProfile, value.creatorProfileId])
  useEffect(() => {
    if (!open || !expanded) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      void api('materials?projection=summary&limit=20&sample=all&q=' + encodeURIComponent(query), 'GET', undefined, abort.signal)
        .then(data => { setSources(list(data.items)) })
        .catch(cause => { if (!abort.signal.aborted) setError(errorText(cause)) })
        .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); abort.abort() }
  }, [open, expanded, query])
  const patch = (next: Partial<AssistantSources>) => change({ ...value, ...next })
  const selectedProfile = profiles.find(row => text(row.id) === value.creatorProfileId)
  const selectedAccount = accounts.find(row => text(row.id) === value.socialAccountId)
  const sourceTitle = value.sourceMaterialId ? materialTitle(value.sourceTitle, '参考作品') : '未选参考'
  const sourceMode = [value.useStructure ? '借鉴结构' : '', value.useProfile
    ? text(selectedAccount?.nickname) || text(selectedProfile?.name) || '我的档案' : ''].filter(Boolean).join(' · ') || '普通写作'
  return <details className="ai-sources" open={expanded} onToggle={event => onExpanded(event.currentTarget.open)}>
    <summary><span>参考资料</span><span className="ai-source-summary" title={sourceTitle + ' · ' + sourceMode}>{value.relatedDrafts.length ? value.relatedDrafts.length + ' 篇稿件 · ' : ''}{sourceTitle} · {sourceMode}</span><ChevronDown size={16} /></summary>
    <StudioAssistantArticles value={value.relatedDrafts} change={relatedDrafts => patch({ relatedDrafts })} open={open && expanded} disabled={disabled} currentDraftId={currentDraftId} />
    <fieldset disabled={disabled}>
      <legend><FileText size={16} />参考作品</legend>
      <label htmlFor="ai-source-search">找一篇已保存的作品</label>
      <input id="ai-source-search" type="search" placeholder="搜索标题" value={query} onChange={e => setQuery(e.target.value)} />
      <label htmlFor="ai-source-select" className="sr-only">选择参考作品</label>
      <select id="ai-source-select" value={value.sourceMaterialId} onChange={e => {
        const selected = sources.find(row => row.id === e.target.value)
        patch({ sourceMaterialId: e.target.value, sourceTitle: text(selected?.title), sourceVersion: typeof selected?.version === 'number' ? selected.version : undefined,
          sourceAnalysisFingerprint: undefined })
      }}>
        <option value="">不参考作品</option>
        {value.sourceMaterialId && !sources.some(row => row.id === value.sourceMaterialId) && <option value={value.sourceMaterialId}>{value.sourceTitle || '当前参考作品'}</option>}
        {sources.map(row => <option key={text(row.id)} value={text(row.id)}>{materialTitle(row.title)}</option>)}
      </select>
      {loading && <small role="status">正在查找作品…</small>}
      <label className="ai-check"><input type="checkbox" checked={value.useStructure} onChange={e => patch({ useStructure: e.target.checked })} />借鉴这篇的写作结构</label>
      {draft && <label className="ai-check"><input type="checkbox" checked={value.useReferences} onChange={e => patch({ useReferences: e.target.checked })} />使用稿件的参考素材</label>}
    </fieldset>
    <fieldset disabled={disabled}>
      <legend><UserRound size={16} />我的账号</legend>
      <label className="ai-check"><input type="checkbox" checked={value.useProfile} onChange={e => patch({ useProfile: e.target.checked, ...(!e.target.checked ? { creatorProfileId: '', socialAccountId: '' } : {}) })} />按我的账号风格写</label>
      {value.useProfile && <>
        <label htmlFor="ai-profile">创作者</label><select id="ai-profile" value={value.creatorProfileId} onChange={e => { setAccounts([]); patch({ creatorProfileId: e.target.value, socialAccountId: '' }) }}>
          <option value="">通用创作档案</option>{profiles.map(row => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}
        </select>
        {value.creatorProfileId && <><label htmlFor="ai-account">发布账号</label><select id="ai-account" value={value.socialAccountId} onChange={e => patch({ socialAccountId: e.target.value })}>
          <option value="">按创作者定位，不限账号</option>{accounts.map(row => <option key={text(row.id)} value={text(row.id)}>{platforms[text(row.platform)] || text(row.platform)} · {text(row.nickname)}</option>)}
        </select></>}
        <p className="ai-source-hint">{text(selectedProfile?.bio) || (Number(profile.version) > 0 ? text(profile.positioning) : '') || '尚未填写定位。可在设置与运行中补充创作档案。'}{Number(profile.version) > 0 && text(profile.audience) ? ' · 受众：' + text(profile.audience) : ''}</p>
      </>}
    </fieldset>
    {error && <p role="alert">参考资料读取失败：{error}</p>}
  </details>
}
