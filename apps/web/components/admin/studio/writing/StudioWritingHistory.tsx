'use client'

import type { Dispatch, SetStateAction } from 'react'

import { LoaderCircle, RotateCcw } from 'lucide-react'

import { writingText as text, type WritingDraft, type WritingInput } from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import { type SavedRevision, date } from './writing-editor-model'

import { Dialog } from './WritingDialog'

export function StudioWritingHistory({
  closeHistory,
  busy,
  revision,
  setRevision,
  history,
  setRestoreConfirmation,
  input,
  error,
  restoreConfirmation,
  restore,
  dirty,
  draft,
}: {
  closeHistory: () => void
  busy: string
  revision: SavedRevision | null
  setRevision: Dispatch<SetStateAction<SavedRevision | null>>
  history: SavedRevision[]
  setRestoreConfirmation: Dispatch<SetStateAction<number | null>>
  input: WritingInput
  error: string
  restoreConfirmation: number | null
  restore: () => Promise<void>
  dirty: boolean
  draft: WritingDraft
}) {
  return (
    <Dialog title="稿件历史" onClose={closeHistory} closeDisabled={!!busy} wide>
      <div className={styles.historyPicker}>
        <label>
          比较版本
          <select
            value={revision?.version || ''}
            disabled={!!busy}
            onChange={(e) => {
              setRevision(history.find((r) => r.version === Number(e.target.value)) || null)
              setRestoreConfirmation(null)
            }}
          >
            {history.map((row) => (
              <option key={row.version} value={row.version}>
                v{row.version} · {date(row.createdAt)} · {row.reason || '保存'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.compare}>
        <section>
          <h3>当前编辑区</h3>
          <pre>{input.body}</pre>
        </section>
        <section>
          <h3>历史 v{revision?.version}</h3>
          <pre>{text(revision?.data.body)}</pre>
        </section>
      </div>
      {error && <p className={styles.inlineWarning}>{error}</p>}
      <footer>
        {restoreConfirmation !== null && restoreConfirmation === revision?.version ? (
          <>
            <p role="status">
              将 v{restoreConfirmation}{' '}
              的稿件恢复为新版本，保留当前版本和全部历史。恢复后需要重新检查并定稿。
            </p>
            <button disabled={!!busy} onClick={() => setRestoreConfirmation(null)}>
              取消恢复
            </button>
            <button className={styles.primary} onClick={restore} disabled={!!busy || dirty}>
              {busy === 'restore' ? (
                <LoaderCircle size={16} className={styles.spin} />
              ) : (
                <RotateCcw size={16} />
              )}
              {busy === 'restore' ? '正在恢复…' : '确认恢复为新版本'}
            </button>
          </>
        ) : (
          <>
            <p>恢复会新增版本，保留现有历史。</p>
            <button
              onClick={() => setRestoreConfirmation(revision?.version ?? null)}
              disabled={!!busy || dirty || !revision || revision.version === draft.version}
            >
              <RotateCcw size={16} />
              恢复此版本
            </button>
          </>
        )}
      </footer>
    </Dialog>
  )
}
