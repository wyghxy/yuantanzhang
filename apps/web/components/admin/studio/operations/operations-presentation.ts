'use client'

import { text, statusNames } from '../studio-client'

export const collectionStates: Record<string, string> = {
  running: '正在采集',
  needs_attention: '部分任务需处理',
  cancelled: '已停止',
  completed: '本批处理完成',
  empty: '没有可采集账号',
  skipped: '已跳过',
}

export const detailStyle = {
  padding: '10px 0',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 13,
} as const

export const smallStyle = { color: 'var(--text-muted)', fontSize: 12 } as const

export const actionsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const

export const stateName = (value: unknown) =>
  statusNames[text(value)] || collectionStates[text(value)] || text(value, '尚无记录')
