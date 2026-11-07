'use client'
import { useState } from 'react'
import {
  breakdownSourceBinding,
  requestBreakdownSource,
} from './breakdown-source-location'
import { breakdownEvidence } from './breakdown-view-model'
import type { WritingRecord } from '../studio-writing-model'

export function BreakdownSourceButton({
  analysis,
  source,
  row,
  sentence = false,
  compact = false,
}: {
  analysis: WritingRecord
  source?: { materialId: string; version: number }
  row: WritingRecord
  sentence?: boolean
  compact?: boolean
}) {
  const key = JSON.stringify([
    source,
    analysis.fingerprint,
    row.paragraphIds,
    row.quote,
  ])
  const [result, setResult] = useState<{
    key: string
    busy: boolean
    notice: string
  } | null>(null)
  return (
    <>
      <button
        type="button"
        className={compact ? undefined : 'btn ghost'}
        disabled={result?.key === key && result.busy}
        aria-label={`${sentence ? '定位本句' : '查看原文'}：${breakdownEvidence(row)}`}
        onClick={async (event) => {
          const trigger = event.currentTarget
          setResult({ key, busy: true, notice: '' })
          try {
            const binding = breakdownSourceBinding(analysis, source, row)
            const problem = await requestBreakdownSource(binding, trigger)
            setResult({
              key,
              busy: false,
              notice: problem || '已定位原文；高亮仅用于本次阅读。',
            })
          } catch (error) {
            setResult({
              key,
              busy: false,
              notice:
                error instanceof Error
                  ? error.message
                  : '暂时无法定位，已保留冻结引用。',
            })
          }
        }}
      >
        {sentence
          ? '定位本句'
          : compact
            ? '定位'
            : `${breakdownEvidence(row)} · 查看原文`}
      </button>
      {result?.key === key && result.notice && (
        <p role="status">{result.notice}</p>
      )}
    </>
  )
}
