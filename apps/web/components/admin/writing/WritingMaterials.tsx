'use client'
import { useState, type FormEvent } from 'react'
import { FileText, Link2, Upload, Plus, Search } from 'lucide-react'
import { PLATFORM_LABELS, type MaterialView, type WritingAction } from './WritingTypes'
export default function WritingMaterials({ materials, selectedId, select, action, upload, busy }: { materials: MaterialView[]; selectedId: number | null; select: (id: number) => void; action: WritingAction; upload: (form: FormData) => Promise<void>; busy: boolean }) {
  const [mode, setMode] = useState<'link' | 'text' | 'upload'>('link'), [adding, setAdding] = useState(!materials.length), [query, setQuery] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    if (mode === 'upload') await upload(form)
    else { await action('materials', 'POST', Object.fromEntries(form)); setAdding(false) }
  }
  return <aside className="writing-materials">
    <div className="writing-library-heading"><h2>创作素材 <span>({materials.length})</span></h2><button type="button" className="admin-icon-button" aria-label={adding ? '收起素材导入' : '添加素材'} aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={16} /></button></div>
    <div className="intel-search"><Search size={14} /><input aria-label="筛选创作素材" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索素材 / 作者…" /></div>
    <div className="writing-import" hidden={!adding}>
      <div className="writing-segmented" aria-label="导入方式">{([['link', '链接', Link2], ['text', '原文', FileText], ['upload', '上传', Upload]] as const).map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}><Icon size={13} />{label}</button>)}</div>
      <form onSubmit={(e) => { void submit(e).catch(() => {}) }} className="mt-3"><fieldset disabled={busy} className="space-y-3">
        <label className="radar-field"><span>素材标题</span><input name="title" maxLength={240} placeholder="给素材起个名字（选填）" /></label>
        {mode === 'link' && <label className="radar-field"><span>视频链接 / 分享文本</span><textarea name="url" required rows={3} maxLength={5000} placeholder="抖音、B站、小红书或 YouTube" /></label>}
        {mode === 'text' && <label className="radar-field"><span>逐字稿</span><textarea name="transcript" required minLength={20} maxLength={100000} rows={6} placeholder="粘贴原文，保留已有时间戳" /></label>}
        {mode === 'upload' && <label className="radar-field"><span>音视频 · 单个文件最多 250 MB</span><input name="file" type="file" required accept=".mp4,.mov,.webm,.mp3,.wav,.m4a,.ogg" /></label>}
        <button className="radar-primary-button w-full" type="submit">{busy ? '处理中…' : '加入素材'}</button>
      </fieldset></form>
    </div>
    <div className="writing-material-list">{materials.filter((m) => `${m.title} ${m.author || ''}`.toLowerCase().includes(query.toLowerCase())).map((material) => <button key={material.id} type="button" onClick={() => select(material.id)} aria-pressed={selectedId === material.id} className="writing-material-card"><span className="intel-feed-meta"><strong>{PLATFORM_LABELS[material.platform]}</strong><span>{material.author}</span></span><span className="writing-material-title">{material.title}</span><span className="intel-feed-meta"><span className="intel-state">{material.correctedTranscript ? '全文就绪' : '待提取'}</span><span>v{material.revision}</span></span></button>)}</div>
    {!materials.length && <p className="writing-library-empty">把一条好内容收在这里，开始拆解与创作。</p>}
  </aside>
}
