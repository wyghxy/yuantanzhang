export const opportunityScoreFields = ['credibilityScore', 'relevanceScore', 'timelinessScore', 'differentiationScore', 'productionScore'] as const
export const opportunityScoreLabels = ['可信度', '相关性', '时效性', '差异化', '可执行性'] as const
export type OpportunityScores = Record<typeof opportunityScoreFields[number], number | null>
export type OpportunitySource = { id: number; title: string; url: string; status: string; channel: string; summary: string | null; tags?: unknown }
export type RankedOpportunityInput = OpportunityScores & {
  id: number; title: string; angle: string; reason: string | null; audienceValue: string | null; createdAt: Date | string
  sourceItem: OpportunitySource | null
  eventCluster: { title: string; summary: string | null; items: { sourceItem: OpportunitySource }[] } | null
}
export type RankingRule = { id: number; title: string; status: string; confirmedAt: Date | string | null; enabled: boolean; priority: number; conditions: unknown }
export type RuleMatch = { id: number; title: string; priority: number }
export type OpportunityRanking = { baseScore: number | null; scoreCount: number; strategyBonus: number; totalScore: number | null; matchedRules: RuleMatch[]; scoringMode: 'manual' }

function normalizedWords(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) return null
  return value.map((entry: string) => entry.trim().toLocaleLowerCase())
}

export function opportunitySources(item: Pick<RankedOpportunityInput, 'sourceItem' | 'eventCluster'>): OpportunitySource[] {
  const sources = [...(item.sourceItem ? [item.sourceItem] : []), ...(item.eventCluster?.items.map((entry) => entry.sourceItem) ?? [])]
  return [...new Map(sources.map((source) => [source.id, source])).values()]
}

export function ruleMatchesOpportunity(rule: RankingRule, item: RankedOpportunityInput): boolean {
  if (rule.status !== 'confirmed' || !rule.confirmedAt || !rule.enabled || !Number.isInteger(rule.priority) || rule.priority < -20 || rule.priority > 20) return false
  if (!rule.conditions || typeof rule.conditions !== 'object' || Array.isArray(rule.conditions)) return false
  const conditions = rule.conditions as Record<string, unknown>
  if (Object.keys(conditions).some((key) => !['keywords', 'channels', 'tags'].includes(key))) return false
  const sources = opportunitySources(item)
  const text = [item.title, item.angle, item.reason, item.audienceValue, item.eventCluster?.title, item.eventCluster?.summary, ...sources.flatMap((source) => [source.title, source.summary])].filter(Boolean).join('\n').toLocaleLowerCase()
  const channels = sources.map((source) => source.channel.toLocaleLowerCase())
  const tags = sources.flatMap((source) => normalizedWords(source.tags) ?? [])
  return ['keywords', 'channels', 'tags'].every((dimension) => {
    if (!(dimension in conditions)) return true
    const words = normalizedWords(conditions[dimension])
    if (!words) return false
    if (!words.length) return true
    return words.some((word) => dimension === 'keywords' ? text.includes(word) : (dimension === 'channels' ? channels : tags).includes(word))
  })
}

export function rankOpportunities<T extends RankedOpportunityInput>(items: T[], rules: RankingRule[]): (T & { ranking: OpportunityRanking })[] {
  return items.map((item) => {
    const scores = opportunityScoreFields.map((field) => item[field]).filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)
    const baseScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null
    const matchedRules = rules.filter((rule) => ruleMatchesOpportunity(rule, item)).map(({ id, title, priority }) => ({ id, title, priority }))
    const strategyBonus = matchedRules.reduce((sum, rule) => sum + rule.priority, 0)
    return { ...item, ranking: { baseScore, scoreCount: scores.length, strategyBonus, totalScore: baseScore === null ? null : baseScore + strategyBonus, matchedRules, scoringMode: 'manual' as const } }
  }).sort((left, right) => {
    if (left.ranking.totalScore === null && right.ranking.totalScore !== null) return 1
    if (right.ranking.totalScore === null && left.ranking.totalScore !== null) return -1
    return (right.ranking.totalScore ?? 0) - (left.ranking.totalScore ?? 0) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || right.id - left.id
  })
}
