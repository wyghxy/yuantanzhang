'use client'

import type { Dispatch, SetStateAction } from 'react'

import { ChevronDown, Save } from 'lucide-react'

import { writingText as text, type WritingInput, type WritingRecord } from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import { Dialog } from './WritingDialog'

export function StudioWritingSettings({
  setSettingsOpen,
  frozen,
  profile,
  input,
  editConfig,
  setInput,
  save,
  busy,
  dirty,
}: {
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  frozen: boolean
  profile: WritingRecord
  input: WritingInput
  editConfig: (key: string, value: unknown) => void
  setInput: Dispatch<SetStateAction<WritingInput>>
  save: () => Promise<void>
  busy: string
  dirty: boolean
}) {
  return (
    <Dialog title="本篇创作要求" onClose={() => setSettingsOpen(false)}>
      <div className={styles.dialogIntro}>
        <p>本篇参数留空时沿用创作档案；修改后保存，再生成候选。</p>
      </div>
      <div className={styles.settingsDialog}>
        <section className={styles.settingSection}>
          <details className={styles.profileSettings}>
            <summary>
              创作档案 · 本篇调整
              <ChevronDown size={14} />
            </summary>
            <label className={styles.field}>
              内容定位
              <input
                disabled={frozen}
                placeholder={text(profile.positioning) || 'AI 科普与工具实践'}
                value={text(input.config.positioning)}
                onChange={(e) => editConfig('positioning', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              常用表达
              <textarea
                disabled={frozen}
                rows={2}
                placeholder={text(profile.expressions) || '留空沿用创作档案'}
                value={text(input.config.expressions)}
                onChange={(e) => editConfig('expressions', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              避免使用的表达
              <textarea
                disabled={frozen}
                rows={2}
                placeholder={text(profile.avoidExpressions) || '留空沿用创作档案'}
                value={text(input.config.avoidExpressions)}
                onChange={(e) => editConfig('avoidExpressions', e.target.value)}
              />
            </label>
            <p className={styles.helper}>这些调整只作用于本篇，留空使用全局创作档案。</p>
          </details>
          <label className={styles.field}>
            目标受众
            <input
              disabled={frozen}
              placeholder={text(profile.audience) || '这篇内容写给谁'}
              value={text(input.config.audience)}
              onChange={(e) => editConfig('audience', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            核心观点
            <textarea
              disabled={frozen}
              rows={3}
              placeholder="你希望观众记住的一句话"
              value={text(input.config.angle ?? input.config.corePoint)}
              onChange={(e) => editConfig('angle', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            本人案例与证据
            <textarea
              disabled={frozen}
              rows={3}
              placeholder={
                text(profile.cases)
                  ? '留空沿用创作档案中的本人案例'
                  : '补充真实经历、实测结果或数据来源'
              }
              value={text(input.config.ownCases ?? input.config.ownExamples)}
              onChange={(e) => editConfig('ownCases', e.target.value)}
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              目标时长
              <select
                disabled={frozen}
                value={String(
                  input.config.durationSeconds ??
                    input.config.duration ??
                    (input.templateKey === 'short_fast' ? 60 : 90),
                )}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    config: {
                      ...p.config,
                      duration: Number(e.target.value),
                      durationSeconds: Number(e.target.value),
                    },
                  }))
                }
              >
                {[30, 35, 45, 60, 65, 90, 120, 180, 300, 600].map((value) => (
                  <option key={value} value={value}>
                    {value % 60 === 0 ? `${value / 60} 分钟` : `${value} 秒`}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              表达风格
              <input
                disabled={frozen}
                placeholder="自然口语"
                value={text(input.config.style)}
                onChange={(e) => editConfig('style', e.target.value)}
              />
            </label>
          </div>
          <label className={styles.field}>
            结尾目的
            <input
              disabled={frozen}
              placeholder="收藏实践 / 留言讨论 / 继续阅读"
              value={text(input.config.purpose)}
              onChange={(e) => editConfig('purpose', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            补充要求
            <textarea
              disabled={frozen}
              rows={2}
              placeholder="本次需要强调或避免的内容"
              value={text(input.config.customInstructions)}
              onChange={(e) => editConfig('customInstructions', e.target.value)}
            />
          </label>
        </section>
      </div>
      <footer>
        <button onClick={() => setSettingsOpen(false)}>返回写稿</button>
        <button className={styles.primary} onClick={save} disabled={!!busy || !dirty}>
          <Save size={14} />
          保存创作要求
        </button>
      </footer>
    </Dialog>
  )
}
