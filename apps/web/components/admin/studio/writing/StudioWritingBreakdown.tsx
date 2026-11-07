'use client'

import { useId, useRef } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { ChevronDown, Info, Sparkles } from 'lucide-react'
import {
  writingText as text,
  type WritingRecord,
} from '../studio-writing-model'
import {
  breakdownHooks,
  breakdownRoles,
  breakdownView,
} from './breakdown-view-model'
import { BreakdownSourceButton } from './BreakdownSourceButton'
import { BreakdownOriginal, paragraphLabel } from './BreakdownOriginal'
import styles from './BreakdownReport.module.css'

function TextList({ value }: { value: unknown }) {
  const items = Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim())
    : []
  return (
    <ul className={styles.textList}>
      {items.map((item, index) => (
        <li key={index}>{String(item)}</li>
      ))}
    </ul>
  )
}

/** Saved analysis only. Viewing and navigation never invoke a model. */
export function StudioWritingBreakdown({
  analysis,
  source,
}: {
  analysis: WritingRecord
  source?: { materialId: string; title?: string; version: number }
}) {
  const {
    points,
    lines,
    sourceLines,
    totalParagraphs,
    drivers,
    hook,
    beats,
    golden,
  } = breakdownView(analysis)
  const root = useRef<HTMLElement>(null),
    prefix = useId()
  const point = (label: string) =>
    points.find((row) => text(row.label) === label)
  const audience = point('目标受众') || point('受众'),
    promise = point('内容承诺')
  const problems = lines.filter((row) => text(row.role) === 'problem')
  const stages: WritingRecord[] = beats.length
    ? beats
    : lines.map((row) => ({ ...row, text: row.reason }))
  const analyzedIds = new Set(
    stages.flatMap((row) =>
      Array.isArray(row.paragraphIds) ? row.paragraphIds : [],
    ),
  )
  const partial =
    totalParagraphs !== undefined && analyzedIds.size < totalParagraphs
  const canWrite = Boolean(
    source?.materialId &&
      Number.isSafeInteger(source.version) &&
      source.version > 0 &&
      analysis.stale !== true,
  )
  function write() {
    if (!canWrite) return
    window.dispatchEvent(
      new CustomEvent('studio-ai-open', {
        detail: {
          intent: 'structure',
          sourceMaterialId: source?.materialId,
          sourceTitle: source?.title,
          sourceVersion: source?.version,
          sourceAnalysisFingerprint: text(analysis.fingerprint) || undefined,
        },
      }),
    )
  }
  function locateStage(index: number) {
    const target = root.current?.querySelector<HTMLElement>(
      `[id="${prefix}-stage-${index}"]`,
    )
    let panel = root.current?.parentElement || null
    while (panel && !/(auto|scroll)/.test(getComputedStyle(panel).overflowY))
      panel = panel.parentElement
    if (target && panel) {
      const toolbar = root.current?.querySelector<HTMLElement>(
        '[data-breakdown-tabs]',
      )
      panel.scrollTo({
        top:
          panel.scrollTop +
          target.getBoundingClientRect().top -
          panel.getBoundingClientRect().top -
          (toolbar?.getBoundingClientRect().height || 0) -
          16,
        behavior: 'instant',
      })
    } else target?.scrollIntoView({ block: 'start', behavior: 'instant' })
    target?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
  }
  const original = (row: WritingRecord) => (
    <BreakdownOriginal
      row={row}
      lines={lines}
      sourceLines={sourceLines}
      analysis={analysis}
      source={source}
    />
  )
  return (
    <article
      ref={root}
      className={styles.report}
      aria-label="爆款文案拆解"
      data-component-ui
    >
      <Tabs.Root defaultValue="structure" className={styles.tabs}>
        <div className={styles.toolbar} data-breakdown-tabs>
          <Tabs.List className={styles.tabList} aria-label="拆解视图">
            <Tabs.Trigger value="structure" className={styles.tab}>
              全文
            </Tabs.Trigger>
            <Tabs.Trigger value="hook" className={styles.tab}>
              钩子
            </Tabs.Trigger>
            <Tabs.Trigger value="pain" className={styles.tab}>
              痛点
            </Tabs.Trigger>
            <Tabs.Trigger value="expression" className={styles.tab}>
              金句
            </Tabs.Trigger>
            <Tabs.Trigger value="writing" className={styles.tab}>
              借鉴
            </Tabs.Trigger>
          </Tabs.List>
          <details className={styles.scope}>
            <summary aria-label="分析范围说明">
              <Info size={15} aria-hidden="true" />
            </summary>
            <div>
              <p>基于已保存文本分析，传播效果未验证。</p>
              {totalParagraphs === undefined ? (
                <p>旧结果未保存原文总段数，覆盖范围未确认。</p>
              ) : (
                <p>
                  原文 {totalParagraphs} 段，结构覆盖 {analyzedIds.size} 段。
                  {partial && '结构尚未覆盖全部原文，未覆盖部分不作判断。'}
                </p>
              )}
              <TextList value={analysis.limitations} />
            </div>
          </details>
        </div>
        <Tabs.Content value="structure" className={styles.panel}>
          {text(analysis.summary) && (
            <p className={styles.summary}>{text(analysis.summary)}</p>
          )}
          <div className={styles.sectionTitle}>
            <h2>
              {totalParagraphs === undefined
                ? '已保存的结构'
                : partial
                  ? '已拆解的结构'
                  : '文章结构'}
            </h2>
            {!!stages.length && (
              <select
                aria-label="跳到结构段"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value !== '')
                    locateStage(Number(event.target.value))
                }}
              >
                <option value="" disabled>
                  跳到段落
                </option>
                {stages.map((stage, index) => (
                  <option key={index} value={index}>
                    {index + 1}.{' '}
                    {text(stage.title) ||
                      breakdownRoles[text(stage.role)] ||
                      '内容推进'}
                  </option>
                ))}
              </select>
            )}
          </div>
          {totalParagraphs === undefined ? (
            <p className={styles.empty}>
              旧结果未保存原文总段数，覆盖范围未确认。
            </p>
          ) : (
            partial && (
              <p className={styles.empty}>
                仅覆盖 {analyzedIds.size}/{totalParagraphs}{' '}
                段，未覆盖部分不作判断。
              </p>
            )
          )}
          <div className={styles.stages}>
            {stages.map((stage, index) => {
              const matching = lines.find(
                (line) =>
                  JSON.stringify(line.paragraphIds) ===
                  JSON.stringify(stage.paragraphIds),
              )
              const explanation = text(stage.text) || text(stage.reason)
              return (
                <section
                  className={styles.stage}
                  id={`${prefix}-stage-${index}`}
                  key={index}
                >
                  <header className={styles.stageHeader}>
                    <span className={styles.number}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 tabIndex={-1}>
                      {text(stage.title) ||
                        breakdownRoles[text(stage.role)] ||
                        '内容推进'}
                    </h3>
                  </header>
                  {original(stage)}
                  <div className={styles.explanation}>
                    <h4>分析</h4>
                    <p>{explanation || '当前结果未解释本段作用。'}</p>
                    {text(matching?.reason) &&
                      text(matching?.reason) !== explanation && (
                        <p>{text(matching?.reason)}</p>
                      )}
                  </div>
                </section>
              )
            })}
          </div>
          {!stages.length && (
            <p className={styles.empty}>这份旧结果未保存逐段结构。</p>
          )}
        </Tabs.Content>
        <Tabs.Content value="hook" className={styles.panel}>
          <section className={styles.stage}>
            <header className={styles.stageHeader}>
              <h3>{breakdownHooks[text(hook.type)] || '开头钩子'}</h3>
            </header>
            {original(hook)}
            <div className={styles.explanation}>
              <h4>分析</h4>
              <p>{text(hook.reason) || '当前结果未单独分析开头。'}</p>
            </div>
          </section>
        </Tabs.Content>
        <Tabs.Content value="pain" className={styles.panel}>
          {problems.map((row, index) => (
            <section className={styles.stage} key={index}>
              <header className={styles.stageHeader}>
                <h3>读者的问题</h3>
              </header>
              {original(row)}
              <div className={styles.explanation}>
                <h4>分析</h4>
                <p>{text(row.reason) || '当前结果未解释这个问题。'}</p>
              </div>
            </section>
          ))}
          {!problems.length && (
            <p className={styles.empty}>当前结果未单列痛点，不强行补设。</p>
          )}
          {[audience, promise]
            .filter((row): row is WritingRecord => !!row)
            .map((row, index) => (
              <section className={styles.stage} key={index}>
                <header className={styles.stageHeader}>
                  <h3>{row === audience ? '受众' : '内容价值'}</h3>
                </header>
                {original(row)}
                <div className={styles.explanation}>
                  <h4>分析</h4>
                  <p>{text(row.text)}</p>
                </div>
              </section>
            ))}
        </Tabs.Content>
        <Tabs.Content value="expression" className={styles.panel}>
          {golden.map((quote, index) => (
            <section className={styles.stage} key={index}>
              <header className={styles.stageHeader}>
                <h3>{text(quote.technique) || '原文表达'}</h3>
              </header>
              <div className={styles.original}>
                <div className={styles.originalHeading}>
                  <h4>原句</h4>
                  <span>{paragraphLabel(quote)}</span>
                  <BreakdownSourceButton
                    analysis={analysis}
                    source={source}
                    row={quote}
                    sentence
                    compact
                  />
                </div>
                <blockquote>{text(quote.quote)}</blockquote>
              </div>
              <div className={styles.explanation}>
                <h4>分析</h4>
                <p>{text(quote.reason) || '当前结果未解释表达作用。'}</p>
              </div>
              {text(quote.reusable) && (
                <p className={styles.takeaway}>借鉴：{text(quote.reusable)}</p>
              )}
            </section>
          ))}
          {!golden.length && (
            <p className={styles.empty}>当前结果未提取金句。</p>
          )}
          {!!drivers.length && (
            <>
              <div className={styles.sectionTitle}>
                <h2>表达亮点</h2>
              </div>
              {drivers.map((driver, index) => (
                <section className={styles.stage} key={index}>
                  <header className={styles.stageHeader}>
                    <h3>{text(driver.title)}</h3>
                  </header>
                  {original(driver)}
                  <div className={styles.explanation}>
                    <h4>分析</h4>
                    <p>{text(driver.reason)}</p>
                  </div>
                </section>
              ))}
            </>
          )}
        </Tabs.Content>
        <Tabs.Content value="writing" className={styles.panel}>
          <section className={styles.writingSection}>
            <h3>可借鉴</h3>
            <TextList value={analysis.reusable} />
          </section>
          <section className={styles.writingSection}>
            <h3>写作角度</h3>
            <TextList value={analysis.angles} />
          </section>
          <details className={styles.appendix}>
            <summary>
              不能照搬
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <TextList value={analysis.forbidden} />
          </details>
          <button
            type="button"
            className={styles.writeButton}
            disabled={!canWrite}
            onClick={write}
          >
            <Sparkles size={15} aria-hidden="true" />
            按此结构帮写
          </button>
        </Tabs.Content>
      </Tabs.Root>
      {!!points.length && (
        <details className={styles.appendix}>
          <summary>
            更多分析
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          {points.map((row, index) => (
            <section key={index}>
              <h3>{text(row.label)}</h3>
              <p>{text(row.text)}</p>
              {original(row)}
            </section>
          ))}
        </details>
      )}
    </article>
  )
}
