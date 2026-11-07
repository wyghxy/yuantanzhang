'use client'
import { useStudioPrivacy } from './StudioPrivacy'

import { useEffect, useRef, useState } from 'react'

import { Search, RefreshCw } from 'lucide-react'

import {
  api,
  object,
  text,
  list,
  errorText,
  dateLabel,
  isSample,
  statusNames,
  type RecordData,
  type RecordItem,
} from './studio-client'

import { Busy, Details, Empty, Modal, Platform } from './StudioUI'

import s from './StudioWorkbench.module.css'

import { useStudioResource, useStudioSearch } from './StudioQueryProvider'
import { platformOptions, titles } from './records/records-client'

import { StudioAccountsView } from './records/StudioAccountsView'
import { StudioTopicsView } from './records/StudioTopicsView'

import { StudioWorksView } from './records/StudioWorksView'

import { StudioRecordEditor } from './records/StudioRecordEditor'
import { studioAccountState } from './studio-account-state'
import { CAPTURE_LIMIT_OPTIONS } from './studio-capture-limit'
import { useStudioAccountCapture } from './useStudioAccountCapture'

export default function StudioRecords({
  kind,
  revision,
  onChanged,
  onMaterial,
  onAccountMaterials,
  onDraft,
  onTask,
  notify,
  onImport,
  initialSelectedId,
}: {
  initialSelectedId?: string
  kind: string
  revision: number
  onChanged: () => void
  onMaterial: (id: string, tab?: string) => void
  onAccountMaterials: (id: string, materialId?: string) => void
  onDraft: (id: string) => void
  onTask: (id: string) => void
  notify: (value: string) => void
  onImport: () => void
}) {
  const { creatorName, platformLabel, materialTitle } = useStudioPrivacy()
  const [offset, setOffset] = useState(0),
    [query, setQuery] = useState(''),
    [platform, setPlatform] = useState('all'),
    [status, setStatus] = useState('all'),
    [sample, setSample] = useState('all'),
    [busy, setBusy] = useState(false),
    [actionError, setError] = useState('')
  const [edit, setEdit] = useState<RecordItem | null>(null),
    [form, setForm] = useState<RecordData>({}),
    [details, setDetails] = useState<{ title: string; value: RecordData; creatorName?: string } | null>(null)
  const [selection, setSelected] = useState<RecordItem | null>(null),
    [accountId, setAccountId] = useState('all'),
    [range, setRange] = useState('all'),
    [expandedAccountId, setExpandedAccountId] = useState(''),
    [locatedId, setLocatedId] = useState(initialSelectedId || '')
  const capture = useStudioAccountCapture(onChanged, notify, setError)
  useEffect(() => {
    if (!initialSelectedId) return
    const controller = new AbortController()
    const path = kind === 'accounts' ? `accounts?projection=summary&sample=all&ids=${encodeURIComponent(initialSelectedId)}` : `${kind}/${encodeURIComponent(initialSelectedId)}`
    void api(path, 'GET', undefined, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) {
          setQuery('')
          setPlatform('all')
          setStatus('all')
          setSample('all')
          setOffset(0)
          setLocatedId(initialSelectedId)
          setSelected(kind === 'accounts' ? list(d.items)[0] || null : d.item as RecordItem)
          if (kind === 'accounts') setExpandedAccountId(initialSelectedId)
          if (kind === 'drafts')
            setDetails({ title: '已定位记录', value: d.item as RecordData })
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e))
      })
    return () => {
      controller.abort()
    }
  }, [initialSelectedId, kind])
  const searchQuery = useStudioSearch(query)
  const params = new URLSearchParams({ projection: 'summary', q: searchQuery, platform, status, sample, accountId, limit: '30', offset: String(offset) })
  if (kind === 'works' && range !== 'all') {
    const day = new Date(); day.setHours(0, 0, 0, 0)
    params.set('since', new Date(day.getTime() - Math.max(0, Number(range) - 24) * 3600000).toISOString())
  }
  const recordsQuery = useStudioResource(`${kind}?${params}`)
  const countsQuery = useStudioResource(`${kind}?view=counts&sample=${sample}`, ['accounts', 'works'].includes(kind) && !!recordsQuery.data)
  const platformCounts = object(countsQuery.data?.platformCounts) as Record<string, number>
  const accountPicker = useStudioResource(`accounts?projection=summary&view=picker&limit=200&sample=${sample}`, kind === 'works')
  const allAccounts = list(accountPicker.data?.items)
  const items = list(recordsQuery.data?.items).map(row => kind === 'accounts' ? capture.withTask(row) : row), total = Number(recordsQuery.data?.total || 0)
  // Only a settled successful page can bound pagination; loading/errors have no new total.
  const lastAccountOffset = Math.max(0, Math.ceil(total / 30) - 1) * 30
  if (kind === 'accounts' && recordsQuery.isSuccess && !recordsQuery.isFetching && !recordsQuery.isPlaceholderData && offset > lastAccountOffset)
    setOffset(lastAccountOffset)
  const selected = items.find(row => row.id === selection?.id) || (selection?.id === locatedId && selection) || items[0] || null
  const accountExpanded = kind === 'accounts' && !!selected?.id && expandedAccountId === selected.id
  const selectedAccountQuery = useStudioResource(`accounts/${selected?.id || ''}`, accountExpanded)
  const accountDetail = object(selectedAccountQuery.data?.item || selectedAccountQuery.data?.account) as RecordItem
  const selectedAccountData = selected && accountDetail.id === selected.id && Number(accountDetail.version) >= Number(selected.version)
    ? { ...selected, ...accountDetail, materialCount: selected.materialCount } : selected
  const selectedAccount = selectedAccountData ? capture.withTask(selectedAccountData) : null
  const recentQuery = useStudioResource(`accounts/${selected?.id || ''}/materials?collectionView=library&projection=summary&listMode=cards&limit=20&sample=${sample}`, accountExpanded)
  const loading = recordsQuery.isPending, recent = list(recentQuery.data?.items)
  const recentLoading = accountExpanded && recentQuery.isPending, recentAccountId = accountExpanded ? selected?.id || '' : ''
  const recentTask = object(selected?.collection), recentTaskId = text(recentTask.taskId), recentTaskStatus = text(recentTask.status)
  const refetchRecent = recentQuery.refetch
  const recentVersion = useRef({ id: '', version: '' })
  useEffect(() => {
    const version = JSON.stringify([revision, recentTaskId, recentTaskStatus, selected?.materialCount])
    // Mount/expand already fetches once; only subsequent persisted changes need another read.
    if (recentAccountId && recentVersion.current.id === recentAccountId && recentVersion.current.version !== version) void refetchRecent()
    recentVersion.current = { id: recentAccountId, version }
  }, [kind, recentAccountId, revision, recentTaskId, recentTaskStatus, selected?.materialCount, refetchRecent])
  const queryError = (kind !== 'accounts' && recordsQuery.error) || (accountExpanded && (recentQuery.error || selectedAccountQuery.error))
  const error = actionError || (queryError ? errorText(queryError) : '')
  const performing = useRef(false)
  async function perform(fn: () => Promise<void>) {
    if (performing.current) return
    performing.current = true
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      performing.current = false
      setBusy(false)
    }
  }
  function editRow(row?: RecordItem) {
    if (performing.current) return
    if (!row) { setEdit({ id: '', version: 0 }); setForm({ title: '', status: 'idea', strategy: 'default', enabled: true }); return }
    void perform(async () => {
      const data = await api(`${kind}/${encodeURIComponent(row.id)}`)
      const full = data.item as RecordItem
      setEdit(full); setForm({ ...full })
    })
  }
  async function save() {
    if (!edit) return
    const payload =
      kind === 'accounts'
        ? {
            name: form.name,
            notes: form.notes,
            strategy: form.strategy,
            sourceOverride: form.sourceOverride || 'inherit',
            collectorOverride: form.collectorOverride || 'inherit',
            enabled: form.enabled,
            ...(edit.platform === 'wechat_official' ? { feedUrl: form.feedUrl || '' } : {}),
          }
        : kind === 'topics'
          ? { title: form.title, notes: form.notes, status: form.status }
          : { title: form.title }
    const result = await api(edit.id ? `${kind}/${edit.id}` : kind, edit.id ? 'PATCH' : 'POST', {
      ...payload,
      ...(edit.id ? { expectedVersion: edit.version } : {}),
    })
    if (selected?.id === edit.id) setSelected(result.item as RecordItem)
    setEdit(null)
    onChanged()
    notify('已保存')
  }
  async function remove(row: RecordItem) {
    if (
      !window.confirm(
        kind === 'accounts'
          ? '删除这个对标账号并关闭情报采集？已经保存的作品和稿件会保留。'
          : `删除「${text(row.title || row.name)}」？`,
      )
    )
      return
    await api(`${kind}/${row.id}`, 'DELETE', { expectedVersion: row.version })
    if (selected?.id === row.id) setSelected(null)
    onChanged()
    notify('已删除')
  }
  async function newDraft(row?: RecordItem) {
    const d = await api(
      'drafts',
      'POST',
      row
        ? {
            title: row.title,
            topicId: row.id,
          }
        : { title: '新的口播稿' },
    )
    onDraft(text(object(d.item).id))
  }
  const patch = (key: string, value: unknown) => setForm((prior) => ({ ...prior, [key]: value }))
  async function writeMaterial(row: RecordItem) {
    if (!row.materialId) throw new Error('作品尚未关联完整素材，请先重新导入')
    const d = await api('drafts', 'POST', {
      title: `${text(row.title)} · 口播稿`,
      materialId: row.materialId,
    })
    onDraft(text(object(d.item).id))
  }
  const statuses =
    kind === 'accounts'
      ? [
          ['active', '情报开启'],
          ['paused', '情报关闭'],
        ]
      : kind === 'topics'
        ? [
            ['idea', '灵感'],
            ['adopted', '已采纳'],
            ['writing', '写作中'],
            ['published', '已发布'],
            ['archived', '已归档'],
          ]
        : kind === 'drafts'
          ? [
              ['draft', '草稿'],
              ['finalized', '已定稿'],
              ['archived', '已归档'],
            ]
          : [
              ['ready', '可研读'],
              ['awaiting_transcript', '待转写'],
              ['pending', '待处理'],
            ]
  const changePlatform = (value: string) => {
    setPlatform(value)
    setAccountId('all')
    setOffset(0)
    setSelected(null)
  }
  const pills = (
    <>
      {[['all', '全部平台'], ...platformOptions].map(([key, label]) => (
        <button
          className={`video-plat-tab ${platform === key ? 'active' : ''}`}
          key={key}
          onClick={() => changePlatform(key)}
        >
          <span>{platformLabel(key, label)}</span>
          {platformCounts[key] !== undefined && (
            <span className="rail-count">
              {platformCounts[key]}
              {kind === 'accounts' ? '位' : '条'}
            </span>
          )}
        </button>
      ))}
    </>
  )
  const filters = (
    <details className="original-record-tools">
      <summary>筛选与管理</summary>
      <div className={s.actions}>
        <select
          aria-label="记录状态"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setOffset(0)
            setSelected(null)
          }}
        >
          <option value="all">全部状态</option>
          {statuses.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="记录样例范围"
          value={sample}
          onChange={(e) => {
            setSample(e.target.value)
            setOffset(0)
            setSelected(null)
          }}
        >
          <option value="exclude">我的记录</option>
          <option value="only">试用样例</option>
          <option value="all">全部（含样例）</option>
        </select>
        {kind === 'works' && (
          <select
            aria-label="入库时间范围"
            value={range}
            onChange={(e) => {
              setRange(e.target.value)
              setOffset(0)
              setSelected(null)
            }}
          >
            <option value="all">全部入库时间</option>
            <option value="24">近24小时入库</option>
            <option value="72">近72小时入库</option>
            <option value="168">近7天入库</option>
          </select>
        )}
        {kind === 'works' && (
          <button className="btn ghost" disabled={busy} onClick={onImport}>
            导入作品
          </button>
        )}
        <button className="btn ghost" aria-label="刷新列表" onClick={onChanged}>
          <RefreshCw size={14} />
          刷新
        </button>
      </div>
    </details>
  )
  const search = (
    <label className={kind === 'accounts' ? 'creator-search-inline' : 'video-search-wrap'}>
      <Search size={14} />
      <input
        aria-label={`搜索${titles[kind]}`}
        placeholder={kind === 'accounts' ? '按博主名称 / 主体过滤…' : '搜索标题 / 描述 / 关键词…'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOffset(0)
          setSelected(null)
        }}
      />
    </label>
  )
  const creatorActions = (row: RecordItem, onCapture?: () => void) => {
    const state = studioAccountState(row)
    const sample = isSample(row)
    const count = Math.min(state.captureCountLimit, capture.limit)
    return (
      <>
        {state.verified && !sample && (
          <label className="creator-capture-scope" title={state.dailyHint || `本次抓取最近 ${count} 条作品`}>
            <select
              aria-label="抓取条数"
              disabled={busy || !!capture.submitting[row.id] || state.captureCountLimit === 1}
              value={count}
              onChange={(event) => capture.setLimit(Number(event.target.value))}
            >
              {CAPTURE_LIMIT_OPTIONS.filter(value => value <= state.captureCountLimit).map((count) => (
                <option key={count} value={count}>
                  {count} 条
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="btn-creator-backfill"
          aria-label={state.recaptureTaskId ? '重新采集' : state.captureBlocked ? state.captureTaskId ? '核实原请求' : '查看采集问题'
            : state.verified && !sample ? `抓取最近 ${count} 条作品` : undefined}
          disabled={busy || capture.submitting[row.id] || state.active || sample}
          title={sample ? '试用样例不参与真实采集' : state.captureHint || state.dailyHint || `按发布时间抓取最近 ${count} 条，已有作品不重复，也不以更旧作品补数`}
          onClick={() => {
            if (state.recaptureTaskId) { void capture.recollect(row); return }
            if (state.captureBlocked) { if (state.captureTaskId) onTask(state.captureTaskId); else onTask(''); return }
            onCapture?.(); void capture.start(row)
          }}
        >
          {capture.submitting[row.id] ? '正在提交…' : state.active ? state.label : state.recaptureTaskId ? '重新采集' : state.captureBlocked
            ? state.captureTaskId ? '核实原请求' : '查看采集问题' : state.verified ? '抓取' : '获取资料'}
        </button>
        {state.recaptureTaskId && <button type="button" className="btn ghost" disabled={busy}
          onClick={() => onTask(state.recaptureTaskId)}>核实原请求</button>}
        {/^https?:\/\//i.test(text(row.url)) && (
          <a className="btn-creator-link" href={text(row.url)} target="_blank" rel="noreferrer">
            {row.platform === 'wechat_official' ? '来源文章' : '主页'} ↗
          </a>
        )}
      </>
    )
  }
  const materialButtons = (row: RecordItem) => (
    <>
      <button
        className="btn-card-action btn-card-read"
        disabled={busy || !row.materialId}
        onClick={() => onMaterial(text(row.materialId))}
      >
        📄 研读
      </button>
      <button
        className="btn-card-action btn-card-remix"
        disabled={busy || !row.materialId}
        onClick={() => void perform(() => writeMaterial(row))}
      >
        ✍️ 二创
      </button>
    </>
  )
  const view = (
    <section
      className="fullview-container"
      id={`view-${kind === 'accounts' ? 'creators' : kind === 'works' ? 'videos' : kind}`}
    >
      <div className="fullview-head">
        <div>
          {kind === 'works' && <span className="video-hero-tag">TODAY FEED</span>}
          <h2 className="fullview-title">{titles[kind]}</h2>
          <p className="fullview-subtitle">
            {kind === 'accounts'
              ? '管理开启情报的创作者，自动监控各平台更新与爆款动态。'
              : kind === 'works'
                ? '已采集的视频与文章归档，支持按创作者、平台、正文状态检索研读。'
                : kind === 'topics'
                  ? '整理选题、关联参考资料，把想法写成作品。'
                  : '已保存的稿件与版本，随时返回二创工作台继续写作。'}
          </p>
        </div>
        <div className={s.actions} style={{ margin: 0 }}>
          {kind === 'accounts' ? (
            <button className="btn btn-emerald" disabled={busy} onClick={onImport}>
              + 添加博主主页
            </button>
          ) : kind === 'topics' ? (
            <button className="btn btn-emerald" disabled={busy} onClick={() => editRow()}>
              + 新选题
            </button>
          ) : kind === 'drafts' ? (
            <button
              className="btn btn-emerald"
              disabled={busy}
              onClick={() => void perform(() => newDraft())}
            >
              + 开始写稿
            </button>
          ) : (
            <button
              className="btn btn-emerald"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const d = await api('collections', 'POST', {
                    idempotencyKey: crypto.randomUUID(),
                    platform: platform === 'all' ? 'all' : platform,
                  })
                  const task = list(object(d.collection || d).items).find((row) => row.taskId)
                  if (task) onTask(text(task.taskId))
                  setDetails({ title: '收集最新作品', value: d })
                  notify('采集批次已保存，请查看实际任务结果')
                })
              }
            >
              🚀 收集最新作品
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {kind === 'accounts' ? (
        <StudioAccountsView
          pills={pills}
          search={search}
          loading={loading}
          listReadError={recordsQuery.error ? errorText(recordsQuery.error) : ''}
          onRetry={() => void recordsQuery.refetch()}
          items={items}
          selected={selectedAccount}
          setSelected={setSelected}
          expandedId={expandedAccountId}
          setExpandedId={setExpandedAccountId}
          creatorActions={creatorActions}
          recentLoading={accountExpanded && (recentLoading || (!!selected && recentAccountId !== selected.id))}
          recent={selected?.id === recentAccountId ? recent : []}
          onMaterial={onMaterial}
          onAccountMaterials={onAccountMaterials}
          busy={busy}
          perform={perform}
          onChanged={onChanged}
          onTasks={() => onTask('')}
          onTask={onTask}
          onDelete={item => void perform(() => remove(item))}
          captureTask={selectedAccount ? object(selectedAccount.collection) : undefined}
          onRefreshProfile={row => void capture.refreshProfile(row)}
          onRecapture={row => void capture.recollect(row)}
          refreshingProfile={!!selectedAccount && !!capture.submitting[selectedAccount.id]}
        />
      ) : kind === 'works' ? (
        <StudioWorksView
          pills={pills}
          accountId={accountId}
          setAccountId={setAccountId}
          setOffset={setOffset}
          setSelected={setSelected}
          allAccounts={allAccounts}
          platform={platform}
          filters={filters}
          search={search}
          loading={loading}
          items={items}
          selected={selected}
          materialButtons={materialButtons}
          busy={busy}
          perform={perform}
          onTask={onTask}
          notify={notify}
        />
      ) : kind === 'topics' ? (
        <StudioTopicsView items={items} total={total} selected={selected} onSelect={setSelected}
          loading={loading} tools={<>{search}{filters}</>} busy={busy}
          onSaved={item => { setSelected(item); onChanged(); notify('选题已保存') }}
          onMaterial={onMaterial} onWrite={item => void perform(() => newDraft(item))}
          onDelete={item => void perform(() => remove(item))} />
      ) : (
        <>
          <div className="video-library-tools">
            {search}
            {filters}
          </div>
          <div className="topics-inbox" role="list">
            {loading ? (
              <Busy />
            ) : items.length ? (
              items.map((row) => (
                <div className="topics-row" role="listitem" key={row.id}>
                  <div className="topics-row-main">
                    <div className="topics-row-meta">
                      {row.platform ? <Platform value={row.platform} /> : null}
                      <span className="topics-creator">{row.author ? creatorName(row.author) : text(row.notes)}</span>
                      <span className="topics-time">
                        {dateLabel(row.updatedAt)} · v{row.version}
                      </span>
                      <span className="status-tag gray">
                        {statusNames[text(row.status)] || text(row.status)}
                      </span>
                      {isSample(row) && <span className="badge">试用样例</span>}
                    </div>
                    <button
                      className="topics-title"
                      title={text(row.title)}
                      onClick={() => (kind === 'drafts' ? onDraft(row.id) : editRow(row))}
                    >
                      {text(row.title, '未命名作品')}
                    </button>
                  </div>
                  <div className="topics-row-actions">
                    <button
                      className="btn btn-emerald topics-action-primary"
                      disabled={busy}
                      onClick={() =>
                        kind === 'drafts' ? onDraft(row.id) : void perform(() => newDraft(row))
                      }
                    >
                      {kind === 'drafts' ? '继续写稿' : '去二创'}
                    </button>
                    {!!row.materialId && (
                      <button
                        className="btn ghost topics-action-read"
                        disabled={busy}
                        onClick={() => onMaterial(text(row.materialId))}
                      >
                        逐字稿
                      </button>
                    )}
                    {kind === 'topics' && (
                      <button className="btn ghost" disabled={busy} onClick={() => editRow(row)}>
                        编辑
                      </button>
                    )}
                    <button
                      className="btn ghost topics-action-remove"
                      disabled={busy}
                      onClick={() => void perform(() => remove(row))}
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <Empty title={kind === 'topics' ? '选题库空空如也' : '还没有保存的稿件'}>
                <p>
                  {kind === 'topics'
                    ? '在情报流中点击「★ 采纳进选题」即可将灵感存入此处。'
                    : '点击开始写稿，保存后会出现在这里。'}
                </p>
              </Empty>
            )}
          </div>
        </>
      )}
      {(kind !== 'accounts' || total > 30 || offset > 0) && <div className={s.pagination}>
        <button
          className="btn ghost"
          disabled={!offset || loading}
          onClick={() => setOffset((v) => Math.max(0, v - 30))}
        >
          上一页
        </button>
        <span>
          共 {total} 条 · 第 {Math.floor(offset / 30) + 1} 页
        </span>
        <button
          className="btn ghost"
          disabled={offset + 30 >= total || loading}
          onClick={() => setOffset((v) => v + 30)}
        >
          下一页
        </button>
      </div>}
      {edit && (
        <StudioRecordEditor
          edit={edit}
          setEdit={setEdit}
          busy={busy}
          error={error}
          kind={kind}
          form={form}
          patch={patch}
          perform={perform}
          save={save}
        />
      )}
      {details && (
        <Modal title={details.creatorName !== undefined ? `${creatorName(details.creatorName)} · ${details.title}` : details.title} close={() => setDetails(null)}>
          {Array.isArray(details.value.items) ? (
            <>
              {list(details.value.items).map((row) => (
                <article className={s.card} key={row.id}>
                  <h3>{materialTitle(row.title)}</h3>
                  <div className={s.meta}>
                    <Platform value={row.platform} />
                    {row.rankingValue !== undefined && (
                      <span>已观测指标 {text(row.rankingValue)}</span>
                    )}
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() => onMaterial(text(row.materialId || row.id))}
                  >
                    打开素材
                  </button>
                </article>
              ))}
              {!list(details.value.items).length && <Empty title="没有可展示的记录" />}
              {!!details.value.scope && <p className={s.meta}>{text(details.value.scope)}</p>}
            </>
          ) : (
            <>
              <Details value={details.value} privacyIdentity={kind === 'accounts'} />
              {!!details.value.id && kind === 'topics' && (
                <div className={s.actions}>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void perform(() => newDraft(details.value as RecordItem))}
                  >
                    去二创
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      editRow(details.value as RecordItem)
                      setDetails(null)
                    }}
                  >
                    编辑选题
                  </button>
                </div>
              )}
              {!!details.value.id && kind === 'drafts' && (
                <button className="btn primary" onClick={() => onDraft(text(details.value.id))}>
                  继续写稿
                </button>
              )}
            </>
          )}
        </Modal>
      )}
    </section>
  )
  return kind === 'accounts' ? <div className="radar-source-page">{view}</div> : view
}
