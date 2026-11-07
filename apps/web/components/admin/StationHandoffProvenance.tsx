'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { creationRequest } from '@/lib/creation-client'
import { displayBeijingTime } from '@/lib/creation-time'
import type { HandoffProvenance, ProjectHandoffProvenance } from '@/lib/station-handoff-provenance'
import styles from './station-handoff-provenance.module.css'

const platforms: Record<string, string> = { douyin: '抖音', bili: 'B站', bilibili: 'B站', xiaohongshu: '小红书', youtube: 'YouTube', local: '本地输入' }
const transcriptSources: Record<string, string> = { manual: '人工输入', knowledge_snapshot: '知识版本快照', platform_subtitle: '平台字幕', subtitle: '平台字幕', asr: '音频转写', uploaded_subtitle: '上传字幕', uploaded_text: '上传正文', legacy: '原包保留内容', import: '导入文本' }

function FrozenText({ title, body, open = false }: { title: string; body: string; open?: boolean }) {
  return <details className={styles.textBlock} open={open}><summary>{title}</summary><pre>{body || '此快照没有保存该项正文。'}</pre></details>
}

function Snapshot({ value }: { value: HandoffProvenance }) {
  const material = value.material
  return <article className={styles.snapshot} aria-label={`源稿 v${value.stationDraftVersion} 交接快照`}>
    <div className={styles.heading}><div><h3>{value.draft.title}</h3><p>源稿 v{value.stationDraftVersion} → 母稿 v{value.masterScriptVersion} · {displayBeijingTime(value.handedOffAt)}（北京时间）</p></div><span className={styles.badge}>{value.isCurrentMaster ? '对应当前母稿版本' : `历史交接 · 当前母稿 v${value.currentMasterVersion}`}</span></div>
    <p className={styles.explanation}>以下内容来自交接时保存的固定快照。原素材和知识条目之后的修改不会改变这里；内容仍须人工核实。</p>
    <FrozenText title="交接正文" body={value.draft.body} />
    {material ? <section className={styles.source}><h4>对标素材：{material.title || material.id || '未记录标题'}</h4><p>{platforms[material.platform] || material.platform || '未记录平台'} · {material.author || '未记录作者'} · 素材 {material.version ? `v${material.version}` : '版本未记录'}{material.isSample && <strong className={styles.sample}> · 试用样例</strong>}</p>
      <div className={styles.links}>{material.url && <a href={material.url} target="_blank" rel="noreferrer">打开平台原作 ↗</a>}{material.originalUrl && material.originalUrl !== material.url && <a href={material.originalUrl} target="_blank" rel="noreferrer">原始分享链接 ↗</a>}{!material.url && !material.originalUrl && <span>此素材没有可打开的平台链接。</span>}</div>
      <p>正文来源：{transcriptSources[material.transcript.source] || material.transcript.source || '未记录'}{material.transcript.version ? ` · 逐字稿 v${material.transcript.version}` : ''}{material.sourceRef ? ` · ${material.sourceRef}` : ''}</p>
      <FrozenText title="交接时的校正版正文" body={material.transcript.corrected} open />
      <FrozenText title="原始字幕 / 原始转写" body={material.transcript.raw} />
      {!!material.transcript.segments.length && <details className={styles.textBlock}><summary>原文时间位置（{material.transcript.segments.length} 段）</summary><ol>{material.transcript.segments.map((segment, index) => <li key={index}><span>{segment.start === null ? '时间未记录' : `${segment.start} 秒`}{segment.end === null ? '' : `—${segment.end} 秒`}</span><p>{segment.text}</p></li>)}</ol></details>}
    </section> : <p className={styles.explanation}>此交接快照没有保存对标素材；不会用当前素材补写历史记录。</p>}
    {value.knowledge.length > 0 && <section className={styles.source}><h4>引用的知识版本（{value.knowledge.length} 份）</h4>{value.knowledge.map((reference, index) => <div className={styles.knowledge} key={`${reference.sourceRef}-${index}`}><p><strong>{reference.title || '未记录标题'}</strong> · {reference.version ? `v${reference.version}` : '版本未记录'} · {reference.origin === 'material' ? '作为对标素材导入' : '写稿时引用'}</p><p>{reference.sourceRef || (reference.id ? `知识 #${reference.id}` : '知识标识未记录')}</p>{reference.sourceUrl && <a href={reference.sourceUrl} target="_blank" rel="noreferrer">打开知识原始来源 ↗</a>}<FrozenText title="当时引用的知识正文" body={reference.bodyMarkdown} /></div>)}</section>}
    {value.topic && <section className={styles.source}><h4>选题：{value.topic.title || value.topic.id || '未记录标题'}</h4>{value.topic.body && <FrozenText title="当时的选题说明" body={value.topic.body} />}</section>}
    <div className={styles.footer}><Link href={value.sourceDraftUrl}>返回情报站查看原稿 →</Link><p>返回后会核对情报站实例和稿件版本。查看原稿不会重新交接，也不会改变母稿。</p><details><summary>来源标识与内容摘要</summary><p>情报站实例：{value.stationInstanceId}<br />稿件：{value.stationDraftId} · v{value.stationDraftVersion}<br />交接记录：#{value.id}<br />SHA-256：{value.sourceDigest}</p></details></div>
  </article>
}

