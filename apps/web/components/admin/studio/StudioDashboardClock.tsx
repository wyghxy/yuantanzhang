'use client'
import { useSyncExternalStore } from 'react'

const timeFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dateFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'long' })
const currentMinute = () => Math.floor(Date.now() / 60000)
const serverMinute = () => null
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 1000)
  return () => window.clearInterval(timer)
}
export default function StudioDashboardClock() {
  const minute = useSyncExternalStore<number | null>(subscribe, currentMinute, serverMinute)
  const now = minute === null ? null : new Date(minute * 60000)
  const parts = now ? dateFormat.formatToParts(now) : []
  const part = (type: string) => parts.find(value => value.type === type)?.value || ''
  return <div className="heading-tools" id="dashClock" role="group" aria-label="日期时间，北京时间">
    <div className="context-meta">{now ? part('month') + '月' + part('day') + '日 · ' + part('weekday') : '日期读取中'}</div>
    <div className="context-readout"><div className="clock"><time dateTime={now?.toISOString()}>{now ? timeFormat.format(now) : '--:--'}</time></div></div>
  </div>
}
