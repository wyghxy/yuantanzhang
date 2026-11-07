'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Plus, SlidersHorizontal } from 'lucide-react'
import { studioReferenceIds } from '@ytz/contracts/studio-radar'
import { api, apiFresh, errorText, list, object, text, type RecordData, type RecordItem } from './studio-client'
import { RadarMaterial } from './StudioRadarMaterial'
import { Field, Modal } from './StudioUI'
import StudioRadarInbox from './StudioRadarInbox'
import s from './StudioDashboard.module.css'

const PAGE_SIZE = 10

export default function StudioRadarContent({ dashboard, preferences, onPreferences, onRefresh, onNavigate, onMaterial, onTopic }: {
  dashboard: RecordData; preferences: RecordData | null; onPreferences: (value: RecordData) => void
  onRefresh: () => void; onNavigate: (view: string) => void
  onMaterial?: (id: string) => void; onTopic?: (id: string) => void
}) {
  const [category, setCategory] = useState('recommended')
  const [settings, setSettings] = useState(false), [interestText, setInterestText] = useState('')
  const [version, setVersion] = useState<unknown>(0)
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const [reason, setReason] = useState<RecordItem | null>(null)
  // 推荐按分类分页读取，滚动到底继续取，不再由 dashboard 一次性给出死数组。
  const [rows, setRows] = useState<RecordItem[]>([]), [loading, setLoading] = useState(true)
  // 失败后允许就地重试，不必整页刷新。
  const [attempt, setAttempt] = useState(0)
  const [hasMore, setHasMore] = useState(false), [moreBusy, setMoreBusy] = useState(false)
  const loaded = useRef(0), listNode = useRef<HTMLDivElement | null>(null), sentinel = useRef<HTMLDivElement | null>(null)
  const topics = list(dashboard.recentTopics)
  const openMaterial = (id: string) => onMaterial ? onMaterial(id) : onNavigate('feed')
  const openSettings = () => { setInterestText(Array.isArray(preferences?.interests) ? preferences.interests.join('\n') : ''); setVersion(preferences?.version); setError(''); setSettings(true) }
  const save = async () => {
    if (saving) return
    setSaving(true); setError('')
    try {
      const value = await api('preferences', 'PATCH', { expectedVersion: version, interests: interestText.split(/[\n,，]/).map(value => value.trim()).filter(Boolean) })
      onPreferences(value); setSettings(false); onRefresh(); retryRecommendations()
    } catch (cause) { setError(errorText(cause)) } finally { setSaving(false) }
  }
  const topicState = (status: string) => status === 'writing' ? '创作中' : status === 'organizing' ? '整理中' : '待创作'
  const topicAction = (status: string) => status === 'organizing' ? '继续整理' : status === 'writing' ? '继续写作' : '开始写作'
  const resetRecommendations = () => {
    setLoading(true); setError(''); setRows([]); setHasMore(false); setMoreBusy(false)
    loaded.current = 0
  }
  const selectCategory = (key: string) => {
    if (key === category) return
    resetRecommendations(); setCategory(key)
  }
  const retryRecommendations = () => { resetRecommendations(); setAttempt(value => value + 1) }

  const fetchPage = useCallback((offset: number, append: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams({ category, limit: String(PAGE_SIZE), offset: String(offset) })
    return apiFresh('recommendations?' + params, signal).then(value => {
      signal?.throwIfAborted()
      const page = list(value.items)
      setRows(current => append ? [...current, ...page] : page)
      if (append) setMoreBusy(false)
      setHasMore(value.hasMore === true)
      loaded.current = offset + page.length
    })
  }, [category])

  // loading 的初始值就是 true，覆盖首次挂载；切分类与重试是用户事件，
  // 在各自的点击处理里置位，effect 里就不再同步 setState（会触发级联渲染）。
  useEffect(() => {
    const controller = new AbortController()
    void fetchPage(0, false, controller.signal)
      .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [fetchPage, attempt])

  // 触底续拉：提前 120px 取下一页，滚动时不会看到空档。
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore || loading) return
    const controller = new AbortController()
    let busy = false, active = true
    const observer = new IntersectionObserver(entries => {
      if (!active || busy || !entries.some(entry => entry.isIntersecting)) return
      busy = true
      setMoreBusy(true)
      void fetchPage(loaded.current, true, controller.signal)
        .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
        .finally(() => { busy = false; if (active) setMoreBusy(false) })
    }, { root: listNode.current, rootMargin: '120px' })
    observer.observe(node)
    return () => { active = false; controller.abort(); observer.disconnect() }
  }, [hasMore, fetchPage, loading])

  return <div className={`dino-grid ${s.fullInbox}`}>
    <section className="panel hot-directions" aria-labelledby="hot-title">
      <header className="panel-heading"><div><h2 id="hot-title">爆款方向</h2><p>从高赞内容与关注领域中，寻找创作切入点</p></div><button className="text-link" id="interest-settings" onClick={openSettings} disabled={!preferences}>关注方向<SlidersHorizontal className="icon" /></button></header>
      <div className="hot-filters" role="group" aria-label="内容推荐分类">{[['recommended', '为你推荐'], ['highLikes', '高赞作品'], ['practical', '实操内容'], ['following', '长期关注']].map(([key, label]) => <button className={category === key ? 'selected' : ''} key={key} aria-pressed={category === key} onClick={() => selectCategory(key)}>{label}</button>)}</div>
      <div id="hot-list" ref={listNode} className="panel-scroll-body" role="region" aria-label="爆款方向" tabIndex={0} aria-busy={loading}>{rows.length ? rows.map(item => <RadarMaterial variant="hot" key={item.id} item={item} onOpen={() => setReason(item)} />) : error ? <div className={s.inlineError} role="alert">{error}<button onClick={retryRecommendations}>重试</button></div> : <p className={s.empty}>{loading ? '正在读取内容…' : category === 'following' ? '添加关注方向后，这里会展示标题或简介匹配的内容。' : category === 'highLikes' ? '还没有带点赞记录的未读作品。' : category === 'practical' ? '还没有标记为教程或实操的未读内容。' : '收录作品后，从这里发现创作方向。'}</p>}
        <div ref={sentinel} className="load-more-sentinel" aria-hidden="true" />
        {moreBusy && <p className={s.muted}>正在载入更多…</p>}
      </div>
      <div className="recommendation-note"><span className="recommendation-dot" />点击内容，查看推荐依据</div>
    </section>
    <section className="panel topics" aria-labelledby="topics-title">
      <header className="panel-heading"><div><h2 id="topics-title">继续创作</h2><p>把未完成的想法，接着写下去</p></div><button className="icon-button" id="add-topic" aria-label="新建选题" onClick={() => onNavigate('topics')}><Plus className="icon" /></button></header>
      <div id="topic-list" className="panel-scroll-body" role="region" aria-label="继续创作" tabIndex={0}>{topics.length ? topics.map((topic, index) => <button className="topic-row" key={topic.id} onClick={() => onTopic ? onTopic(topic.id) : onNavigate('topics')}><span className="topic-number">{String(index + 1).padStart(2, '0')}</span><span className="topic-detail"><span className="topic-title">{text(topic.title, '未命名选题')}</span><span className="topic-meta"><span className="topic-status">{topicState(text(topic.status))}</span><span>{studioReferenceIds(topic).length} 条参考素材</span></span><span className="topic-next">{topicAction(text(topic.status))} <ArrowRight className="icon" /></span></span></button>) : <p className={s.empty}>记下一个灵感，或从采集内容中创建选题。</p>}</div>
      <button className="text-link topic-more" onClick={() => onNavigate('topics')}>进入创作中心<ArrowRight className="icon" /></button>
    </section>
    <StudioRadarInbox revision={text(dashboard.updatedAt)} unread={Number(object(dashboard.counts).unread || 0)} onMaterial={openMaterial} onRefresh={onRefresh} onNavigate={onNavigate} />
    {settings && <Modal title="关注方向" close={() => setSettings(false)} closeDisabled={saving}><div className={s.form}><Field label="你想持续关注哪些话题？"><textarea autoFocus rows={6} value={interestText} onChange={event => setInterestText(event.target.value)} placeholder="每行一个方向，例如：AI 工作流" /></Field><p className={s.muted}>最多 12 个方向，每个不超过 40 字；用于匹配已收录作品的标题与简介。</p>{error && <p role="alert">{error}</p>}<div className={s.formActions}>{error && <button className="btn ghost" disabled={saving} onClick={() => void api('preferences').then(value => { setVersion(value.version); onPreferences(value); setError('已读取最新版本；当前编辑内容已保留，请核对后保存。') }).catch(cause => setError(errorText(cause)))}>读取最新版本</button>}<button className="btn primary" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存方向'}</button></div></div></Modal>}
    {reason && <Modal title="推荐依据" close={() => setReason(null)}><div className={s.form}><h3>{text(reason.title)}</h3><p>{text(reason.recommendationReason)}</p><p className={s.muted}>来自当前采集仓库中已保存的内容和指标。</p><button className="btn primary" onClick={() => openMaterial(reason.id)}>查看作品</button></div></Modal>}
  </div>
}
