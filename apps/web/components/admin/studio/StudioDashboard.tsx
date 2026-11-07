'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Activity, ArrowUpRight, AudioLines, BookOpen, Cpu, FileText, Info, NotebookPen, RefreshCw, UsersRound } from 'lucide-react'
import { api, errorText, object, type RecordData } from './studio-client'
import { studioCount, studioKnownNumber, studioPlatforms } from './studio-operations-utils'
import { StudioPlatformIcon, StudioPrivacyToggle, useStudioPrivacy } from './StudioPrivacy'
import { Modal } from './StudioUI'
import StudioRadarIntro from './StudioRadarIntro'
import StudioRadarSignals from './StudioRadarSignals'
import StudioRadarContent from './StudioRadarContent'
import s from './StudioDashboard.module.css'

export default function StudioDashboard({ dashboard, onNavigate, onMaterial, onTopic, onPlatform, onRefresh, actions }: {
  dashboard: RecordData
  onNavigate: (view: string) => void
  onMaterial?: (id: string) => void
  onTopic?: (id: string) => void
  onPlatform?: (platform: string) => void
  onRefresh: () => void
  actions?: ReactNode
}) {
  const { platformLabel } = useStudioPrivacy()
  const [period, setPeriod] = useState<1 | 3 | 7>(7)
  const [preferences, setPreferences] = useState<RecordData | null>(null)
  const [preferenceError, setPreferenceError] = useState('')
  const [info, setInfo] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void api('preferences', 'GET', undefined, controller.signal).then(setPreferences).catch(cause => {
      if (!controller.signal.aborted) setPreferenceError(errorText(cause))
    })
    return () => controller.abort()
  }, [])
  const counts = object(dashboard.counts), compute = object(dashboard.compute)
  const materials = studioKnownNumber(counts.materials), ready = studioKnownNumber(counts.ready)
  const percentage = materials !== null && ready !== null ? materials ? Math.round(ready / materials * 100) : 0 : null
  const selected = object(object(dashboard.ranges)[period]), distribution = object(selected.platforms)
  const platformValues = studioPlatforms.map(platform => studioKnownNumber(distribution[platform.key]))
  const max = Math.max(1, ...platformValues.map(value => value || 0))
  const attention = studioKnownNumber(dashboard.workQueueCount)
  const openPlatform = (platform: string) => onPlatform ? onPlatform(platform) : onNavigate('works')
  const stats = [
    { icon: UsersRound, value: counts.accounts, label: '对标博主', note: '持续关注，发现好内容', target: 'accounts', tone: 'teal' },
    { icon: BookOpen, value: counts.unread, label: '未读作品', note: '从还没读过的内容开始', target: 'unread', tone: 'blue' },
    { icon: NotebookPen, value: counts.continuing, label: '继续创作', note: '整理选题，接着写下去', target: 'topics', tone: 'purple' },
    { icon: Activity, value: attention, label: '未完成采集', note: attention === null ? '正在读取工作队列' : '处理中、排队及需恢复的采集任务', target: 'pending', tone: 'amber' },
  ]
  return <>
    <div className="workspace-stage">
      <StudioRadarIntro preferences={preferences} onPreferences={setPreferences} compactContext />
      {preferenceError && <div className={s.inlineError} role="alert">{preferenceError}<button onClick={() => void api('preferences').then(value => { setPreferences(value); setPreferenceError('') }).catch(cause => setPreferenceError(errorText(cause)))}>重试读取语录</button></div>}
      <section className="dino-hero workspace-overview" aria-label="素材资产和来源分布">
        <StudioRadarSignals platforms={dashboard.platforms ? object(dashboard.platforms) : null} onPlatform={openPlatform} />
        <section className="dino-hero-body" aria-labelledby="radar-assets-title">
          <div className="hero-topline"><h2 id="radar-assets-title">素材资产总览</h2><button className="icon-button refresh" onClick={onRefresh} aria-label="刷新看板"><RefreshCw className="icon" /></button><StudioPrivacyToggle compact /><button className="dashboard-scope-help" onClick={() => setInfo(true)} aria-label="数据统计说明"><Info className="icon" /></button></div>
          <button className="asset-total" onClick={() => onNavigate('works')}><strong>{studioCount(materials)}</strong><span>累计入库作品</span><ArrowUpRight className="icon" aria-hidden="true" /></button>
          <div className="hero-progress"><div><span>正文就绪率</span><strong>{percentage === null ? '—' : percentage + '%'}</strong></div>
          <div className="hero-progress-track" role="meter" aria-label="正文就绪率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined}><i style={{ width: (percentage || 0) + '%' }} /></div></div>
          <div className="compute-band">
            {[{ icon: AudioLines, value: compute.durationSeconds, divisor: 3600, label: 'ASR 识别', unit: '小时', tone: 'teal' },
              { icon: FileText, value: compute.words, divisor: 10000, label: '正文', unit: '万字', tone: 'amber' },
              { icon: Cpu, value: compute.tokens, divisor: 10000, label: 'Token 用量', unit: '万', tone: 'purple' }].map(({ icon: Icon, value, divisor, label, unit, tone }) => {
              const number = studioKnownNumber(value)
              return <div className={'compute-metric metric-' + ({teal: 'asr', amber: 'text', purple: 'token'}[tone])} key={label}><span className="metric-glyph"><Icon className="icon" aria-hidden="true" /></span><strong>{number === null ? '—' : (number / divisor).toFixed(1)}</strong><span className="metric-label">{label}<span className="metric-unit">{unit}</span></span></div>
            })}
          </div>
        </section>
        <section className="trend platform-collection" aria-labelledby="radar-sources-title">
            <div className="section-top"><h2 id="radar-sources-title">数据来源分布</h2><div className="segment" role="group" aria-label="采集时间范围">{([1, 3, 7] as const).map(value => <button className={period === value ? 'selected' : ''} key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 1 ? '今日' : value + '天'}</button>)}</div></div>
            <div className="trend-summary" aria-live="polite"><strong>{studioCount(selected.total)}</strong><span>{period === 1 ? '今日' : '近 ' + period + ' 日'}采集 · 条</span></div>
          <div className="collection-rows">{studioPlatforms.map((platform, index) => <button className="collection-row" key={platform.key} onClick={() => openPlatform(platform.key)}>
            <span className="source-name"><StudioPlatformIcon className={'platform-mark ' + platform.icon}>{platform.symbol}</StudioPlatformIcon>{platformLabel(platform.key, platform.label)}</span>
            <span className="collection-track" aria-hidden="true"><i style={{ width: (platformValues[index] || 0) / max * 100 + '%' }} /></span><span className="collection-count">{studioCount(platformValues[index])}</span>
          </button>)}</div>
        </section>
      </section>
    </div>
    <div className="dino-stats">{stats.map(({ icon: Icon, value, label, note, target, tone }) => <button className="stat-card" key={label} data-dash={target === 'accounts' ? 'creators' : target === 'tasks' ? 'pending' : target} onClick={() => onNavigate(target)}><span className={'stat-icon ' + tone}><Icon className="icon" /></span><span className="stat-content"><strong>{studioCount(value)}</strong><span>{label}</span></span><span className="stat-arrow"><ArrowUpRight className="icon" aria-hidden="true" /></span><span className="stat-note">{note}</span></button>)}</div>
    <StudioRadarContent dashboard={dashboard} preferences={preferences} onPreferences={setPreferences} onRefresh={onRefresh} onNavigate={onNavigate} onMaterial={onMaterial} onTopic={onTopic} />
    {info && <Modal title="数据与工作台" close={() => setInfo(false)}><div className={s.form}>
      <p>统计当前工作空间已保存的记录，已排除样例和重复记录。时间范围按北京时间的自然日计算。</p>
      {Number(selected.other) > 0 && <p>{period === 1 ? '今日' : '近 ' + period + ' 日'}采集总量中另含 {studioCount(selected.other)} 条本地或其他来源，不列入以上来源平台的分布条形图。</p>}
      <p>ASR 时长只累计有转写来源和时长记录的作品；正文按非空白字符统计；Token 来自已保存的模型用量回执。没有观测值时显示「—」。</p>
      <p>未完成采集与工作队列一致，不含指标回访或已交付作品的历史运行记录。历史核对可在任务筛选的“待处理与历史核对”查看。</p>
      {!!Number(object(dashboard.usage).missing) && <p>有 {studioCount(object(dashboard.usage).missing)} 次模型任务没有用量回执，未计入 Token 总量。</p>}
      <div>{actions}</div>
    </div></Modal>}
  </>
}
