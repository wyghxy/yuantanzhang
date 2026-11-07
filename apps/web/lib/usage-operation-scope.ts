'use client'

let navigation = new AbortController()

/** Includes in-flight quotes which have not opened a confirmation yet. */
export function cancelNavigationUsage() {
  navigation.abort(new DOMException('操作页面已关闭', 'AbortError'))
  navigation = new AbortController()
}

export function usageOperationSignal(signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, navigation.signal]) : navigation.signal
}

/** One source form owns a quote, its confirmation, and the check before submission. */
export function createUsageOperationScope() {
  let current: AbortController | undefined
  const cancel = () => current?.abort(new DOMException('操作已取消', 'AbortError'))
  return {
    cancel,
    begin() {
      cancel()
      current = new AbortController()
      return usageOperationSignal(current.signal)
    },
  }
}
