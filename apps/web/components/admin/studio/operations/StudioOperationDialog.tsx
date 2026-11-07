'use client'

import { useRef, type JSX, type Dispatch, type SetStateAction } from 'react'

import { api, text, object, type RecordData, type RecordItem } from '../studio-client'

import { Field, Modal } from '../StudioUI'
import { useStudioPrivacy } from '../StudioPrivacy'

import StudioRosterImport from '../StudioRosterImport'

import { studioCount, studioDateTime, studioSafeUrl } from '../studio-operations-utils'

import s from '../StudioWorkbench.module.css'

import { smallStyle, detailStyle, actionsStyle } from './operations-presentation'

export function StudioOperationDialog({
  panel,
  setPanel,
  busy,
  error,
  profile,
  setProfile,
  perform,
  notify,
  capabilityPanel,
  onNavigate,
  materials,
  checkedMaterials,
  setCheckedMaterials,
  materialOffset,
  setMaterialOffset,
  materialTotal,
  onTask,
  snapshots,
  onMaterial,
  snapshotOffset,
  setSnapshotOffset,
  snapshotTotal,
}: {
  panel: string
  setPanel: Dispatch<SetStateAction<string>>
  busy: boolean
  error: string
  profile: RecordData
  setProfile: Dispatch<SetStateAction<RecordData>>
  perform: (action: () => Promise<void>) => Promise<void>
  notify: (message: string) => void
  capabilityPanel: JSX.Element
  onNavigate: (view: string) => void
  materials: RecordItem[]
  checkedMaterials: string[]
  setCheckedMaterials: Dispatch<SetStateAction<string[]>>
  materialOffset: number
  setMaterialOffset: Dispatch<SetStateAction<number>>
  materialTotal: number
  onTask: (id: string) => void
  snapshots: RecordItem[]
  onMaterial: ((id: string) => void) | undefined
  snapshotOffset: number
  setSnapshotOffset: Dispatch<SetStateAction<number>>
  snapshotTotal: number
}) {
  const { materialTitle } = useStudioPrivacy()
  const contentRequest = useRef<{ scope: string; key: string } | null>(null)
  return (
    <Modal
      title={
        (
          {
            profile: '元探长创作档案',
            capabilities: '平台与服务状态',
            transcribe: '选择要转写的素材',
            snapshots: '指标快照与回访',
            roster: '名单来源与同步',
          } as Record<string, string>
        )[panel]
      }
      close={() => setPanel('')}
      closeDisabled={busy}
    >
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {panel === 'profile' ? (
        <>
          {[
            ['positioning', '我的定位'],
            ['audience', '目标受众'],
            ['cases', '本人真实案例'],
            ['expressions', '常用表达'],
            ['avoidExpressions', '避免的表达'],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                disabled={busy}
                value={text(profile[key])}
                onChange={(event) => setProfile((old) => ({ ...old, [key]: event.target.value }))}
              />
            </Field>
          ))}
          <button
            className="btn btn-emerald"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                setProfile(
                  await api('profile', 'PATCH', {
                    ...profile,
                    expectedVersion: profile.version,
                  }),
                )
                notify('创作档案已保存')
                setPanel('')
              })
            }
          >
            保存创作档案
          </button>
        </>
      ) : panel === 'capabilities' ? (
        capabilityPanel
      ) : panel === 'roster' ? (
        <StudioRosterImport
          onAccounts={() => {
            setPanel('')
            onNavigate('accounts')
          }}
          notify={notify}
        />
      ) : panel === 'transcribe' ? (
        <>
          <p style={smallStyle}>
            优先处理尚无正文的音视频；已有逐字稿不会在这里重复转写，重新转写可在素材阅读区执行。图文不进入转写。
          </p>
          {materials.map((material) => {
            const transcript = object(material.transcript),
              ready = Boolean(text(transcript.corrected || transcript.raw).trim()),
              textOnly = ['text', 'image', 'image_text', 'article'].includes(
                text(material.mediaType || material.contentType || material.type),
              ),
              eligible =
                !ready &&
                !textOnly &&
                !!(material.mediaKey || material.audioKey || material.assetKey || material.url)
            return (
              <label
                key={material.id}
                style={{ ...detailStyle, display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  disabled={busy || !eligible}
                  checked={checkedMaterials.includes(material.id)}
                  onChange={(event) =>
                    setCheckedMaterials((old) =>
                      event.target.checked
                        ? [...old, material.id]
                        : old.filter((id) => id !== material.id),
                    )
                  }
                />
                <span>
                  {materialTitle(material.title, '未命名素材')}
                  <small style={{ ...smallStyle, display: 'block' }}>
                    {ready
                      ? '已有逐字稿'
                      : textOnly
                        ? '图文素材'
                        : !eligible
                          ? '缺少媒体和原链接'
                          : '待提取字幕或转写'}
                  </small>
                </span>
              </label>
            )
          })}
          {!materials.length && <div className="empty">当前页没有素材。</div>}
          <div className={s.pagination}>
            <button
              disabled={busy || !materialOffset}
              onClick={() => setMaterialOffset((old) => Math.max(0, old - 30))}
            >
              上一页
            </button>
            <span>{materialTotal} 份素材</span>
            <button
              disabled={busy || materialOffset + 30 >= materialTotal}
              onClick={() => setMaterialOffset((old) => old + 30)}
            >
              下一页
            </button>
          </div>
          <button
            className="btn btn-emerald"
            disabled={busy || !checkedMaterials.length}
            onClick={() =>
              void perform(async () => {
                const ids = [...checkedMaterials].sort(), scope = JSON.stringify(ids)
                if (contentRequest.current?.scope !== scope)
                  contentRequest.current = { scope, key: crypto.randomUUID() }
                const result = await api('materials/content-batch', 'POST', {
                  items: ids.map(materialId => ({ materialId })),
                  idempotencyKey: contentRequest.current.key,
                })
                const tasks = Array.isArray(result.tasks) ? result.tasks.map(object) : []
                const blocked = Array.isArray(result.blocked) ? result.blocked.map(object) : []
                contentRequest.current = null
                setCheckedMaterials(blocked.map(row => text(row.materialId)).filter(Boolean))
                if (!blocked.length) setPanel('')
                const taskId = tasks.map(row => text(row.id)).find(Boolean)
                if (taskId) onTask(taskId)
                notify(`${tasks.length ? `已提交 ${tasks.length} 条采集任务` : '本次没有新增任务'}${blocked.length ? `；${blocked.length} 条需要处理：${text(blocked[0].message || blocked[0].reason)}` : '，已完成和处理中的作品不会重复提交。'}`)
              })
            }
          >
            处理选中的 {checkedMaterials.length} 份素材
          </button>
        </>
      ) : panel === 'snapshots' ? (
        <>
          <p style={smallStyle}>
            T+3 / T+7
            按真实发布时间起算。已排队、尚未到期或未取得指标的回访不会标记为真实指标验收通过。
          </p>
          {snapshots.map((snapshot) => (
            <article key={snapshot.id} style={detailStyle}>
              <strong>
                {[3, 7].includes(Number(snapshot.followupDays))
                  ? `T+${snapshot.followupDays} 回访`
                  : '指标观测'}
              </strong>
              <p style={smallStyle}>
                {studioDateTime(snapshot.observedAt || snapshot.capturedAt)} ·{' '}
                {text(snapshot.platform)} · {text(snapshot.materialId)}
              </p>
              <div style={actionsStyle}>
                {[
                  ['views', '播放'],
                  ['likes', '点赞'],
                  ['comments', '评论'],
                  ['shares', '分享'],
                  ['saves', '收藏'],
                ].map(([key, label]) => (
                  <span style={smallStyle} key={key}>
                    {label} {studioCount(object(snapshot.metrics)[key])}
                  </span>
                ))}
              </div>
              {studioSafeUrl(snapshot.sourceUrl) && (
                <a
                  className="btn ghost"
                  href={studioSafeUrl(snapshot.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  观测来源 ↗
                </a>
              )}
              {snapshot.materialId ? (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setPanel('')
                    if (onMaterial) onMaterial(text(snapshot.materialId))
                    else onNavigate('feed')
                  }}
                >
                  查看素材
                </button>
              ) : null}
            </article>
          ))}
          {!snapshots.length && <div className="empty">还没有真实指标快照。</div>}
          <div className={s.pagination}>
            <button
              disabled={!snapshotOffset}
              onClick={() => setSnapshotOffset((old) => Math.max(0, old - 30))}
            >
              上一页
            </button>
            <span>{snapshotTotal} 份快照</span>
            <button
              disabled={snapshotOffset + 30 >= snapshotTotal}
              onClick={() => setSnapshotOffset((old) => old + 30)}
            >
              下一页
            </button>
          </div>
          <button
            className="btn ghost"
            onClick={() => {
              setPanel('')
              onNavigate('tasks')
            }}
          >
            查看待执行回访任务
          </button>
        </>
      ) : null}
    </Modal>
  )
}