export default function StationHandoffProvenance({ projectId, masterVersion }: { projectId: number; masterVersion: number }) {
  const [offset, setOffset] = useState(0), [reload, setReload] = useState(0)
  const [list, setList] = useState<{ key: string; data?: ProjectHandoffProvenance; error?: string } | null>(null)
  const [chosen, setChosen] = useState<{ key: string; id: number; data?: HandoffProvenance; error?: string } | null>(null)
  const listSequence = useRef(0), detailSequence = useRef(0)
  const key = `${projectId}:${masterVersion}:${offset}:${reload}`, visibleList = list?.key === key ? list : null, visibleChosen = chosen?.key === key ? chosen : null
  useEffect(() => {
    const controller = new AbortController(), sequence = ++listSequence.current
    void creationRequest<{ provenance: ProjectHandoffProvenance }>(`/api/workspace/station-handoffs?projectId=${projectId}&offset=${offset}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && sequence === listSequence.current) setList({ key, data: result.provenance })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && sequence === listSequence.current) setList({ key, error: error instanceof Error ? error.message : '交接来源读取失败' })
    })
    return () => controller.abort()
  }, [key, projectId, offset])

  async function choose(id: number) {
    const sequence = ++detailSequence.current
    setChosen({ key, id })
    try {
      const result = await creationRequest<{ provenance: HandoffProvenance | null }>(`/api/workspace/station-handoffs/${id}`)
      if (!result.provenance) throw new Error('这份预览尚未完成交接，不能作为母稿来源。')
      if (sequence === detailSequence.current) setChosen({ key, id, data: result.provenance })
    } catch (error) { if (sequence === detailSequence.current) setChosen({ key, id, error: error instanceof Error ? error.message : '来源快照读取失败' }) }
  }

  if (visibleList?.data?.total === 0) return null
  return <details className={styles.panel}>
    <summary>情报站交接来源{visibleList?.data ? ` · ${visibleList.data.total} 次已保存交接` : ''}</summary>
    <div className={styles.content}>
      <p className={styles.explanation}>逐次查看交接正文、平台原链接和引用的知识版本。交接来源不等于已核实事实，确认与发布流程保持原有要求。</p>
      {!visibleList && <p role="status">正在读取交接记录…</p>}
      {visibleList?.error && <div role="alert"><p>{visibleList.error}</p><button type="button" onClick={() => setReload(value => value + 1)}>重新读取来源</button></div>}
      {visibleList?.data && <>
        <ul className={styles.records}>{visibleList.data.items.map(item => <li key={item.id}><button type="button" aria-pressed={visibleChosen?.id === item.id} onClick={() => void choose(item.id)}><strong>母稿 v{item.masterScriptVersion} ← 情报站源稿 v{item.stationDraftVersion}</strong><span>{item.isCurrentMaster ? '对应当前母稿版本' : '历史交接'} · {displayBeijingTime(item.handedOffAt)}</span></button></li>)}</ul>
        <div className={styles.pagination}>{offset > 0 && <button type="button" onClick={() => setOffset(value => Math.max(0, value - 20))}>上一页交接</button>}{visibleList.data.hasMore && <button type="button" onClick={() => setOffset(visibleList.data!.nextOffset)}>下一页交接</button>}</div>
      </>}
      {visibleChosen && !visibleChosen.data && !visibleChosen.error && <p role="status">正在读取固定版本快照…</p>}
      {visibleChosen?.error && <div role="alert"><p>{visibleChosen.error}</p><button type="button" onClick={() => void choose(visibleChosen.id)}>重新读取这份快照</button></div>}
      {visibleChosen?.data && <Snapshot value={visibleChosen.data} />}
    </div>
  </details>
}
