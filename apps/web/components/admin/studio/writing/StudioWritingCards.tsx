'use client'

import type { Dispatch, SetStateAction } from 'react'

import { Plus, X } from 'lucide-react'

import { type StudioRenderCard } from '../studio-render-browser'

import { writingError, writingReplaceCards, type WritingInput } from '../studio-writing-model'

import styles from '../StudioWriting.module.css'

import { Dialog } from './WritingDialog'

export function StudioWritingCards({
  closeCards,
  cardEditor,
  setCardEditor,
  error,
  input,
  setInput,
  setNotice,
  setError,
}: {
  closeCards: () => void
  cardEditor: StudioRenderCard[]
  setCardEditor: Dispatch<SetStateAction<StudioRenderCard[] | null>>
  error: string
  input: WritingInput
  setInput: Dispatch<SetStateAction<WritingInput>>
  setNotice: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string>>
}) {
  return (
    <Dialog title="编辑截图贴图包" onClose={closeCards}>
      <div className={styles.cardEditor}>
        {cardEditor.map((card, i) => (
          <section key={card.id}>
            <div>
              <strong>{card.id}</strong>
              <button
                onClick={() =>
                  setCardEditor((cards) => cards?.filter((_, index) => index !== i) || null)
                }
                aria-label={`删除 ${card.id}`}
              >
                <X size={16} />
              </button>
            </div>
            <label className={styles.field}>
              卡片标题
              <input
                value={card.title}
                maxLength={500}
                onChange={(e) =>
                  setCardEditor(
                    (cards) =>
                      cards?.map((c, index) =>
                        index === i ? { ...c, title: e.target.value } : c,
                      ) || null,
                  )
                }
              />
            </label>
            <label className={styles.field}>
              卡片正文
              <textarea
                rows={5}
                value={card.content}
                maxLength={20000}
                onChange={(e) =>
                  setCardEditor(
                    (cards) =>
                      cards?.map((c, index) =>
                        index === i ? { ...c, content: e.target.value } : c,
                      ) || null,
                  )
                }
              />
            </label>
          </section>
        ))}
        <button
          disabled={cardEditor.length >= 100}
          onClick={() =>
            setCardEditor((cards) => [
              ...(cards || []),
              {
                id: `C${String(Math.max(0, ...(cards || []).map((c) => Number(c.id.slice(1)))) + 1).padStart(2, '0')}`,
                title: '新卡片',
                content: '',
              },
            ])
          }
        >
          <Plus size={16} />
          添加卡片
        </button>
      </div>
      {error && <p className={styles.inlineWarning}>{error}</p>}
      <footer>
        <button onClick={closeCards}>取消</button>
        <button
          className={styles.primary}
          onClick={() => {
            try {
              const body = writingReplaceCards(input.body, cardEditor)
              setInput((p) => ({ ...p, body }))
              setCardEditor(null)
              setNotice('卡片修改已进入编辑区，请保存后导出。')
            } catch (e) {
              setError(writingError(e))
            }
          }}
        >
          应用到稿件
        </button>
      </footer>
    </Dialog>
  )
}
