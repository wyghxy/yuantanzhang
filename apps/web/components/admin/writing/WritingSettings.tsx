'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { WRITING_TEMPLATES, type WritingConfig, type WritingProfile } from '@/lib/writing-domain'
import type { WritingAction, WritingState } from './WritingTypes'

export default function WritingSettings({ state, action, busy, materialId, suggestedAngle, onGenerated }: { state: WritingState; action: WritingAction; busy: boolean; materialId: number | null; suggestedAngle: string; onGenerated: () => void }) {
  const [config, setConfig] = useState(state.settings.config), [profile, setProfile] = useState(state.profile.config)
  const [savedConfig, setSavedConfig] = useState(JSON.stringify(state.settings.config)), [savedProfile, setSavedProfile] = useState(JSON.stringify(state.profile.config))
  const [configRevision, setConfigRevision] = useState(state.settings.revision), [profileRevision, setProfileRevision] = useState(state.profile.revision)
  const configDirty = JSON.stringify(config) !== savedConfig, profileDirty = JSON.stringify(profile) !== savedProfile
  const material = state.materials.find((item) => item.id === materialId)
  if (!configDirty && configRevision !== state.settings.revision) { setConfig(state.settings.config); setSavedConfig(JSON.stringify(state.settings.config)); setConfigRevision(state.settings.revision) }
  if (!profileDirty && profileRevision !== state.profile.revision) { setProfile(state.profile.config); setSavedProfile(JSON.stringify(state.profile.config)); setProfileRevision(state.profile.revision) }
  useEffect(() => {
    if (!configDirty && !profileDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [configDirty, profileDirty])
  async function saveConfig() { const result = await action('settings', 'PATCH', { config, expectedRevision: configRevision }); setConfigRevision((result.value as { revision: number }).revision); setSavedConfig(JSON.stringify(config)) }
  async function saveProfile() { const result = await action('profile', 'PATCH', { config: profile, expectedRevision: profileRevision }); setProfileRevision((result.value as { revision: number }).revision); setSavedProfile(JSON.stringify(profile)) }
  async function generate() {
    if (profileDirty) await saveProfile()
    if (configDirty) await saveConfig()
    await action('jobs', 'POST', { kind: 'draft', materialId, requestId: crypto.randomUUID() }); onGenerated()
  }
  const configField = (key: keyof WritingConfig, label: string, rows = 2) => <label className="radar-field"><span>{label}</span><textarea rows={rows} value={String(config[key])} maxLength={key === 'ownCases' ? 20000 : 5000} onChange={(event) => setConfig({ ...config, [key]: event.target.value })} /></label>
  return <aside className="writing-brief">
    <div className="writing-brief-heading">原片对标参考框架</div>
    <fieldset disabled={busy} className="writing-template-controls"><label className="radar-field"><span>导演脚本模板</span><select value={config.template} onChange={(event) => setConfig({ ...config, template: event.target.value as WritingConfig['template'] })}>{Object.entries(WRITING_TEMPLATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="radar-primary-button writing-generate" disabled={!materialId || !state.capabilities.model} onClick={() => { void generate().catch(() => {}) }}><Sparkles size={14} />{busy ? '正在处理…' : '生成导演口播脚本'}</button><p className="writing-caption">{config.duration} 秒 · {config.language} · {state.capabilities.model ? state.capabilities.modelName || '在线模型已就绪' : '文案模型待配置'}</p></fieldset>
    {suggestedAngle && <div className="writing-selected-angle"><span>已选切入点</span><p>{suggestedAngle}</p><button type="button" className="writing-text-button" onClick={() => setConfig({ ...config, angle: suggestedAngle })}>填入本次核心观点 →</button></div>}
    <details className="writing-brief-section" open={Boolean(suggestedAngle)}><summary>本次创作要求<span>{configDirty ? '未保存' : '编辑'}</span></summary><fieldset disabled={busy}><div className="writing-field-grid"><label className="radar-field"><span>目标时长（秒）</span><input type="number" min={15} max={1800} value={config.duration} onChange={(event) => setConfig({ ...config, duration: Number(event.target.value) })} /></label><label className="radar-field"><span>语言</span><input maxLength={80} value={config.language} onChange={(event) => setConfig({ ...config, language: event.target.value })} /></label></div>{configField('audience', '这次讲给谁听')}{configField('angle', '核心观点与新角度', 3)}{configField('ownCases', '自己的案例与事实', 4)}{configField('style', '表达风格')}{configField('purpose', '结尾希望观众做什么')}<button type="button" className="radar-ghost-button" disabled={!configDirty} onClick={() => { void saveConfig().catch(() => {}) }}>保存本次要求</button></fieldset></details>
    {configRevision !== state.settings.revision && <button type="button" className="writing-warning" onClick={() => { setConfig(state.settings.config); setSavedConfig(JSON.stringify(state.settings.config)); setConfigRevision(state.settings.revision) }}>本次要求已在另一窗口更新；点击读取最新版本并替换当前输入</button>}
    <div className="writing-source-framework"><h3>{material?.title || '原片参考'}</h3>{material?.analysis ? <><p>{material.analysis.summary}</p>{material.analysis.points.map((point, index) => <section key={index}><h4>{point.label}</h4><p>{point.text}</p></section>)}<section><h4>可以复用的机制</h4><ul>{material.analysis.reusable.map((text, index) => <li key={index}>{text}</li>)}</ul></section></> : <p>{material?.correctedTranscript ? '当前原文已就绪。完成 AI 爆款拆解后，参考结构会显示在这里。' : '选择有全文的素材，再开始拆解与创作。'}</p>}</div>
    <details className="writing-brief-section"><summary>元探长创作档案<span>{profileDirty ? '未保存' : '设置'}</span></summary><p className="writing-caption">跨项目复用的定位、表达偏好与本人案例。</p><fieldset disabled={busy}>{([['positioning', '创作定位'], ['audience', '长期受众'], ['phrases', '常用表达'], ['avoid', '避免使用的表达'], ['cases', '本人案例库']] as [keyof WritingProfile, string][]).map(([key, label]) => <label key={key} className="radar-field"><span>{label}</span><textarea rows={key === 'cases' ? 4 : 2} maxLength={key === 'cases' ? 20000 : 5000} value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}<button type="button" className="radar-ghost-button" disabled={!profileDirty} onClick={() => { void saveProfile().catch(() => {}) }}>保存创作档案</button>{profileRevision !== state.profile.revision && <button type="button" className="writing-warning" onClick={() => { setProfile(state.profile.config); setSavedProfile(JSON.stringify(state.profile.config)); setProfileRevision(state.profile.revision) }}>档案版本已变化，读取最新版本并替换输入</button>}</fieldset></details>
  </aside>
}
