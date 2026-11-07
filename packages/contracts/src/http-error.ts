export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfter?: number) { super(message); this.name = 'HttpError' }
}

export function parseId(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) throw new HttpError(400, '记录 ID 必须为正整数')
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new HttpError(400, '记录 ID 必须为有效正整数')
  return id
}


/** Only exposes static text for the explicitly admitted nonretryable storage failures. */
export function safeMediaCacheDiskFailure(error: unknown): {
  code: string; message: string; status: 507 | 503; retryable: false
} | undefined {
  try {
    if (!(error instanceof Error)) return
    const name = Object.getOwnPropertyDescriptor(error, 'name')?.value
    const code = Object.getOwnPropertyDescriptor(error, 'code')?.value
    const retryable = Object.getOwnPropertyDescriptor(error, 'retryable')?.value
    if (name !== 'MediaStorageError' || retryable !== false) return
    switch (code) {
    case 'media_cache_disk_space':
      return { code, message: '媒体缓存的可用空间不足，无法继续媒体处理。请联系管理员释放空间后重新发起。', status: 507, retryable: false }
    case 'media_cache_disk_inodes':
      return { code, message: '媒体缓存的可用文件数量不足，无法继续媒体处理。请联系管理员释放空间后重新发起。', status: 507, retryable: false }
    case 'media_cache_disk_capacity_unknown':
      return { code, message: '暂时无法确认可用容量，无法继续媒体处理。请联系管理员检查存储配置。', status: 503, retryable: false }
    case 'media_cache_config_invalid':
      return { code, message: '媒体缓存配置无效，无法继续媒体处理。请联系管理员检查存储配置。', status: 503, retryable: false }
    }
  } catch { return }
}
