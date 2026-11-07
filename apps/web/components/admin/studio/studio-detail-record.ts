/** 详情接口把完整对象挂在 `item` 上，`material` 只是去重后的 `{ id }` 别名（服务端为省带宽）。
 * 读取详情一律取字段更全的那个：把只有 id 的别名当成完整对象，标题、平台、正文都会消失。
 * 单独成模块，避免 studio-client ↔ 查询缓存之间的循环引用。 */
type DetailRow = Record<string, unknown> & { id: string }
const row = (value: unknown): DetailRow | null => value && typeof value === 'object' && !Array.isArray(value) ? value as DetailRow : null
export function detailRecord(data: unknown): DetailRow | null {
  const response = row(data)
  const item = row(response?.item), alias = row(response?.material)
  const rich = (value: DetailRow | null): value is DetailRow => !!value && Object.keys(value).length > 1
  if (rich(item)) return item
  if (rich(alias)) return alias
  return item || alias
}
