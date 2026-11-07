/**
 * 抓取条数是操作者自己的本地偏好：行内选择和之后的单账号抓取共用同一个数字。
 * 服务端仍按 1—100 校验（studio-collection-policy），这里只负责给出可选的整档位。
 */
const STORAGE_KEY = 'ytz.studio.capture-limit'

export const CAPTURE_LIMIT_OPTIONS = [3, 5, 10, 20, 50, 100] as const
export const DEFAULT_CAPTURE_LIMIT = 5

let remembered = DEFAULT_CAPTURE_LIMIT
const listeners = new Set<() => void>()

export function captureLimit(value: unknown) {
  const limit = Number(value)
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100 ? limit : DEFAULT_CAPTURE_LIMIT
}

export function storedCaptureLimit() {
  if (typeof window === 'undefined') return remembered
  try {
    return captureLimit(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return remembered
  }
}

/** Local storage is the external store; React reads it instead of copying it into state. */
export function subscribeCaptureLimit(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function rememberCaptureLimit(limit: number) {
  remembered = captureLimit(limit)
  try {
    window.localStorage.setItem(STORAGE_KEY, String(remembered))
  } catch {
    // 隐私模式或浏览器禁用存储时，只在本次页面内生效。
  }
  for (const listener of listeners) listener()
}
