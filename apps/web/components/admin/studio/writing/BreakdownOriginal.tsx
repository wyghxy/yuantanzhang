'use client'

import { ChevronDown } from 'lucide-react'
import {
  writingText as text,
  type WritingRecord,
} from '../studio-writing-model'
import { breakdownExcerpt, breakdownIds } from './breakdown-view-model'
import { BreakdownSourceButton } from './BreakdownSourceButton'
import styles from './BreakdownReport.module.css'

/** Abbreviate consecutive IDs without filling gaps or changing the source binding. */
export function paragraphLabel(row: WritingRecord) {
  const ids = breakdownIds(row),
    groups: string[] = []
  for (let index = 0; index < ids.length; index++) {
    const first = ids[index]
    let last = first
    while (index + 1 < ids.length && ids[index + 1] === last + 1)
      last = ids[++index]
    groups.push(first === last ? String(first) : `${first}–${last}`)
  }
  return groups.length ? `第 ${groups.join('、')} 段` : '未保存段落位置'
}

export function BreakdownOriginal({
  row,
  lines,
  sourceLines,
  analysis,
  source,
}: {
  row: WritingRecord
  lines: WritingRecord[]
  sourceLines: WritingRecord[]
  analysis: WritingRecord
  source?: { materialId: string; version: number }
}) {
  const excerpt = breakdownExcerpt(row, lines, sourceLines)
  const paragraphs = text(excerpt?.sentence).split('\n').filter(Boolean)
  const visible = paragraphs.slice(0, paragraphs[0]?.length < 90 ? 2 : 1)
  const rest = paragraphs.slice(visible.length)
  return (
    <div className={styles.original}>
      <div className={styles.originalHeading}>
        <h4>原文</h4>
        <span>{paragraphLabel(excerpt || row)}</span>
        {excerpt && (
          <BreakdownSourceButton
            analysis={analysis}
            source={source}
            row={excerpt}
            compact
          />
        )}
      </div>
      {excerpt ? (
        <>
          <blockquote>{visible.join('\n')}</blockquote>
          {!!rest.length && (
            <details className={styles.moreOriginal}>
              <summary>
                展开本段完整原文
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <blockquote>{rest.join('\n')}</blockquote>
            </details>
          )}
        </>
      ) : (
        <p className={styles.empty}>
          这份旧结果未保存对应原句，不能把模型概括当作原文。
        </p>
      )}
    </div>
  )
}
