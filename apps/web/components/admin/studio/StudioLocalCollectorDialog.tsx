'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, LoaderCircle, X } from 'lucide-react'
import { api, apiFresh, errorText, object, StudioClientError, text, type RecordData } from './studio-client'
import styles from './StudioLocalCollectorDialog.module.css'

export type LocalCollectorOpenDetail = { url?: string; accountId?: string }
type Configuration = { configured: boolean; endpoint: string; version: number }
type CollectionResult = { items: RecordData[]; importedCount: number; duplicateCount: number }

export function openStudioLocalCollector(detail: LocalCollectorOpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<LocalCollectorOpenDetail>('ytz-open-local-collector', { detail }))
}

function configuration(value: RecordData): Configuration {
  if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error('采集设置读取不完整，请重试。')
  return { configured: value.configured === true, endpoint: text(value.endpoint), version: Number(value.version) }
}

function localEndpoint(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch { return false }
}

function sourceAddress(value: string) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
  } catch { return false }
}

export default function StudioLocalCollectorDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<Configuration | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [url, setUrl] = useState('')
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'save' | 'disconnect' | 'run' | ''>('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<CollectionResult | null>(null)
  const pending = useRef(false)
  const action = useRef<AbortController | null>(null)

  const read = useCallback(async (signal?: AbortSignal, preserveInput = false) => {
    const value = configuration(await apiFresh('local-collector', signal))
    signal?.throwIfAborted()
    setSaved(value)
    if (!preserveInput) setEndpoint(value.endpoint)
    return value
  }, [])

  useEffect(() => {
    const show = (event: Event) => {
      if (pending.current) return
      const detail = object((event as CustomEvent<LocalCollectorOpenDetail>).detail)
      if (typeof detail.url === 'string') setUrl(detail.url)
      setAccountId(text(detail.accountId))
      setResult(null); setError(''); setMessage(''); setOpen(true)
    }
    window.addEventListener('ytz-open-local-collector', show)
    return () => { window.removeEventListener('ytz-open-local-collector', show); action.current?.abort() }
  }, [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const previous = document.activeElement as HTMLElement | null
    const current = dialog.current
    current?.showModal()
    setLoading(true); setSaved(null)
    void read(controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(errorText(reason))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); current?.close(); if (previous?.isConnected) previous.focus() }
  }, [open, read])

  async function retryRead() {
    if (pending.current || loading) return
    const controller = new AbortController(); action.current = controller
    setLoading(true); setError('')
    try { await read(controller.signal) }
    catch (reason) { if (!controller.signal.aborted) setError(errorText(reason)) }
    finally { if (!controller.signal.aborted) setLoading(false); if (action.current === controller) action.current = null }
  }

  async function save(disconnect = false) {
    if (pending.current || !saved) return
    const nextEndpoint = disconnect ? '' : endpoint.trim()
    if (!disconnect && !localEndpoint(nextEndpoint)) { setError('请填写本机 HTTP 地址，例如 http://127.0.0.1:8765/collect。'); return }
    const controller = new AbortController(); action.current = controller; pending.current = true
    setBusy(disconnect ? 'disconnect' : 'save'); setError(''); setMessage(''); setResult(null)
    try {
      const value = configuration(await api('local-collector', 'PATCH', { endpoint: nextEndpoint, expectedVersion: saved.version }, controller.signal))
      setSaved(value); setEndpoint(value.endpoint)
      setMessage(value.configured ? '本机程序地址已保存。点击开始采集时才会调用。' : '已断开本机采集程序。')
      window.dispatchEvent(new Event('ytz-local-collector-configured'))
    } catch (reason) {
      if (controller.signal.aborted) return
      if (reason instanceof StudioClientError && reason.status === 409) {
        try { await read(controller.signal, true); setError('采集设置已被其他窗口修改。已刷新版本，请核对当前已保存地址后重试。') }
        catch (refreshError) { if (!controller.signal.aborted) setError(errorText(refreshError)) }
      } else setError(errorText(reason))
    } finally {
      pending.current = false
      if (!controller.signal.aborted) setBusy('')
      if (action.current === controller) action.current = null
    }
  }

  async function run(event: FormEvent) {
    event.preventDefault()
    if (pending.current || !saved?.configured || endpoint.trim() !== saved.endpoint) return
    if (!sourceAddress(url.trim())) { setError('请填写有效的 HTTP 或 HTTPS 来源链接。'); return }
    const controller = new AbortController(); action.current = controller; pending.current = true
    setBusy('run'); setError(''); setMessage(''); setResult(null)
    try {
      const value = await api('local-collector/run', 'POST', { url: url.trim(), ...(accountId ? { accountId } : {}) }, controller.signal)
      const next: CollectionResult = {
        items: Array.isArray(value.items) ? value.items.map(object) : [],
        importedCount: Number(value.importedCount) || 0,
        duplicateCount: Number(value.duplicateCount) || 0,
      }
      setResult(next)
      setMessage(`已新增 ${next.importedCount} 条素材，跳过 ${next.duplicateCount} 条已有来源。`)
      window.dispatchEvent(new CustomEvent('ytz-local-collection-imported', { detail: next }))
    } catch (reason) { if (!controller.signal.aborted) setError(errorText(reason)) }
    finally {
      pending.current = false
      if (!controller.signal.aborted) setBusy('')
      if (action.current === controller) action.current = null
    }
  }

  function close() {
    if (pending.current) return
    action.current?.abort(); action.current = null
    setLoading(false); setOpen(false)
  }

  if (!open) return null
  const dirty = !!saved && endpoint.trim() !== saved.endpoint
  const blocked = loading || !!busy
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="local-collector-title" onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header className={styles.header}><div><h2 id="local-collector-title">本机采集设置</h2><p>连接你自己运行的采集程序，将返回内容保存到采集库。</p></div><button type="button" className={styles.close} aria-label="关闭本机采集设置" disabled={!!busy} onClick={close}><X size={20}/></button></header>
    <section className={styles.section} aria-labelledby="local-collector-program">
      <div className={styles.sectionHeading}><h3 id="local-collector-program">本机采集程序</h3><span className={styles.status}>{loading ? '读取中…' : saved?.configured ? '已保存地址' : '未配置'}</span></div>
      <form onSubmit={event => { event.preventDefault(); void save() }}>
        <label className={styles.field}><span>程序 HTTP 地址</span><input type="url" value={endpoint} disabled={blocked || !saved} onChange={event => setEndpoint(event.target.value)} placeholder="http://127.0.0.1:8765/collect" autoComplete="off" spellCheck={false}/></label>
        <p className={styles.help}>仅连接本机地址。保存设置不会发起采集，也不代表程序已经连接成功。</p>
        {dirty && <p className={styles.help}>当前已保存：{saved.endpoint || '未配置'}</p>}
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={blocked || !saved || !endpoint.trim() || !dirty}>{busy === 'save' ? '保存中…' : '保存地址'}</button><button className={styles.secondary} type="button" disabled={blocked || !saved?.configured} onClick={() => void save(true)}>{busy === 'disconnect' ? '断开中…' : '断开'}</button>{!saved && !loading && <button className={styles.secondary} type="button" onClick={() => void retryRead()}>重新读取设置</button>}</div>
      </form>
    </section>
    <section className={styles.section} aria-labelledby="local-collector-source">
      <h3 id="local-collector-source">采集内容</h3>
      <form onSubmit={event => void run(event)}>
        <label className={styles.field}><span>来源链接</span><input type="url" required value={url} disabled={blocked} onChange={event => setUrl(event.target.value)} placeholder="粘贴作品、文章或博主链接" autoComplete="off"/></label>
        {accountId && <p className={styles.help}>采集结果将关联当前对标账号。</p>}
        <p className={styles.help}>{dirty ? '请先保存新的程序地址，再开始采集。' : saved?.configured ? '点击后调用你的本机程序，真实返回的内容才会入库；已有来源不会被覆盖。' : '先保存本机采集程序地址，再开始采集。'}</p>
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={blocked || !saved?.configured || dirty || !url.trim()}>{busy === 'run' ? <><LoaderCircle className={styles.spinner} size={16}/>正在采集…</> : '开始采集'}</button></div>
      </form>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.message} role="status">{message}</p>}
    {!!result?.items.length && <ul className={styles.results} aria-label="采集结果">{result.items.map((item, index) => <li key={`${text(item.id, 'item')}:${index}`}>{item.deletedAt ? <span>{text(item.title, '素材')} · 已有素材在回收站</span> : item.id ? <a href={'/workspace/viral?view=works&material=' + encodeURIComponent(text(item.id))}>{text(item.title, '查看素材')}</a> : <span>{text(item.title, '素材')}</span>}</li>)}</ul>}
    <footer className={styles.footer}><a href="https://yuantanzhang.cn/workspace/viral" target="_blank" rel="noopener noreferrer">立即使用官方在线版<ExternalLink size={13}/></a><a href="https://github.com/wyghxy/yuantanzhang/blob/main/docs/local-collector.md" target="_blank" rel="noopener noreferrer">接入说明<ExternalLink size={13}/></a></footer>
  </dialog>
}
