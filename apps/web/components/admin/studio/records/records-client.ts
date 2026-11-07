'use client'

import { api, list, platforms, type RecordItem } from '../studio-client'

export const titles: Record<string, string> = {
  accounts: '对标账号',
  topics: '创作中心',
  works: '最新作品 · 视频与文章库',
  drafts: '我的稿件',
}

export const platformOptions = Object.entries(platforms).filter(
  ([key]) => !['bilibili', 'local'].includes(key),
)

export async function allRecords(kind: string, sample = 'all') {
  const rows: RecordItem[] = []
  let offset = 0
  for (;;) {
    const d = await api(`${kind}?limit=200&offset=${offset}&sample=${sample}`)
    rows.push(...list(d.items))
    if (!d.hasMore) return rows
    const next = Number(d.nextOffset)
    if (!Number.isSafeInteger(next) || next <= offset)
      throw new Error('账号列表分页未完成，请刷新重试')
    offset = next
  }
}
