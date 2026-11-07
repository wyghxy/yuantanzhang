import { playbackTranscript } from '@ytz/contracts/studio-playback'
import { originalPublication } from '@ytz/contracts/studio-radar'

type Item = Record<string, unknown>
const object = (value: unknown): Item => value && typeof value === 'object' && !Array.isArray(value) ? value as Item : {}
const text = (value: unknown) => typeof value === 'string' ? value : ''
const rows = (value: unknown): Item[] => Array.isArray(value) ? value.map(object) : []

export type SourcePlanShot = { id: string; time: string; speech: string; visual: string; assets: string }
export type SourceVisualPlan = { title: string; inputBody: string; candidateId: string; shots: SourcePlanShot[] }

export function readSourcePlan(value: unknown): SourceVisualPlan | null {
  const plan = object(value)
  if (typeof plan.inputBody !== 'string' || !Array.isArray(plan.shots)) return null
  const shots = rows(plan.shots).filter(shot => typeof shot.speech === 'string').map(shot => ({
    id: text(shot.id), time: text(shot.time), speech: text(shot.speech), visual: text(shot.visual), assets: text(shot.assets),
  }))
  return { title: text(plan.title), inputBody: plan.inputBody, candidateId: text(plan.candidateId), shots }
}

// Adapt the existing storyboard result into the source UI's model. The draft
// body stays separate: completing a background task must never replace typing.
export function sourcePlanFromCandidate(candidate: Item, context: { title: string; inputBody: string }): SourceVisualPlan | null {
  const segments = rows(object(object(candidate.output).document).segments)
  if (!segments.length || segments.some(segment => typeof segment.narration !== 'string')) return null
  let seconds = 0
  const format = (value: number) => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0')
  const shots = segments.map((segment, index) => {
    const start = seconds
    const duration = Number(segment.seconds)
    seconds += Number.isFinite(duration) && duration > 0 ? Math.ceil(duration) : Math.max(3, Math.ceil(Array.from(text(segment.narration).replace(/\s/g, '')).length / 4))
    return {
      id: text(segment.id) || 'S' + String(index + 1).padStart(2, '0'),
      time: format(start) + '–' + format(seconds),
      speech: text(segment.narration), visual: text(segment.visualNotes), assets: text(segment.assets),
    }
  })
  return { ...context, candidateId: text(candidate.id), shots }
}

export function sourcePlanText(plan: SourceVisualPlan | null): string {
  return plan ? plan.title + '\n预估时段\n\n' + plan.shots.map(shot =>
    shot.time + ' · ' + shot.id + '\n文案：' + shot.speech + '\n画面：' + shot.visual + '\n素材：' + shot.assets,
  ).join('\n\n') : ''
}

export function sourceAnalysisDetail(recognition: unknown, transcript: string, publication?: unknown, sourceRef?: unknown) {
  const timed = playbackTranscript(recognition), original = originalPublication(publication, sourceRef)
  return { original, stages: [2, 5].map(seconds => {
    const paragraphs = timed.paragraphs.filter(line => line.startMs < seconds * 1000)
    let boundary = false
    const quotes = paragraphs.map(line => {
      if (!line.tokens.length) {
        if (line.endMs > seconds * 1000) boundary = true
        return `${line.startMs / 1000}–${line.endMs / 1000} 秒：${line.text}`
      }
      const tokens = line.tokens.filter(token => token.startMs < seconds * 1000)
      if (tokens.some(token => token.endMs > seconds * 1000)) boundary = true
      return tokens.map(token => token.text).join('')
    }).filter(Boolean)
    const precision = (!timed.paragraphs.length ? '未取得转写时间，不能定位该时段。' : boundary
      ? '边界跨过该时段，保留完整词句；不是精确截取。'
      : timed.precision === 'word' ? '依据原始逐词转写时间。' : '依据原始句级转写时间。') +
      (timed.untimedText?.length ? '部分正文缺少有效时间，不能确认该时段文字完整。' : '')
    const body = quotes.join('\n') || (timed.paragraphs.length ? '该时段没有可定位的转写文字。'
      : '未取得该时段原文。' + (transcript.trim() ? '\n未定位的正文开头：\n' + transcript.trim().slice(0, 300) : '请先补齐正文。'))
    return { time: seconds + ' 秒', title: '原文前 ' + seconds + ' 秒', rows: [['原文', body], ['时间依据', precision]] }
  }) }
}
