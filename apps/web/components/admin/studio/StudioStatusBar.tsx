'use client'

/**
 * 工作台底部状态条。
 *
 * 从 StudioWorkbench 里整块抽出来的：那一段是一行 458 字符的内联 JSX，
 * 格式化后要占二十多行，把主文件顶到 910 行（闸门 900）。这里只搬位置，
 * 判定文案、按钮启用条件和三个回调全部原样来自父组件。
 */
export default function StudioStatusBar(props: {
  /** 任务读取失败的原文；空串表示没有错误。 */
  error: string
  pending: boolean
  status?: string
  message: string
  taskId: string | null
  /** 首次读取任务失败的原因；同样用空串表示没有错误。 */
  initialTaskError: string
  active: boolean
  onRetry: () => void
  onOpenLog: () => void
  onStop: () => void
}) {
  const label = props.error ? '任务读取失败' : props.pending ? '正在读取任务状态' : props.status || '准备就绪'
  return (
    <footer className="statusbar">
      <span className="status-dot" />
      <strong>{label}</strong>
      <span className="status-separator">/</span>
      <span className="status-task-message">{props.message}</span>
      {!props.taskId && props.initialTaskError && <button onClick={props.onRetry}>重试读取状态</button>}
      <button onClick={props.onOpenLog}>查看运行日志</button>
      <button className="stop-task" disabled={!props.active} onClick={props.onStop}>停止任务</button>
    </footer>
  )
}
