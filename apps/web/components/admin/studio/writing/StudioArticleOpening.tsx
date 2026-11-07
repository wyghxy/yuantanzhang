import { Details } from '../StudioUI'
import { text, type RecordData } from '../studio-client'
import { breakdownEvidence, breakdownExcerpt, breakdownView } from './breakdown-view-model'

/** Article openings use saved paragraph evidence, never video time slices or new model calls. */
export function StudioArticleOpening({ analysis }: { analysis: RecordData }) {
  const { hook, lines, sourceLines, points } = breakdownView(analysis)
  const source = breakdownExcerpt(hook, lines, sourceLines)
  const value = (label: string, ...keys: string[]) => points.find(point => text(point.label).includes(label))?.text
    || keys.map(key => analysis[key]).find(item => item !== undefined)
  return <div className="cw-opening-stages">
    {analysis.stale === true && <p role="status">原文已更新，以下为已保存的旧版开篇分析。</p>}
    <section className="cw-opening-stage">
      <header><span>开篇钩子</span></header>
      {source && <blockquote>{text(source.sentence)}<cite>{breakdownEvidence(source)}</cite></blockquote>}
      <Details value={text(hook.reason) || value('钩子', 'hook', 'openingHook') || '尚无独立的开篇判断，可在爆款拆解中查看已保存的分析。'} />
    </section>
    <section className="cw-opening-stage"><header><span>目标读者</span></header><Details value={value('受众', 'audience', 'targetAudience') || '当前拆解未单独保存目标读者分析。'} /></section>
    <section className="cw-opening-stage"><header><span>内容承诺</span></header><Details value={value('承诺', 'promise', 'contentPromise') || '当前拆解未单独保存内容承诺分析。'} /></section>
  </div>
}
