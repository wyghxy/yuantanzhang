'use client'

import { useEffect, useRef, useState } from 'react'
import { api, errorText, type RecordItem } from './studio-client'
import { transcriptText } from './StudioMaterialHelpers'
import { requireStudioActivation } from './studio-preview'
import { Field, Modal } from './StudioUI'
import { invalidateStudioQueries } from './studio-query-cache'
import s from './StudioWorkbench.module.css'

export default function StudioMaterialRecovery({ material, close, onSaved, notify }: {
  material: RecordItem; close: () => void; onSaved: () => void; notify: (message: string) => void
}) {
  const [body, setBody] = useState(transcriptText(material.transcript))
  const textChanged = body !== transcriptText(material.transcript)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null)
  const active = useRef(false), xhr = useRef<XMLHttpRequest | null>(null)
  useEffect(() => () => xhr.current?.abort(), [])
  function complete(message: string) { invalidateStudioQueries('materials/' + material.id); onSaved(); notify(message); close() }
  async function saveText() {
    if (active.current) return
    active.current = true; setBusy(true); setError('')
    try {
      await api('materials/' + encodeURIComponent(material.id), 'PATCH', { expectedVersion: material.version, transcript: { corrected: body } })
      complete('正文已保存，来源原文与历史版本保留。')
    } catch (cause) { setError(errorText(cause)) }
    finally { active.current = false; setBusy(false) }
  }
  function upload(file: File) {
    if (active.current) return
    if (textChanged) { setError('请先保存正文，再上传原视频'); return }
    try { requireStudioActivation() } catch (cause) { setError(errorText(cause)); return }
    if (!/\.(mp4|mkv|mov|webm)$/i.test(file.name) || !file.size || file.size > 200 * 1024 * 1024) {
      setError('请选择非空的 MP4、MKV、MOV 或 WebM 原视频，最大 200 MiB'); return
    }
    active.current = true; setBusy(true); setError(''); setProgress(0)
    const request = new XMLHttpRequest(); xhr.current = request
    request.open('POST', '/api/workspace/studio/uploads?' + new URLSearchParams({ materialId: material.id, expectedVersion: String(material.version) }))
    request.setRequestHeader('X-Studio-Filename', encodeURIComponent(file.name))
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    const finish = () => { active.current = false; setBusy(false); xhr.current = null }
    request.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => {
      finish()
      try {
        const data = JSON.parse(request.responseText)
        if (request.status >= 400) throw new Error(data.error || '上传未完成')
        complete('原视频已保存到这篇作品；请回到待处理，点击封面任务的“重试”。')
      } catch (cause) { setError(errorText(cause)) }
    }
    request.onerror = () => { finish(); setError('上传中断，请重新打开作品确认是否保存，再重试') }
    request.onabort = () => { finish(); setProgress(null); setError('已取消上传；已保存的内容保留') }
    request.send(file)
  }
  return <Modal title="补充作品素材" close={close} closeDisabled={busy}>
    <p className={s.prose}>为当前作品补充正文或原视频。上传后回到待处理重试封面任务，系统会从原视频提取真实画面。</p>
    {typeof material.originalFilename === 'string' && <p className={s.prose}>已保存文件：{material.originalFilename}</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    <Field label="上传原视频（最大 200 MiB）"><input type="file" accept=".mp4,.mkv,.mov,.webm" disabled={busy || textChanged} onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.currentTarget.value = '' }} /></Field>
    {textChanged && <p role="status">正文有未保存修改，请先保存正文，再上传原视频。</p>}
    {progress !== null && <><progress aria-label="原视频上传进度" max={100} value={progress} style={{ width: '100%' }} /><p role="status">{progress === 100 ? '正在保存原视频…' : `上传 ${progress}%`}</p>{busy && <button className="btn ghost" onClick={() => xhr.current?.abort()}>取消上传</button>}</>}
    <Field label="补充或校正正文"><textarea rows={8} maxLength={300000} disabled={busy} value={body} onChange={event => setBody(event.target.value)} placeholder="粘贴这篇作品的真实正文或逐字稿" /></Field>
    <div className={s.actions}><button className="btn primary" disabled={busy || !body.trim() || body === transcriptText(material.transcript)} onClick={() => void saveText()}>保存正文</button><button className="btn ghost" disabled={busy} onClick={close}>取消</button></div>
  </Modal>
}
