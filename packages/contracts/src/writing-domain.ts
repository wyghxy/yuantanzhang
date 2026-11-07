export const WRITING_TEMPLATES = { tutorial: 'AI 工具实操', news: '热点解读', correction: '观点纠偏', case: '案例拆解' } as const
export type WritingKind = 'transcribe' | 'analyze' | 'draft' | 'rewrite' | 'storyboard'
export type WritingPlatform = 'douyin' | 'bilibili' | 'xiaohongshu' | 'youtube' | 'tiktok' | 'text' | 'upload'
export interface WritingProfile { positioning: string; audience: string; phrases: string; avoid: string; cases: string }
export interface WritingConfig { template: keyof typeof WRITING_TEMPLATES; audience: string; angle: string; ownCases: string; duration: number; style: string; purpose: string; language: string }
export interface WritingSegment { id: string; role: string; narration: string; visualNotes: string; seconds: number }
export interface WritingDocument { title: string; titles: string[]; hooks: string[]; segments: WritingSegment[]; facts: { text: string; sourceItemIds: number[] }[]; missing: string[] }
export interface AnalysisPoint { label: string; text: string; paragraphIds: number[] }
export interface WritingAnalysis { summary: string; points: AnalysisPoint[]; reusable: string[]; forbidden: string[]; angles: string[]; limitations: string[] }
export const DEFAULT_PROFILE: WritingProfile = { positioning: '元探长：用实际案例讲清 AI 工具、方法与能力边界。', audience: '希望把 AI 用到实际工作中的中文用户', phrases: '', avoid: '夸大效果、编造本人经历、保证收益', cases: '' }
export const DEFAULT_WRITING_CONFIG: WritingConfig = { template: 'tutorial', audience: DEFAULT_PROFILE.audience, angle: '', ownCases: '', duration: 90, style: '清楚、口语化，有具体例子', purpose: '给出一个可以尝试的下一步', language: '简体中文' }
export const JOB_LABELS: Record<WritingKind, string> = { transcribe: '提取与转写', analyze: '拆解原文', draft: '生成口播稿', rewrite: '修改候选稿', storyboard: '生成导演分镜' }
export function narration(doc: WritingDocument) { return doc.segments.map((s) => s.narration).join('\n\n') }
export function exportWriting(doc: WritingDocument, format: 'markdown' | 'teleprompter') {
  if (format === 'teleprompter') return narration(doc) + '\n'
  return `# ${doc.title}\n\n` + doc.segments.map((s) => `## ${s.id} · ${s.role}\n\n${s.narration}\n\n> 画面：${s.visualNotes || '待补充'}\n> 预计 ${s.seconds} 秒（拍摄参考）`).join('\n\n') + '\n'
}
export function paragraphs(text: string) { return text.split(/\n+/).map((s) => s.trim()).filter(Boolean).map((text, i) => ({ id: i + 1, text })) }
export function estimatedSeconds(text: string, charsPerMinute = 260) { return Math.ceil(text.replace(/\s/g, '').length / charsPerMinute * 60) }
