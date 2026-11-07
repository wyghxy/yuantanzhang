'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFresh, errorText, list, object, text, type RecordData } from '../studio-client'
import { useStudioPrivacy } from '../StudioPrivacy'
import { studioDateTime } from '../studio-operations-utils'
import { StudioDispatchRecords, type CollectionControlFeedback } from './StudioDispatchRecords'
import { StudioDispatchIcon as Icon } from './StudioDispatchIcons'

export const dispatchPlatforms = [
  ['douyin', '抖音', 'douyin'], ['bili', 'B站', 'bilibili'],
  ['xiaohongshu', '小红书', 'xiaohongshu'], ['youtube', 'YouTube', 'youtube'], ['tiktok', 'TikTok', 'tiktok'],
  ['wechat_official', '公众号', 'wechat'], ['wechat_channels', '视频号', 'channels'], ['kuaishou', '快手', 'kuaishou'],
] as const
const all = dispatchPlatforms.map(([id]) => id)
function planValue(value: RecordData) {
  const selected = Array.isArray(value.platforms) ? value.platforms.map(String) : ['all']
  return { completeCollection: value.completeCollection !== false, contentGrant:{maxAudioSeconds:Number(object(value.contentGrant).maxAudioSeconds || 3600)}, enabled: value.enabled === true, times: Array.isArray(value.times) ? value.times.map(String) : [text(value.time, '08:00')], platforms: selected.includes('all') ? [...all] : all.filter(id => selected.includes(id)) }
}
export function StudioDispatchPanel({ busy, schedule, perform, saveSchedule, collect, error, actionError = '', actionMessage = '', reload, collections, collectionsReady = true, collectionFeedback, collectionOffset, setCollectionOffset, collectionTotal, controlCollection, onTask, onNavigate, onTranscribe }: {
  busy: boolean; schedule: RecordData; perform: (fn: () => Promise<void>) => Promise<void>
  saveSchedule: (next: RecordData) => Promise<RecordData>; collect: (platform: string, platforms?: string[]) => Promise<void>
  error: string; reload: () => void; collections: RecordData[]; collectionOffset: number
  actionError?: string; actionMessage?: string
  setCollectionOffset: (n: number) => void; collectionTotal: number
  collectionsReady?: boolean
  collectionFeedback: Record<string, CollectionControlFeedback>
  controlCollection: (id: string, action: 'cancel' | 'retry' | 'content') => Promise<void>
  onTask: (id: string) => void; onNavigate: (view: string) => void; onTranscribe: (platform: string) => void
}) {
  const { masked, platformLabel } = useStudioPrivacy()
  const role = 'personal' as string
  const [plan, setPlan] = useState(() => planValue(schedule)), [baseVersion, setBaseVersion] = useState<unknown>(schedule.version)
  const initialized = baseVersion !== undefined
  const [selected, setSelected] = useState<string[]>([...all])
  const [dispatch, setDispatch] = useState<RecordData | null>(null), [loadError, setLoadError] = useState('')
  const scope = useRef<HTMLDetailsElement>(null)
  const dispatchRequest = useRef<AbortController | null>(null)
  const refreshDispatch = useCallback(() => {
    if (dispatchRequest.current) return
    const controller = new AbortController()
    dispatchRequest.current = controller
    return apiFresh('dispatch', controller.signal)
      .then(value => { if (!controller.signal.aborted) { setDispatch(value); setLoadError('') } })
      .catch(reason => { if (!controller.signal.aborted) setLoadError(errorText(reason)) })
      .finally(() => { if (dispatchRequest.current === controller) dispatchRequest.current = null })
  }, [])
  if (!initialized && schedule.version !== undefined) { setPlan(planValue(schedule)); setBaseVersion(schedule.version) }
  useEffect(() => {
    void refreshDispatch()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refreshDispatch() }, 15000)
    return () => { clearInterval(timer); dispatchRequest.current?.abort(); dispatchRequest.current = null }
  }, [refreshDispatch])
  useEffect(() => {
    const closeScope = (event: MouseEvent) => { if (scope.current && !scope.current.contains(event.target as Node)) scope.current.open = false }
    document.addEventListener('click', closeScope)
    return () => document.removeEventListener('click', closeScope)
  }, [])
  const dirty = JSON.stringify(plan) !== JSON.stringify(planValue(schedule))
  const rows = list(dispatch?.platforms), devices = list(dispatch?.devices)
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id])
  async function save() {
    if (!initialized) return
    if (scope.current) scope.current.open = false
    if (plan.enabled && rows.some(row => plan.platforms.some(platform => platform === row.platform) && row.mode === 'local')) {
      throw new Error('本地采集尚未开放，请先在采集设置中确认自动计划使用的采集方式')
    }
    const saved=await saveSchedule({...plan,expectedVersion:baseVersion})
    setBaseVersion(saved.version); setPlan(planValue(saved))
  }
  async function runSelected() {
    if (rows.some(row => selected.includes(text(row.platform)) && Number(row.accountCount) > 0 && row.mode === 'local')) {
      throw new Error('本地采集尚未开放，请先在采集设置中确认本次使用的采集方式')
    }
    await collect('all', selected.length === all.length ? undefined : selected)
  }
  return <div className={'cs-workspace' + (masked ? ' private-platforms' : '')} onKeyDown={event => {
    if (event.key === 'Escape' && scope.current?.open) { event.stopPropagation(); scope.current.open = false; scope.current.querySelector('summary')?.focus() }
  }}>
    <header className="cs-head"><div><h2>采集调度</h2><p className="cs-feedback" role={actionError ? 'alert' : 'status'} aria-live="polite">{[actionMessage, actionError].filter(Boolean).join('；') || '\u00a0'}</p></div><div className="cs-actions">
      <button className="cs-button" onClick={() => void perform(async()=>{ throw new Error('当前版本未接入此项外部处理能力。') })}><Icon name="settings" />采集设置</button>
      <button className="cs-button cs-primary" disabled={busy || !selected.length} onClick={() => void perform(runSelected)}><Icon name="play" />{busy ? '处理中…' : '立即采集'}</button>
    </div></header>
    <section className="cs-plan" aria-labelledby="cs-plan-title"><form id="cs-schedule-form" onSubmit={event => { event.preventDefault(); void perform(save) }}>
      {!initialized ? <><h3 id="cs-plan-title">自动采集计划</h3><p role="status">自动计划尚未读取，请重试后编辑。</p></> : <>
      <div className="cs-plan-controls"><div className="cs-plan-title"><span className="cs-plan-icon"><Icon name="clock" /></span><h3 id="cs-plan-title">每日自动采集</h3>
        <label className="cs-switch"><input id="cs-enabled" type="checkbox" aria-label="开启自动采集" checked={plan.enabled} onChange={event => setPlan(old => ({ ...old, enabled: event.target.checked }))} /><span /></label>
      </div><div className="cs-plan-fields">
        {plan.times.map((time, index) => <label className="cs-inline-field" key={index}><span>{index ? '时间 ' + (index + 1) : '时间'}</span><input id={index ? 'cs-time-' + index : 'cs-time'} type="time" aria-label={index ? '每日采集时间 ' + (index + 1) : '每日采集时间'} required value={time} onChange={event => setPlan(old => ({ ...old, times: old.times.map((value, position) => position === index ? event.target.value : value) }))} />{plan.times.length > 1 && <button type="button" className="cs-button cs-text" aria-label={'移除采集时间 ' + (index + 1)} onClick={() => setPlan(old => ({ ...old, times: old.times.filter((_, position) => position !== index) }))}>移除</button>}</label>)}
        {plan.times.length < 8 && <button type="button" className="cs-button cs-text" onClick={() => setPlan(old => ({ ...old, times: [...old.times, old.times.includes('00:00') ? '12:00' : '00:00'] }))}>添加时间</button>}
        <details className="cs-scope" id="cs-scope" ref={scope}><summary className="cs-button"><span id="cs-scope-label">{plan.platforms.length === all.length ? '全部 ' + all.length + ' 个平台' : plan.platforms.length + ' 个平台'}</span><Icon name="chevron" /></summary>
          <fieldset><legend>自动计划的平台</legend>{dispatchPlatforms.map(([id, name]) => <label key={id}><input type="checkbox" checked={plan.platforms.includes(id)} onChange={() => setPlan(old => ({ ...old, platforms: all.filter(value => value === id ? !old.platforms.includes(id) : old.platforms.includes(value)) }))} />{platformLabel(id, name)}</label>)}</fieldset>
        </details><span className="cs-caption">北京时间</span>
      </div><button className="cs-button" id="cs-save-plan" type="submit" disabled={busy || !initialized || !dirty || !plan.platforms.length}>保存计划</button></div>
      <div className="cs-plan-fields">
        <div className="cs-plan-title"><span>完整采集</span><label className="cs-switch"><input type="checkbox" aria-label="完整采集" checked={plan.completeCollection}
          onChange={event => setPlan(old => ({ ...old, completeCollection: event.target.checked }))} /><span /></label></div>
        {plan.completeCollection && <>
          <label className="cs-inline-field"><span>未知时长上限</span><input type="number" min={1 / 60} max={3601 / 60} step="any" required aria-label="未知视频时长上限分钟" value={(plan.contentGrant?.maxAudioSeconds ?? 3600) / 60}
            onChange={event => setPlan(old => ({ ...old, contentGrant: { ...old.contentGrant, version: 2, maxAudioSeconds: Math.round(Number(event.target.value) * 60) } }))} /><span>分钟</span></label>
        </>}
      </div>
      <p className="cs-caption">{plan.completeCollection ? '自动获取视频、逐字稿或图文正文，完成后入库。' : '只保存作品列表，看到感兴趣的作品再单独采集。'}定时和立即采集共用此设置，指标回访单独确认。</p>
      <div className="cs-plan-status"><span id="cs-next">{schedule.enabled ? '下次计划 · ' + studioDateTime(schedule.nextRunAt) : '自动采集未开启'} · 仅同步新发布，已有作品不重复采集</span><span id="cs-plan-saved">{dirty ? '有未保存的修改' : initialized ? '已保存' : ''}</span></div>
      </>}
    </form></section>
    <section className="cs-platform-section" aria-labelledby="cs-platform-title"><header className="cs-section-head"><div className="cs-heading"><h3 id="cs-platform-title">平台采集</h3><span className="cs-caption" id="cs-count">本次已选 {selected.length} / {all.length}</span></div><button className="cs-button cs-text" onClick={() => setSelected(selected.length === all.length ? [] : [...all])}>{selected.length === all.length ? '取消全选' : '全选平台'}</button></header>
      <p className="cs-caption">检查所选平台已关注博主的最新作品，已有作品自动跳过；不更改自动计划。</p>
      <div className="cs-platform-grid" id="cs-platforms">{dispatchPlatforms.map(([id, name, asset], index) => {
        const row = rows.find(value => value.platform === id), count = row ? Number(row.accountCount || 0) : null
        const ready = row?.mode === 'compute' && row.ready === true && count !== null && count > 0
        const canCollect = row?.mode === 'compute' && row.canRun === true && count !== null && count > 0
        const device = devices.find(value => value.nodeId === row?.nodeId)
        const pause = row?.collectionPause as RecordData | null | undefined
        const label = platformLabel(id, name)
        return <article key={id} data-platform={id} className={'cs-platform-card' + (selected.includes(id) ? ' is-selected' : '')}>
          <header><label className="cs-platform-pick"><span className="cs-platform-logo" aria-hidden="true"><img src={'/radar-ui/platform-' + asset + (id === 'tiktok' ? '.svg' : '-brand.svg')} alt="" width={36} height={36} draggable={false} /></span><strong>{label}</strong><input type="checkbox" aria-label={'本次选择' + label} checked={selected.includes(id)} onChange={() => toggle(id)} /></label></header>
          <button className="cs-account-count" aria-label={'查看' + label + '跟踪账号'} onClick={() => onNavigate('accounts')}><strong>{count ?? '—'}</strong><span>跟踪账号</span></button>
          <div className="cs-platform-config"><span>{row ? row.mode === 'local' ? '本地采集 · ' + text(device?.name, '我的电脑') : '算力采集' : '正在读取配置'}</span><button className="cs-icon-button" aria-label={'配置' + label + '采集方式'} onClick={() => void perform(async()=>{ throw new Error('当前版本未接入此项外部处理能力。') })}><Icon name="settings" /></button></div>
          <div className={'cs-ready' + (ready ? ' is-ready' : '')}><i />{row?.mode === 'local' ? '本地采集尚未开放' : count === 0 ? '暂无跟踪账号' : text(row?.status, '读取服务状态…')}</div>
          {pause && <p className="cs-caption">{pause.retryAt ? '自动采集可重试时间 · ' + studioDateTime(pause.retryAt) : '核实连接后可重新采集。'} <button className="cs-button cs-text" onClick={() => onTask(text(pause.taskId))}>查看原任务</button></p>}
          <footer><button className={'cs-button' + (canCollect ? ' cs-soft' : '')} disabled={busy || !row} onClick={() => count === 0 ? onNavigate('accounts') : canCollect ? void perform(() => collect(id)) : void perform(async()=>{ throw new Error('当前版本未接入此项外部处理能力。') })}>{count === 0 ? '添加账号' : canCollect ? '立即采集' : role === 'admin' ? '去配置' : '待平台接通'}</button>{index < 3 && <button className="cs-button cs-text" disabled={busy || !count} onClick={() => onTranscribe(id)}>生成转写</button>}</footer>
        </article>
      })}</div>
    </section>
    {collectionsReady ? <StudioDispatchRecords collections={collections} collectionFeedback={collectionFeedback} offset={collectionOffset} total={collectionTotal} onOffset={setCollectionOffset} busy={busy} onControl={(id, action) => void perform(() => controlCollection(id, action))} onTask={onTask} onNavigate={onNavigate} feedback={error || loadError} onRefresh={() => { reload(); void refreshDispatch() }} /> : <section className="cs-results" aria-label="最近采集"><header className="cs-panel-head"><h3>最近采集</h3></header><div className="cs-results-body"><p role={error ? 'alert' : 'status'}>{error || '正在读取采集记录…'}</p><button className="cs-button" disabled={busy} onClick={reload}>重试</button></div></section>}
  </div>
}
