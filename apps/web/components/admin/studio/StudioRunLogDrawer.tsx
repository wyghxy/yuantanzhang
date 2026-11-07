'use client'
import { X } from 'lucide-react'
import { object, text, type RecordData } from './studio-client'

/**
 * 任务运行日志抽屉。
 *
 * 同样是从 StudioWorkbench 整块抽出来的：那一段是一行 458 字符的内联 JSX，
 * 格式化后要占十来行。判定顺序原样保留：先看任务错误，再看已合并的事件流，
 * 最后才是「暂无任务日志 / 正在读取任务日志…」两种空态。
 */
export default function StudioRunLogDrawer(props: {
  error: string
  events: RecordData[]
  loaded: boolean
  onClose: () => void
}) {
  const body = props.error ||
    props.events.map(row => `${text(row.createdAt)} ${text(object(row.data).message || row.event)}`).join('\n') ||
    (props.loaded ? '暂无任务日志' : '正在读取任务日志…')
  return (
    <aside className="drawer open" aria-label="运行日志">
      <header>
        <strong>运行日志</strong>
        <button className="dialog-close-btn" onClick={props.onClose} aria-label="关闭日志"><X size={16} /></button>
      </header>
      <div className="log-box">{body}</div>
    </aside>
  )
}
