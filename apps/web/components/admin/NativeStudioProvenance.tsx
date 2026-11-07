'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { creationRequest } from '@/lib/creation-client'
import { displayBeijingTime } from '@/lib/creation-time'
import type { NativeStudioProvenance as Provenance, NativeStudioProvenanceList } from '@/lib/native-studio-provenance'
import styles from './station-handoff-provenance.module.css'

const platforms: Record<string, string> = { douyin: '抖音', bili: 'B站', bilibili: 'B站', xiaohongshu: '小红书', youtube: 'YouTube', local: '本地素材' }
const sources: Record<string, string> = { manual: '人工输入', manual_correction: '人工校正', platform_subtitle: '平台字幕', platform_captions: '平台字幕', subtitle: '平台字幕', uploaded_subtitle: '上传字幕', uploaded_text: '上传正文', asr: '音频转写', knowledge_snapshot: '知识版本快照', legacy: '迁移保留正文', import: '导入文本' }
const date = (value: string) => `${displayBeijingTime(value)}（北京时间）`
function FrozenText({ title, body, open = false, empty = '该版本未保存这部分内容。' }: { title: string; body: string; open?: boolean; empty?: string }) {
  return <details className={styles.textBlock} open={open}><summary>{title}</summary><pre>{body || empty}</pre></details>
}

export default function NativeStudioProvenance({ projectId, masterVersion }: { projectId: number; masterVersion: number }) {
  // Remount only this read-only panel across projects/versions; never remount the editor to load provenance.
  return <ProvenancePanel key={`${projectId}:${masterVersion}`} projectId={projectId} />
}

function ProvenancePanel({ projectId }: { projectId: number }) {
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0), [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<{ offset: number; data: NativeStudioProvenanceList } | null>(null), [error, setError] = useState('')
  const [detail, setDetail] = useState<Provenance | null>(null), [detailError, setDetailError] = useState('')
  const current = result?.offset === offset ? result.data : null
  const activeId = selected ?? current?.items[0]?.id ?? null
  useEffect(() => {
    const controller = new AbortController()
    void creationRequest<{ provenance: NativeStudioProvenanceList }>(`/api/workspace/native-studio-provenance?projectId=${projectId}&offset=${offset}`, { signal: controller.signal }).then(({ provenance }) => {
      if (!controller.signal.aborted) { setResult({ offset, data: provenance }); setError('') }
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '来源读取失败') })
    return () => controller.abort()
  }, [projectId, offset, retry])
  useEffect(() => {
    if (activeId === null) return
    const controller = new AbortController()
    void creationRequest<{ provenance: Provenance }>(`/api/workspace/native-studio-provenance?projectId=${projectId}&adoptionId=${activeId}`, { signal: controller.signal }).then(({ provenance }) => {
      if (!controller.signal.aborted) { setDetail(provenance); setDetailError('') }
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setDetailError(failure instanceof Error ? failure.message : '快照读取失败') })
    return () => controller.abort()
  }, [projectId, activeId, retry])
  if (current?.total === 0 && !error) return null
  const snapshot = detail?.id === activeId ? detail : null
  function page(value: number) { setOffset(value); setSelected(null); setError(''); setDetailError('') }
  return <details className={styles.panel} open><summary>原生创作来源{current ? ` · 已送入母稿 · ${current.total} 次交接` : ''}</summary><div className={styles.content}>
    <p className={styles.explanation}>这里保存每次交接时的稿件和来源快照。母稿可以继续修改，原生稿件、素材和知识后来发生的变化不会改写这份记录。</p>
    {error ? <p role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>重新读取</button></p> : !current ? <p role="status">正在读取交接记录…</p> : <>
      {current.total > 1 && <ul className={styles.records}>{current.items.map(row => <li key={row.id}><button type="button" aria-pressed={activeId === row.id} onClick={() => { setSelected(row.id); setDetailError('') }}><strong>原生稿件 v{row.draftVersion} → 母稿 v{row.masterVersion}</strong><span>{date(row.adoptedAt)} · {row.isCurrentMaster ? '对应当前母稿' : '历史交接版本'}</span></button></li>)}</ul>}
      {(offset > 0 || current.hasMore) && <nav className={styles.pagination} aria-label="原生交接来源分页"><button type="button" disabled={offset === 0} onClick={() => page(Math.max(0, offset - 20))}>上一页</button><span>{offset + 1}—{offset + current.items.length} / {current.total}</span><button type="button" disabled={!current.hasMore} onClick={() => page(current.nextOffset)}>下一页</button></nav>}
      {detailError ? <p role="alert">{detailError}<button type="button" onClick={() => setRetry(value => value + 1)}>重新读取快照</button></p> : snapshot ? <Snapshot data={snapshot} /> : activeId !== null && <p role="status">正在读取冻结来源…</p>}
    </>}
  </div></details>
}

