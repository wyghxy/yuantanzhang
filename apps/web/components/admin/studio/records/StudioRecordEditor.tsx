'use client'
import { useStudioPrivacy } from '../StudioPrivacy'

import type { Dispatch, SetStateAction } from 'react'

import { text, statusNames, type RecordData, type RecordItem } from '../studio-client'

import { Field, Modal } from '../StudioUI'
import { StudioAccountSource } from './StudioAccountSource'

import s from '../StudioWorkbench.module.css'

export function StudioRecordEditor({
  edit,
  setEdit,
  busy,
  error,
  kind,
  form,
  patch,
  perform,
  save,
}: {
  edit: RecordItem
  setEdit: Dispatch<SetStateAction<RecordItem | null>>
  busy: boolean
  error: string
  kind: string
  form: RecordData
  patch: (key: string, value: unknown) => void
  perform: (fn: () => Promise<void>) => Promise<void>
  save: () => Promise<void>
}) {
  const { masked, creatorName } = useStudioPrivacy()
  const privateName = masked && kind === 'accounts' && !!edit.id
  return (
    <Modal
      title={edit.id ? '编辑记录' : '新建选题'}
      close={() => setEdit(null)}
      closeDisabled={busy}
    >
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <Field label={kind === 'accounts' ? '博主名称' : '选题标题'}>
        <input
          disabled={busy}
          value={privateName ? creatorName(form.name) : text(form[kind === 'accounts' ? 'name' : 'title'])}
          readOnly={privateName}
          aria-describedby={privateName ? 'studio-private-name-hint' : undefined}
          onChange={(e) => patch(kind === 'accounts' ? 'name' : 'title', e.target.value)}
        />
      </Field>
      {privateName && <p id="studio-private-name-hint" className={s.meta}>关闭隐私模式后可修改名称</p>}
      <Field label="备注与我的角度">
        <textarea
          disabled={busy}
          value={text(form.notes)}
          onChange={(e) => patch('notes', e.target.value)}
        />
      </Field>
      {kind === 'accounts' ? (
        <>
          <StudioAccountSource form={form} busy={busy} patch={patch} />
          {edit.platform === 'wechat_official' ? (
            <>
              <Field label="RSS／Atom 订阅地址">
                <input
                  disabled={busy}
                  type="url"
                  value={text(form.feedUrl)}
                  onChange={(e) => patch('feedUrl', e.target.value)}
                  placeholder="https://订阅服务域名/公众号路径"
                />
              </Field>
              <p className={s.meta}>
                留空表示待配置自动更新；仅接收已配置允许来源的 HTTPS 地址，不填写微信密码、Cookie
                或带密钥的链接。保存后可立即采集，定时调度需另行启用。
              </p>
            </>
          ) : (
            <Field label="采集策略">
              <select
                disabled={busy}
                value={text(form.strategy, 'default')}
                onChange={(e) => patch('strategy', e.target.value)}
              >
                <option value="default">字幕优先，缺字幕时转写</option>
                <option value="metadata">仅作品信息与指标</option>
                <option value="media">完整媒体与逐字稿</option>
              </select>
            </Field>
          )}
          <label className={s.checkRow}>
            <input
              disabled={busy}
              type="checkbox"
              checked={form.enabled === true}
              onChange={(e) => patch('enabled', e.target.checked)}
            />
            开启情报采集
          </label>
        </>
      ) : (
        <Field label="状态">
          <select
            disabled={busy}
            value={text(form.status, 'idea')}
            onChange={(e) => patch('status', e.target.value)}
          >
            {['idea', 'adopted', 'writing', 'published', 'archived'].map((v) => (
              <option value={v} key={v}>
                {statusNames[v]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <button className="btn primary" disabled={busy} onClick={() => void perform(save)}>
        保存记录
      </button>
    </Modal>
  )
}
