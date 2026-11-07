'use client'

import { useMemo } from 'react'
import { list, text, type RecordData } from './studio-client'
import { Details } from './StudioUI'
import s from './StudioWorkbench.module.css'

// Reader and writing references render the same persisted analysis contract.
export function StudioAnalysisResult({ analysis, transcript }: { analysis: RecordData; transcript: string }) {
  const points = list(analysis.points)
  const rows = list(analysis.lineByLine).length ? list(analysis.lineByLine) : points
  const cited = useMemo(() => transcript.split(/\n+/).map(line => line.trim()).filter(Boolean), [transcript])
  const roles: Record<string, string> = { hook: '开头', problem: '问题', concept: '概念', solution: '解决方案', proof: '依据', bonus: '补充价值', cta: '行动引导', other: '其他' }
  const analysisValue = (label: string, ...keys: string[]): unknown => {
    const point = points.find(point => text(point.label).includes(label))
    return point ? point.text : keys.map(key => analysis[key]).find(value => value !== undefined)
  }
  return (
        <>
          <div className="insight-card">
            <div className="insight-badge">🎯 开篇黄金钩子</div>
            <Details value={analysisValue('钩子', 'hook', 'openingHook')} />
            <Details value={analysisValue('受众', 'audience', 'targetAudience')} />
            <Details value={analysisValue('承诺', 'promise', 'contentPromise')} />
          </div>
          <div className="insight-card">
            <div className="insight-badge" style={{ marginBottom: 10 }}>
              🪜 逐句职能拆解与原文依据
            </div>
            <div
              className="table-wrap"
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: 38 }}>#</th>
                    <th style={{ width: 55 }}>时间</th>
                    <th style={{ minWidth: 180 }}>逐字稿原句</th>
                    <th style={{ minWidth: 140 }}>句子职能</th>
                    <th style={{ minWidth: 140 }}>画面配合建议</th>
                    <th style={{ minWidth: 130 }}>可复用判断</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((point, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{text(point.timestamp) || '未取得时间戳'}</td>
                        <td>
                          {Array.isArray(point.paragraphIds) ? (
                            point.paragraphIds.map((pid, j) => {
                              const source = analysis.stale === true ? null : cited[Number(pid) - 1]
                              return (
                                <p key={j}>{source || `原文段落 ${text(pid)}（请切换原文核对）`}</p>
                              )
                            })
                          ) : (
                            <Details
                              value={point.quote || point.sourceQuote || point.sourceSegments}
                            />
                          )}
                        </td>
                        <td>
                          <strong>{roles[text(point.role)] || text(point.label)}</strong>
                          <Details value={point.reason || point.text} />
                        </td>
                        <td>
                          <Details
                            value={point.visual || point.visualSuggestion || '未提供画面分析'}
                          />
                        </td>
                        <td>
                          <Details
                            value={point.reusable || point.reuseJudgment || '未提供逐句判断'}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <Details
                          value={
                            analysis.lineByLine ||
                            analysis.evidence ||
                            analysis.sourceSegments ||
                            '本版拆解没有逐句时间轴，未生成推测时间。'
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-badge">🔄 起承转合结构推进与奖励节奏</div>
            <Details value={analysisValue('结构', 'structureProgression', 'structure', 'progressionBeats')} />
            <Details value={analysisValue('论据', 'evidence')} />
            <Details value={analysisValue('行动', 'cta', 'callToAction')} />
          </div>
          <div className="insight-card">
            <div className="insight-badge">💎 可复用机制与避坑清单 (Do’s & Don’ts)</div>
            <div
              className="original-insight-columns"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  background: 'var(--ui-success-bg)',
                  border: '1px solid var(--ui-success)',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                <strong style={{ fontSize: 12.5, color: 'var(--ui-success)' }}>
                  ✓ 推荐借鉴的核心机制
                </strong>
                <Details value={analysis.reusable || analysis.reusableMechanisms} />
              </div>
              <div
                style={{
                  background: 'var(--ui-danger-bg)',
                  border: '1px solid var(--ui-danger)',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                <strong style={{ fontSize: 12.5, color: 'var(--ui-danger)' }}>
                  ✕ 严禁硬搬的专属内容
                </strong>
                <Details value={analysis.forbidden || analysis.avoid || analysis.cannotCopy} />
              </div>
            </div>
          </div>
          <details className="original-record-tools">
            <summary>元探长切入点与分析范围</summary>
            <Details value={analysis.angles || analysis.suggestedAngles || analysis.angle} />
            <Details value={analysis.limitations || analysis.scope || analysis.warnings} />
            <Details value={analysis.handoff} />
            <p className={s.meta}>
              仅展示保存结果中的原文依据；画面、评论或指标未取得时，不推测补齐。
            </p>
          </details>
        </>
  )
}
