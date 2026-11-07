'use client'

import { CollectionMediaIcon } from './StudioCollectionDetail'

export default function StudioCollectionEmpty({ loading, deleted, filtered, completeMode }: {
  loading: boolean; deleted: boolean; filtered: boolean; completeMode: boolean
}) {
  return <div className="library-empty" role={loading ? 'status' : undefined}><CollectionMediaIcon /><h3>{loading ? '正在读取采集仓库…' : deleted ? '没有已删除的作品' : filtered ? '没有匹配的作品' : completeMode ? '暂无已完成作品' : '还没有采集作品'}</h3>{!loading && !deleted && <p>{filtered ? '试试其他关键词，或清除筛选。' : '作品按采集设置收录，可前往任务队列查看进度。'}</p>}</div>
}
