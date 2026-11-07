'use client'

import { useRef, useState } from 'react'
import { Lightbulb, Sparkles } from 'lucide-react'
import WorkspaceSettingsMenu from './WorkspaceSettingsMenu'
import { useAdminShell } from './AdminShell'
import StudioInspirationDrawer from './studio/StudioInspirationDrawer'
import StudioAssistantDrawer from './studio/StudioAssistantDrawer'
import { api, object, type RecordItem } from './studio/studio-client'
import { openStudioTopicDraft } from './studio/studio-creation-client'
import '@/styles/workspace-header.css'
import '@/styles/workspace-tools.css'
import '@/styles/workspace-tools-assistant.css'

export function WorkspaceToolButtons({ onIdeas, onAssistant, ideasOpen, assistantOpen, enabled = true }: {
  onIdeas: () => void; onAssistant: () => void; ideasOpen?: boolean; assistantOpen?: boolean; enabled?: boolean
}) {
  return <div className="workspace-header-actions" aria-label="工作台工具">
    {enabled && <><button type="button" className="workspace-tool-button" aria-label="灵感记录" title="灵感记录" aria-haspopup="dialog" aria-expanded={ideasOpen} onClick={onIdeas}><Lightbulb size={20} aria-hidden="true" /></button>
      <button type="button" className="workspace-tool-button" aria-label="AI 助手" title="AI 助手" aria-haspopup="dialog" aria-expanded={assistantOpen} onClick={onAssistant}><Sparkles size={20} aria-hidden="true" /></button></>}
    <WorkspaceSettingsMenu />
  </div>
}

export default function WorkspaceTools({ title }: { title: string }) {
  const { features } = useAdminShell()
  const [ideas, setIdeas] = useState(false), [assistant, setAssistant] = useState(false)
  const [error, setError] = useState('')
  const opening = useRef(false)
  // Native navigation runs beforeunload protection in editors before leaving.
   
  const navigate = (query: string) => window.location.assign('/workspace/viral?' + query)
  async function openTopic(id: string) {
    if (opening.current) return
    opening.current = true; setError('')
    try {
      const topic = object((await api('topics/' + encodeURIComponent(id))).item) as RecordItem
      navigate('view=drafts&draft=' + encodeURIComponent(await openStudioTopicDraft(topic)))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '打开选题失败，请重试') }
    finally { opening.current = false }
  }
  return <>
    <WorkspaceToolButtons enabled={features.includes('studio')} onIdeas={() => setIdeas(true)} onAssistant={() => setAssistant(true)} ideasOpen={ideas} assistantOpen={assistant} />
    <div className="workspace-shared-tools">
      {error && <div className="workspace-tool-error" role="alert">{error}<button type="button" onClick={() => setError('')}>关闭</button></div>}
      <StudioInspirationDrawer open={ideas} close={() => setIdeas(false)} onChanged={() => {}} onTopic={id => void openTopic(id)} />
      <StudioAssistantDrawer open={assistant} close={() => setAssistant(false)} context={{ title, body: '' }} onTask={id => navigate('view=tasks&task=' + encodeURIComponent(id))} onDraft={id => navigate('view=drafts&draft=' + encodeURIComponent(id))} />
    </div>
  </>
}
