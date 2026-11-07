const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

export function beijingDateInput(value: string | null): string {
  if (!value) return ''
  return new Date(new Date(value).getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 16)
}

export function beijingInputToIso(value: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value)) throw new Error('请输入有效的北京时间')
  const date = new Date(`${value}+08:00`)
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 16) !== value.slice(0, 16)) throw new Error('请输入有效的北京时间')
  return date.toISOString()
}

export function displayBeijingTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hourCycle: 'h23' })
}
