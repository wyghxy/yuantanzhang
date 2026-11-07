'use client'

import type { Dispatch, SetStateAction } from 'react'

import { ArrowUpRight, Check } from 'lucide-react'

import { type WritingDraft } from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import { type HandoffPreview } from './writing-editor-model'

import { Dialog } from './WritingDialog'

export function StudioWritingHandoff({
  closeHandoff,
  targetProject,
  setTargetProject,
  setHandoff,
  draft,
  busy,
  projects,
  handoff,
  error,
  confirmHandoff,
  previewHandoff,
}: {
  closeHandoff: () => void
  targetProject: string
  setTargetProject: Dispatch<SetStateAction<string>>
  setHandoff: Dispatch<SetStateAction<HandoffPreview | null>>
  draft: WritingDraft
  busy: string
  projects: { id: number; title: string }[]
  handoff: HandoffPreview | null
  error: string
  confirmHandoff: () => Promise<void>
  previewHandoff: () => Promise<void>
}) {
  return (
    <Dialog title="将定稿送入内容项目" onClose={closeHandoff}>
      <div className={styles.dialogIntro}>
        <p>交接指定版本的正文和参考来源。发布、指标和复盘会在内容项目继续完成。</p>
        <label className={styles.field}>
          交接到
          <select
            value={targetProject}
            onChange={(e) => {
              setTargetProject(e.target.value)
              setHandoff(null)
            }}
            disabled={typeof draft.projectId === 'number' || !!busy}
          >
            <option value="">新建内容项目</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.helper}>事实核实与发布确认仍需单独完成；不会覆盖已发布快照。</p>
        {handoff && (
          <section className={styles.handoffPreview}>
            <h3>
              {handoff.title} · v{handoff.draftVersion}
            </h3>
            <pre>{handoff.body}</pre>
            <p>
              目标母稿：
              {handoff.expectedMasterVersion ? `v${handoff.expectedMasterVersion}` : '新建'}
            </p>
          </section>
        )}
        {error && <p className={styles.inlineWarning}>{error}</p>}
      </div>
      <footer>
        <button onClick={closeHandoff} disabled={!!busy}>
          取消
        </button>
        {handoff ? (
          <button className={styles.primary} onClick={confirmHandoff} disabled={!!busy}>
            <Check size={16} />
            确认交接此版本
          </button>
        ) : (
          <button className={styles.primary} onClick={previewHandoff} disabled={!!busy}>
            预览交接
            <ArrowUpRight size={16} />
          </button>
        )}
      </footer>
    </Dialog>
  )
}