function Snapshot({ data }: { data: Provenance }) {
  const { material, publication } = data
  return <article className={styles.snapshot}>
    <header className={styles.heading}><div><h3>{data.draft.title || '原生工作台定稿'}</h3><p>原稿 v{data.draftVersion} → 母稿 v{data.masterVersion} · {date(data.adoptedAt)}</p></div><span className={styles.badge}>{data.isCurrentMaster ? '对应当前母稿' : `母稿现为 v${data.currentMasterVersion}，此处保留历史`}</span></header>
    <div className={styles.links}><Link href={data.sourceDraftUrl}>返回原生稿件 ↗</Link><span>打开的是原稿当前版本；下方为交接时的冻结版本。</span></div>
    <FrozenText title={`交接正文 · 原稿 v${data.draftVersion}`} body={data.draft.body} />
    {material ? <section className={styles.source}><h4>参考素材 · {material.title || '未命名素材'}</h4><p>{platforms[material.platform] || material.platform || '平台未记录'} · {material.author || '作者未记录'}{material.version ? ` · 素材 v${material.version}` : ''} · {sources[material.transcript.source] || material.transcript.source || '逐字稿来源未记录'}</p>
      {material.isSample && <p className={styles.sample}>试用样例</p>}{material.sourceRef && <p>来源标识：{material.sourceRef}</p>}
      <div className={styles.links}>{material.url && <a href={material.url} target="_blank" rel="noreferrer">素材原链接 ↗</a>}{material.originalUrl && material.originalUrl !== material.url && <a href={material.originalUrl} target="_blank" rel="noreferrer">导入时的链接 ↗</a>}</div>
      {publication && <p>本次从 {platforms[publication.platform] || publication.platform || '关联平台'} 的“{publication.title || publication.id}”引用，逐字稿使用上述已关联主素材。{publication.url && <a href={publication.url} target="_blank" rel="noreferrer">查看发布记录 ↗</a>}</p>}
      <FrozenText title="交接时的校正版原文" body={material.transcript.corrected} open />
      <FrozenText title="原始转写 / 原始正文" body={material.transcript.raw} />
      {!!material.transcript.segments.length && <details className={styles.textBlock}><summary>原文时间位置 · {material.transcript.segments.length} 段</summary><ol>{material.transcript.segments.map((segment, index) => <li key={index}><span>{segment.start === null ? '时间未记录' : `${segment.start} 秒`}{segment.end !== null ? ` — ${segment.end} 秒` : ''}</span><p>{segment.text}</p></li>)}</ol></details>}
    </section> : <p className={styles.explanation}>这次交接没有保存关联素材快照；稿件正文已经保存在母稿中。</p>}
    {data.topic && <section className={styles.source}><h4>参考选题 · {data.topic.title || '未命名选题'}</h4><FrozenText title="选题内容快照" body={data.topic.body} /></section>}
    <section className={styles.source}><h4>知识引用 · {data.knowledge.length} 条</h4>{data.knowledge.length ? data.knowledge.map((item, index) => <article className={styles.knowledge} key={`${item.origin}:${item.id}:${item.version}:${index}`}><strong>{item.title || `知识条目${item.id ? ` #${item.id}` : ''}`}{item.version ? ` · v${item.version}` : ''}</strong><p>{item.origin === 'material' ? '作为素材引用' : '作为本次写稿参考'}{item.sourceRef ? ` · ${item.sourceRef}` : ''}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">知识来源 ↗</a>}<FrozenText title="知识正文快照" body={item.bodyMarkdown} empty="该交接版本只保存了引用信息，未保存知识正文；不会使用当前正文替代历史。" /></article>) : <p>此交接版本没有保存知识引用。</p>}</section>
    <footer className={styles.footer}><p>交接只保存内容来源，事实复核与发布确认仍需完成。</p><details><summary>来源校验摘要</summary><code>{data.sourceDigest}</code></details></footer>
  </article>
}
