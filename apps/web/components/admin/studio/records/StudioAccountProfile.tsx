'use client'
import { ChevronDown } from 'lucide-react'
import { StudioCreatorAvatar, useStudioPrivacy } from '../StudioPrivacy'
import { Platform } from '../StudioUI'
import { accountTrackingLabel } from '../StudioMaterialHelpers'
import { studioAccountState } from '../studio-account-state'
import { api, dateLabel, isSample, platforms, text, type RecordItem } from '../studio-client'
import { studioDateTime, studioSafeUrl } from '../studio-operations-utils'

export function accountFollowers(row: RecordItem) {
  const value = row.followers ?? row.followerCount ?? row.follower_count
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function accountNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : '暂无数据'
}

export function accountDirection(row: RecordItem) {
  return text(row.direction || row.crossPlatformIdentity || row.cross_platform_identity, '待补充内容方向')
}

export function StudioAccountProfile({ account, expanded, busy, toggle, perform, onUpdated, onDelete, onRefresh, onReview, onRecapture, refreshing }: {
  account: RecordItem | null; expanded: boolean; busy: boolean
  toggle: (row: RecordItem) => void
  perform: (fn: () => Promise<void>) => Promise<void>
  onUpdated: (row: RecordItem) => void
  onDelete: (row: RecordItem) => void
  onRefresh: (row: RecordItem) => void
  onReview: (row: RecordItem) => void
  onRecapture: (row: RecordItem) => void
  refreshing: boolean
}) {
  const { creatorName, masked } = useStudioPrivacy()
  if (!account) return <aside id="creatorPanel" className="library-context-panel" aria-label="账号资料">
    <div className="creator-profile-empty"><span>账号资料</span><p>选择一个账号，查看资料与采集记录</p></div>
  </aside>
  const followers = accountFollowers(account)
  const homepage = studioSafeUrl(account.url)
  const tags = Array.isArray(account.tags) ? account.tags.filter((tag): tag is string => typeof tag === 'string') : []
  const handle = text(account.platformHandle || account.platform_handle)
  const bio = text(account.bio || account.profile_bio)
  const notes = text(account.notes)
  const collection = studioAccountState(account)
  const enabled = account.enabled !== false
  const setEnabled = (next: boolean) => { if (next !== enabled) void perform(async () => {
    const result = await api(`accounts/${account.id}`, 'PATCH', { expectedVersion: account.version, enabled: next })
    onUpdated(result.item as RecordItem)
  }) }
  return <aside id="creatorPanel" className="library-context-panel" aria-label="账号资料">
    <div className="creator-profile-head">
      <div className="creator-profile-kicker"><span>账号资料</span>{isSample(account) && <span className="creator-demo-tag">试用样例</span>}</div>
      <div className="ctx-creator-head">
        <div className="creator-avatar-wrap" data-platform={platforms[text(account.platform)]}><StudioCreatorAvatar name={account.name} url={account.avatarUrl || account.avatar_url} /></div>
        <div><h3 className="ctx-title">{creatorName(account.name, '待识别账号')}</h3><p className="creator-handle">{masked ? '账号资料已隐藏' : handle || accountDirection(account)}</p></div>
      </div>
      <div className="ctx-facts"><Platform value={account.platform} /></div>
      <div className="ctx-facts ctx-facts-status"><span className="ctx-fact-label">情报状态</span><span className={`status-tag ${enabled ? 'green' : 'gray'}`}>{accountTrackingLabel(account)}</span></div>
    </div>
    <div className="creator-profile-scroll" tabIndex={0} aria-label="账号指标与采集记录">
      <dl className="creator-metrics">
        {followers !== null && <div><dt>粉丝</dt><dd>{accountNumber(followers)}</dd></div>}
        <div><dt>已收录作品</dt><dd>{accountNumber(account.materialCount)}</dd></div>
      </dl>
      {followers !== null && <p className="creator-metrics-time">粉丝数据更新 · {account.metricsUpdatedAt ? dateLabel(account.metricsUpdatedAt) : '暂无记录'}</p>}
      {!isSample(account) && <button type="button" className="btn ghost"
        disabled={busy || refreshing || collection.active}
        title={collection.captureHint || '只刷新账号资料与粉丝数，不抓取作品或转写'}
        onClick={() => collection.recaptureTaskId ? onRecapture(account) : collection.captureBlocked ? onReview(account) : onRefresh(account)}>
        {refreshing || collection.active && collection.task.kind === 'resolve_creator' ? '正在刷新资料…'
          : collection.recaptureTaskId ? '重新采集' : collection.captureBlocked ? collection.captureTaskId ? '核实原请求' : '查看采集问题' : '刷新资料'}
      </button>}
      {collection.recaptureTaskId && <button type="button" className="btn ghost" disabled={busy} onClick={() => onReview(account)}>核实原请求</button>}
      <section className="creator-profile-section"><h4>账号介绍与备注</h4>
        <div className="creator-profile-tags">{(masked ? ['资料已隐藏'] : tags.length ? tags : [accountDirection(account)]).map(tag => <span key={tag}>{tag}</span>)}</div>
        <p className="creator-bio">{masked ? '资料已隐藏' : bio || notes || '暂无备注'}</p>
        {!masked && bio && notes && bio !== notes && <p className="creator-bio">{notes}</p>}
      </section>
      <section className="creator-profile-section"><h4>采集记录</h4>
        <p className="creator-bio" role="status">{collection.label}</p>
        {collection.message && <p className="creator-bio">{collection.message}</p>}
        <dl className="creator-collection-facts">
          {account.platform === 'wechat_official' && <div><dt>更新来源</dt><dd>{text(account.feedUrl) ? '订阅源已填写' : '待配置订阅源或采集服务'}</dd></div>}
          <div><dt>最近自动检查</dt><dd>{account.lastWatchPageAt || account.lastWatchedAt ? studioDateTime(account.lastWatchPageAt || account.lastWatchedAt) : '暂无记录'}</dd></div>
          {Boolean(account.lastWatchPageAt || account.lastWatchedAt) && <div><dt>自动检查结果</dt><dd>{account.watchCollectionComplete === true ? '本次范围检查完成' : '范围尚未完成'}</dd></div>}
          <div><dt>最近手动采集</dt><dd>{account.lastCollectionPageAt || account.lastCollectedAt ? studioDateTime(account.lastCollectionPageAt || account.lastCollectedAt) : '暂无记录'}</dd></div>
          <div><dt>作品列表</dt><dd><button onClick={() => toggle(account)} aria-controls="creatorCollection" aria-expanded={expanded}>查看已收录 <ChevronDown size={14} /></button></dd></div>
        </dl>
        {account.watchCollectionComplete === false && account.watchCollectionNotice ? <p className="creator-bio">{text(account.watchCollectionNotice)}</p> : null}
      </section>
    </div>
    <div className="creator-profile-actions">
      <button className={`btn ghost creator-profile-on${enabled ? ' is-on' : ''}`} aria-pressed={enabled} disabled={busy || enabled} onClick={() => setEnabled(true)}>开启</button>
      <button className={`btn ghost creator-profile-off${enabled ? '' : ' is-on'}`} aria-pressed={!enabled} disabled={busy || !enabled} onClick={() => setEnabled(false)}>关闭</button>
      <button className="btn ghost creator-delete" disabled={busy} onClick={() => onDelete(account)}>删除</button>
      {!masked && homepage && <a className="btn creator-homepage" href={homepage} target="_blank" rel="noreferrer">{account.platform === 'wechat_official' ? '来源文章' : '账号主页'} ↗</a>}
    </div>
  </aside>
}
