'use client'

import type { Dispatch, SetStateAction } from 'react'

import { WandSparkles, X } from 'lucide-react'

import { type WritingInput, type WritingRecord } from '../studio-writing-model'

import styles from '../StudioWriting.module.css'
import simple from './StudioRewriteSimple.module.css'

import { Dialog } from './WritingDialog'

export function StudioWritingRewrite({
  setRewriteOpen,
  selection,
  segmentId,
  setSelection,
  setSegmentId,
  frozen,
  setInstruction,
  instruction,
  taskDisabled,
  modelMissing,
  input,
  createTask,
  error,
}: {
  setRewriteOpen: Dispatch<SetStateAction<boolean>>
  selection: string
  segmentId: string
  setSelection: Dispatch<SetStateAction<string>>
  setSegmentId: Dispatch<SetStateAction<string>>
  frozen: boolean
  setInstruction: Dispatch<SetStateAction<string>>
  instruction: string
  taskDisabled: boolean
  modelMissing: boolean
  input: WritingInput
  createTask: (kind: string, extra?: WritingRecord) => Promise<void>
  error: string
}) {
  return (
    <Dialog title="AI 改写" onClose={() => setRewriteOpen(false)}>
      <div className={simple.content} data-component-ui>
        <section className={simple.section}>
          {selection || segmentId ? (
            <div className={simple.selection}>
              <span>
                {segmentId
                  ? `仅修改 ${segmentId}`
                  : `选中 ${selection.length} 字`}
              </span>
              <button
                aria-label="取消局部选择"
                onClick={() => {
                  setSelection('')
                  setSegmentId('')
                }}
              >
                <X size={14} />
              </button>
              {selection && <p>{selection}</p>}
            </div>
          ) : (
            <p className={simple.scope}>修改整篇稿件</p>
          )}
          <div className={simple.actions}>
            {['更口语化', '压缩篇幅', '补充解释', '替换开头'].map((label) => (
              <button
                key={label}
                disabled={frozen}
                onClick={() =>
                  setInstruction(
                    label === '替换开头'
                      ? '仅改写开场，让第一句话更有吸引力，其他内容与事实保持原样。'
                      : label,
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label className={simple.field}>
            <textarea
              rows={3}
              aria-label="改写要求"
              placeholder="怎么改？例如：更口语、缩短到 60 秒。"
              value={instruction}
              disabled={frozen}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </label>
          <button
            className={simple.generate}
            disabled={
              taskDisabled ||
              modelMissing ||
              !instruction.trim() ||
              !input.body.trim()
            }
            onClick={() =>
              void createTask('rewrite', {
                instruction,
                ...(selection ? { selection } : {}),
                ...(segmentId ? { segmentId } : {}),
              })
            }
          >
            <WandSparkles size={16} />
            生成改写
          </button>
        </section>
      </div>
      {error && (
        <p className={styles.inlineWarning} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
