'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { CatalogSelectionSourceType } from '@ytz/contracts/knowledge-catalog'
import { useAdminShell } from '../AdminShell'
import { isSample, type RecordItem } from './studio-client'
import { isStudioPreview } from './studio-preview'
import { Modal } from './StudioUI'
import { canUseKnowledgeSelection, selectionRequest, StudioKnowledgeSelection, type SelectionSnapshot } from './studio-knowledge-selection'

type Props = {
  material: RecordItem
  sourceType?: CatalogSelectionSourceType
  enabled?: boolean
  blockedReason?: string
  className?: string
  containerClassName?: string
  /** 以功能条形态呈现：左侧说明当前情况，右侧一个动作按钮。 */
  panel?: boolean
}

export function captureLabel(snapshot: SelectionSnapshot) {
  if (snapshot.pending === 'save') return '正在保存沉淀…'
  if (snapshot.pending === 'load' || !snapshot.state && !snapshot.error) return '读取沉淀状态…'
  if (snapshot.error) return snapshot.fresh ? '沉淀未完成 · 查看' : '沉淀状态待确认'
  return snapshot.state?.selected ? '已沉淀 · 移出' : '沉淀到知识星球'
}

function CaptureSession({ material, sourceType = 'studio_materials', enabled = true, blockedReason = '', className = 'btn ghost', panel = false }: Props) {
  const [session] = useState(() => new StudioKnowledgeSelection(selectionRequest(sourceType, material.id)))
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [showError, setShowError] = useState(false)
  const preview = isStudioPreview() || isSample(material)
  const readable = enabled && !preview && !material.summaryOnly
  useEffect(() => () => session.cancel(), [session])
  useEffect(() => { if (readable) void session.load(); else session.cancel() }, [session, readable, material.version, material.updatedAt])
  useEffect(() => {
    if (!readable) return
    const refresh = () => { if (document.visibilityState === 'visible') void session.load() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [session, readable])
  const unavailable = preview ? '演示内容不写入知识星球。' : !readable ? '完整来源载入后可以沉淀。' : blockedReason
  // 每种状态给出「现在是什么情况 + 点一下会发生什么」，避免只有一个孤零零的按钮。
  const settling = snapshot.pending === 'save'
  const loading = snapshot.pending === 'load' || (!snapshot.state && !snapshot.error && !settling)
  const selected = snapshot.state?.selected === true
  const label = preview ? '演示内容 · 不沉淀'
    : unavailable ? '暂不可用'
    : settling ? '正在保存…'
    : loading ? '读取中…'
    : snapshot.error ? '查看状态'
    : selected ? '移出' : '沉淀到知识星球'
  const hint = preview ? '演示内容不会写入知识星球。'
    : unavailable ? unavailable
    : snapshot.error ? '沉淀状态尚未确认；点击可查看详情或重试。'
    : settling ? '正在保存沉淀状态，请稍候。'
    : loading ? '正在读取这条内容的沉淀状态…'
    : selected ? '已收录到知识星球；再次点击可移出，原内容仍保留。'
    : '主动收录到知识星球；阅读、收藏或记笔记都不会自动收录。'
  const change = async (selected: boolean) => {
    if (unavailable) return
    await session.change(selected)
    if (session.getSnapshot().error) setShowError(true)
  }
  const button = <button type="button" className={className} disabled={!!unavailable || !!snapshot.pending || !snapshot.fresh && !snapshot.error}
      aria-pressed={selected} aria-busy={settling || loading} title={unavailable || snapshot.error || snapshot.notice || hint}
      onClick={() => snapshot.error ? setShowError(true) : void change(!selected)}>
      <span role="status">{label}</span>
    </button>
  return <>
    {panel ? <div className="library-body-entry"><div><strong>知识沉淀</strong><p>{hint}</p></div>{button}</div> : button}
    {showError && <Modal title="知识沉淀状态" close={() => setShowError(false)}>
      <p role={snapshot.error ? 'alert' : 'status'}>{snapshot.error || snapshot.notice || (snapshot.state?.selected ? '已沉淀到知识星球。' : '尚未沉淀到知识星球。')}</p>
      <button type="button" className="btn ghost" disabled={!!snapshot.pending || !readable} onClick={() => void session.load()}>重新读取状态</button>
      {snapshot.fresh && snapshot.retrySelected !== undefined && <button type="button" className="btn" disabled={!!snapshot.pending || !!unavailable} onClick={() => void change(snapshot.retrySelected!)}>{snapshot.retrySelected ? '重试沉淀' : '重试移出'}</button>}
    </Modal>}
  </>
}

export default function StudioKnowledgeCapture(props: Props) {
  const { role, features, userId } = useAdminShell()
  if (!canUseKnowledgeSelection(role, features)) return null
  const control = <CaptureSession key={`${userId}/${props.sourceType || 'studio_materials'}/${props.material.id}`} {...props} />
  return props.containerClassName ? <div className={props.containerClassName}>{control}</div> : control
}
