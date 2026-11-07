'use client'

import type { Dispatch, SetStateAction } from 'react'

import { Check } from 'lucide-react'

import {
  writingObject as obj,
  writingText as text,
  type WritingDraft,
  type WritingInput,
} from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import { type Candidate, candidateBody } from './writing-editor-model'

import { Dialog } from './WritingDialog'

export function StudioWritingCandidate({
  closeCandidate,
  candidate,
  draft,
  dirty,
  candidateStale,
  acceptStale,
  setAcceptStale,
  input,
  error,
  busy,
  adopt,
}: {
  closeCandidate: () => void
  candidate: Candidate
  draft: WritingDraft
  dirty: boolean
  candidateStale: boolean
  acceptStale: boolean
  setAcceptStale: Dispatch<SetStateAction<boolean>>
  input: WritingInput
  error: string
  busy: string
  adopt: () => Promise<void>
}) {
  const quality = obj(candidate.output?.quality)
  const generated = obj(candidate.output?.generated)
  const missing = Array.isArray(generated.missing) ? generated.missing : []
  const issues = Array.isArray(quality.issues) ? quality.issues : []
  const needsReview = quality.status === 'needs_review' || missing.length > 0 || issues.length > 0
  return (
    <Dialog title="比较候选稿" onClose={closeCandidate} wide>
      <div className={styles.dialogIntro}>
        <p>
          候选基于 v{String(candidate.target?.version)}，当前保存为 v{draft.version}
          。采用会新增版本。
        </p>
        {dirty && (
          <p className={styles.inlineWarning}>编辑区有未保存输入，请先关闭预览并保存，避免覆盖。</p>
        )}
        {candidateStale && (
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={acceptStale}
              onChange={(e) => setAcceptStale(e.target.checked)}
            />
            我已比较版本与来源变化，确认采用这份旧输入候选。
          </label>
        )}
      </div>
      {(quality.status || needsReview) && (
        <section className={needsReview ? styles.inlineWarning : styles.dialogIntro} aria-label="稿件复核结果">
          <strong>{needsReview ? '有待核对的问题，请在采用前检查' : '模型复核未列出问题'}</strong>
          <ul>
            {missing.map((value, index) => <li key={`missing-${index}`}>{text(value)}</li>)}
            {issues.filter(value => !missing.some(entry => text(entry).includes(text(obj(value).detail))))
              .map((value, index) => <li key={`issue-${index}`}>{text(obj(value).detail)} — {text(obj(value).evidence)}</li>)}
          </ul>
        </section>
      )}
      <div className={styles.compare}>
        <section>
          <h3>当前正文 · v{draft.version}</h3>
          <pre>{input.body || '尚无正文'}</pre>
        </section>
        <section>
          <h3>候选结果</h3>
          <pre>{candidateBody(candidate)}</pre>
        </section>
      </div>
      <details className={styles.candidateIdeas}>
        <summary>标题与开场候选</summary>
        {(['titles', 'hooks'] as const).map((key) => (
          <div key={key}>
            <strong>
              {key === 'titles' ? '标题候选' : '开场候选'}
            </strong>
            <ul>
              {(Array.isArray(obj(candidate.output?.generated)[key])
                ? (obj(candidate.output?.generated)[key] as unknown[])
                : []
              ).map((value, i) => (
                <li key={i}>{text(value)}</li>
              ))}
            </ul>
          </div>
        ))}
      </details>
      {error && (
        <p className={styles.inlineWarning} role="alert">
          {error}
        </p>
      )}
      <footer>
        <button onClick={closeCandidate} disabled={!!busy}>
          继续编辑原稿
        </button>
        <button
          className={styles.primary}
          onClick={adopt}
          disabled={!!busy || dirty || (candidateStale && !acceptStale)}
        >
          <Check size={16} />
          采用候选
        </button>
      </footer>
    </Dialog>
  )
}
