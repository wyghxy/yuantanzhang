'use client'

import { useState } from 'react'
import StudioFeed from '../StudioFeed'
import StudioAdoptDialog from '../StudioAdoptDialog'
import StudioImport from '../StudioImport'
import { errorText, list, type RecordItem } from '../studio-client'
import { useStudioResource, useStudioSearch } from '../StudioQueryProvider'
import { studioFeedPath } from '../studio-feed-query'
import styles from '../StudioCreationCenter.module.css'

/** Reference browsing remains inside the right pane and never changes the manuscript. */
export function StudioWritingSourceFeed({ close, choose, onChanged, defaultTopic, onAdopt }: {
  close: () => void; choose: (id: string, tab?: string) => void; onChanged?: () => void
  defaultTopic?: RecordItem; onAdopt?: (topic: RecordItem) => void | Promise<void>
}) {
  const [feedMode, setFeedMode] = useState('stream'), [range, setRange] = useState('all')
  const [keyword, setKeyword] = useState(''), [status, setStatus] = useState('all')
  const [offset, setOffset] = useState(0), [sample, setSample] = useState('all')
  const [author, setAuthor] = useState('all'), [error, setError] = useState('')
  const [adopting, setAdopting] = useState<RecordItem | null>(null), [importText, setImportText] = useState<string | null>(null)
  const search = useStudioSearch(keyword)
  const feed = useStudioResource(studioFeedPath({ range, offset: String(offset), q: search, platform: 'all', transcriptStatus: status, accountId: author, sample }))
  const accountQuery = useStudioResource('accounts?projection=summary&limit=200&sample=all')
  const items = list(feed.data?.items), accounts = list(accountQuery.data?.items), total = feed.data ? Number(feed.data.total) : null, loading = feed.isPending
  const changed = () => { void feed.refetch(); onChanged?.() }
  return <div className={styles.workspace}><div className={styles.feed}>
    <StudioFeed total={total} feedMode={feedMode} setFeedMode={setFeedMode} range={range} setRange={setRange}
      keyword={keyword} setKeyword={setKeyword} status={status} setStatus={setStatus}
      offset={offset} setOffset={setOffset} sample={sample} setSample={setSample}
      author={author} setAuthor={setAuthor} accounts={accounts} items={items}
      error={error || (feed.error || accountQuery.error ? errorText(feed.error || accountQuery.error) : '')} loading={loading} changed={changed} setImportText={setImportText}
      selectView={close} openMaterial={choose} onAdopt={setAdopting}
      referenceBrowser headerAction={<button className="btn ghost" onClick={close}>返回参考素材</button>} />
    {adopting && <StudioAdoptDialog material={adopting} defaultTopic={defaultTopic} close={() => setAdopting(null)} onSaved={async topic => { await onAdopt?.(topic); setAdopting(null); changed() }} />}
    {importText !== null && <StudioImport initial={importText} close={() => setImportText(null)}
      notify={setError} onTask={() => { setImportText(null); changed() }}
      onCreated={(kind, id) => { setImportText(null); changed(); if (kind === 'materials') choose(id) }} />}
  </div></div>
}
