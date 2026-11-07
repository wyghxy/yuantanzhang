type Task = Record<string, unknown>
const object = (value: unknown): Task => value && typeof value === 'object' && !Array.isArray(value) ? value as Task : {}
const scheduleTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** This is presentation only. Actions are explicit. */
export function studioMetricFollowupView(task: Task, now = Date.now()) {
  const days = Number(task.followupDays ?? object(task.input).followupDays)
  if (task.kind !== 'metrics' || (days !== 3 && days !== 7)) return null
  const due = typeof task.notBefore === 'string' ? Date.parse(task.notBefore) : NaN
  const future = Number.isFinite(due) && due > now
  const awaitingAuthorization = task.status === 'blocked' && task.phase === '等待派生任务确认' && task.attempt === 0
  const planned = task.status === 'queued' && future
  const status = awaitingAuthorization ? '待授权' : planned ? '等待计划时间'
    : task.status === 'queued' ? '等待回访' : task.status === 'running' ? '回访中'
      : task.status === 'succeeded' ? '回访完成' : task.status === 'cancelled' ? '回访已停止'
        : task.status === 'failed' ? '回访失败' : '回访需处理'
  const schedule = Number.isFinite(due) ? `${future ? '计划' : '原计划'} ${scheduleTime.format(due)}（北京时间）` : '计划时间见任务详情'
  const hint = awaitingAuthorization
    ? `独立更新作品指标，不影响已保存的正文与视频。确认后${future ? '，到计划时间再执行' : '可补采当前指标'}。`
    : '独立更新作品指标，不计入正文采集进度；已保存的正文与视频可照常使用。'
  return { days, title: `T+${days} 指标回访`, status, awaitingAuthorization, planned, schedule, hint }
}

export function studioCollectionTaskGroups<T extends Task>(tasks: T[]) {
  return { content: tasks.filter(task => !studioMetricFollowupView(task)), followups: tasks.filter(task => studioMetricFollowupView(task)) }
}
