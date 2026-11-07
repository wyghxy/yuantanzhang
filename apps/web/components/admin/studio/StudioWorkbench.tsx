'use client'
import { StudioPrivacyProvider, useStudioPrivacy } from './StudioPrivacy'
import StudioQueryProvider, { useStudioResource, useStudioSearch } from './StudioQueryProvider'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import WorkspaceHeader from '../WorkspaceHeader'
import { WorkspaceToolButtons } from '../WorkspaceTools'
import { Globe } from 'lucide-react'
import { useAdminShell } from '../AdminShell'
import StudioCreationCenter from './StudioCreationCenter'
import StudioFeed from './StudioFeed'
import StudioAdoptDialog from './StudioAdoptDialog'
import { openStudioMaterialDraft, openStudioTopicDraft } from './studio-creation-client'
import StudioRecords from './StudioRecords'
import StudioCollection from './StudioCollection'
import { useStudioCollectionLocation } from './useStudioCollectionLocation'
import StudioOperations from './StudioOperations'
import StudioImport from './StudioImport'
import StudioAssistantDrawer from './StudioAssistantDrawer'
import { useStudioAssistantBridge } from './useStudioAssistantBridge'
import StudioInspirationDrawer from './StudioInspirationDrawer'
import StudioWriting from './StudioWriting'
import { useStudioTaskLog } from './useStudioTaskLog'
import { useStudioEditGuard } from './useStudioEditGuard'
import { api, text, list, object, errorText, type RecordItem } from './studio-client'
import { originalLocation } from './original-studio-model'
import StudioWorkbenchSidebar from './StudioWorkbenchSidebar'
import StudioStatusBar from './StudioStatusBar'
import StudioRunLogDrawer from './StudioRunLogDrawer'
import { studioPreviewPath } from './studio-preview'
import { studioFeedPath, studioFeedRange } from './studio-feed-query'
import { studioHostFilterLocation, useStudioHostLocation } from './studio-host-location'
import { studioTaskDisplay, studioTaskSelectionAfterNavigation } from './studio-task-display'
import { observeStudioTaskCompletion } from './studio-query-cache'
import { studioCollectionEntry, studioListPage, type StudioCollectionEntry } from './studio-list-navigation'


import '@/styles/radar-reference.css'
import '@/styles/radar-dashboard-overrides.css'
import '@/styles/radar-workspace-navigation.css'


export default function StudioWorkbench() {
  return <StudioQueryProvider><StudioPrivacyProvider><WorkbenchContent /></StudioPrivacyProvider></StudioQueryProvider>
}

function WorkbenchContent() {
  const { platformLabel } = useStudioPrivacy()
  const query=useSearchParams(), preview=studioPreviewPath(usePathname()), initial=originalLocation(query,preview)
  const {expanded,toggleSidebar:switchWorkspace}=useAdminShell()
  const [view,setView]=useState(initial.view)
  const [selected,setSelected]=useState(initial.material)
  const [draftId,setDraftId]=useState(initial.draft)
  const {libraryMaterialId,setLibraryMaterialId,reflectLibrarySelection}=useStudioCollectionLocation(view,draftId,initial.view,initial.material)
  const [recoveryMaterialId,setRecoveryMaterialId]=useState('')
  const reflectCollectionSelection=useCallback((id:string)=>{setRecoveryMaterialId(current=>current===id?current:'');reflectLibrarySelection(id)},[reflectLibrarySelection])
  const [initialTab,setInitialTab]=useState('播放器'),[adopting,setAdopting]=useState<RecordItem|null>(null)
  const [initialWritingMode,setInitialWritingMode]=useState<'original'|'editor'>(query.get('writingMode')==='editor'?'editor':'original')
  const [ideasOpen,setIdeasOpen]=useState(false)
  const { assistantOpen,setAssistantOpen,assistantContext,openAssistant }=useStudioAssistantBridge()
  const opening=useRef<AbortController|null>(null)
  const [openingWriting,setOpeningWriting]=useState(false)
  useEffect(()=>()=>{opening.current?.abort();opening.current=null},[])
  const [readState,setReadState]=useState(['unread','read'].includes(query.get('readState')||'')?query.get('readState')!:'all')
  const [selectedRecord,setSelectedRecord]=useState(query.get('record')||'')
  const [revision,setRevision]=useState(0),[collectionEntry,setCollectionEntry]=useState(0)
  const [feedPage,setFeedPage]=useState({scope:'',offset:0})
  const [keyword,setKeyword]=useState(query.get('q')||''),[platform,setPlatform]=useState(query.get('platform')||'all'),[author,setAuthor]=useState(query.get('author')||'all')
  const [status,setStatus]=useState(['all','ready','missing'].includes(query.get('status')||'')?query.get('status')!:'all'),[sample,setSample]=useState(['exclude','only','all'].includes(query.get('sample')||'')?query.get('sample')!:(preview?'only':'all')),[range,setRange]=useState(studioFeedRange(query.get('range'))),[feedMode,setFeedMode]=useState(query.get('mode')==='cluster'?'cluster':'stream')
  const [link,setLink]=useState(''),[importText,setImportText]=useState<string|null>(null),[notice,setNotice]=useState('')
  const [taskId,setTaskId]=useState(query.get('task')||''),[logOpen,setLogOpen]=useState(!!query.get('task')),[readerFocus,setReaderFocus]=useState(false)
  const [initialTaskPending,setInitialTaskPending]=useState(!query.get('task')),[initialTaskError,setInitialTaskError]=useState('')
  const taskLog=useStudioTaskLog(taskId,!!taskId,revision,logOpen),task=taskLog.detail?object(taskLog.detail.task):null,taskError=taskLog.error,events=taskLog.events
  const accountsQuery=useStudioResource('accounts?limit=200&sample=all&projection=summary&view=picker',!draftId&&['feed','topics','works'].includes(view))
  const dashboardQuery=useStudioResource(view==='overview'?'dashboard':'dashboard?projection=sidebar',true,view==='overview')
  useEffect(()=>{if(taskId&&task)observeStudioTaskCompletion(taskId,task)},[taskId,task])
  const accounts=list(accountsQuery.data?.items),dashboard=dashboardQuery.data
  const search=useStudioSearch(keyword)
  const feedScope=JSON.stringify([range,search,platform,author,status,sample])
  const currentPage=studioListPage(feedPage,feedScope,30),offset=currentPage.offset
  if(currentPage!==feedPage)setFeedPage(currentPage)
  const setOffset=(value:SetStateAction<number>)=>{if(feedQuery.isPlaceholderData)return;setFeedPage(previous=>{const page=studioListPage(previous,feedScope,30);return{scope:feedScope,offset:typeof value==='function'?value(page.offset):value}})}
  const feedQuery=useStudioResource(studioFeedPath({range,offset:String(offset),q:search,platform,accountId:author,transcriptStatus:status,sample}),!draftId&&['feed','topics'].includes(view))
  const items=list(feedQuery.data?.items),total=feedQuery.data?Number(feedQuery.data.total):null,loading=feedQuery.isPending||feedQuery.isPlaceholderData,displayOffset=Number(feedQuery.data?.offset??offset),error=feedQuery.error?errorText(feedQuery.error):''
  const boundedPage=studioListPage(currentPage,feedScope,30,feedQuery.isPlaceholderData?null:total)
  if(boundedPage!==currentPage)setFeedPage(boundedPage)
  const [sidebarClosed,setSidebarClosed]=useState(false),[mobileNav,setMobileNav]=useState(false),[mobilePanel,setMobilePanel]=useState(initial.material?'reader':'feed')
  const [mobileViewport,setMobileViewport]=useState(false)
  const navigationExpanded=mobileViewport?mobileNav:!sidebarClosed
  useEffect(()=>{
    const media=window.matchMedia('(max-width:767px)')
    const update=()=>{setMobileViewport(media.matches);if(!media.matches)setMobileNav(false)}
    update();media.addEventListener('change',update)
    return()=>media.removeEventListener('change',update)
  },[])
  const {readerDirty,writingDirty,canLeave}=useStudioEditGuard()
  const initialTaskLoaded=useRef(!!query.get('task'))
  const notify=useCallback((value:string)=>setNotice(value),[]),changed=useCallback(()=>setRevision(value=>value+1),[])
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(timer)},[notice])
  useEffect(()=>{
    const importLink=(event:Event)=>setImportText(text((event as CustomEvent).detail))
    window.addEventListener('studio:import',importLink)
    return()=>window.removeEventListener('studio:import',importLink)
  },[])
  useEffect(()=>{
    if(initialTaskLoaded.current||taskId)return
    const controller=new AbortController()
    setInitialTaskPending(true)
    void api('tasks?limit=10&status=active&projection=summary','GET',undefined,controller.signal).then(data=>{if(controller.signal.aborted)return;initialTaskLoaded.current=true;setInitialTaskError('');const active=list(data.items).find(row=>row.kind!=='cleanup_audio'&&['queued','running'].includes(text(row.status)));if(active)setTaskId(active.id)}).catch(reason=>{if(!controller.signal.aborted)setInitialTaskError(errorText(reason))}).finally(()=>{if(!controller.signal.aborted)setInitialTaskPending(false)})
    return()=>controller.abort()
  },[revision,taskId])
  const replaceLocation=useStudioHostLocation(query,preview,canLeave,opening,(next,previous,mode)=>{
    setOpeningWriting(false);setView(next.view);setDraftId(next.draft);setLibraryMaterialId(next.view==='works'?next.material:'');setRecoveryMaterialId(current=>next.view==='works'&&next.material===current?current:'')
    setInitialWritingMode(mode);readerDirty.current=false;writingDirty.current=false
  })
  useEffect(()=>{
    replaceLocation(studioHostFilterLocation(window.location.href,{keyword,platform,author,status,sample,range,feedMode}),false)
  },[keyword,platform,author,status,sample,range,feedMode,replaceLocation])
  function updateLocation(next:string,material='',draft='',nextPlatform=platform,record='',nextAuthor=author){opening.current?.abort();setOpeningWriting(false);const url=new URL(window.location.href);url.searchParams.set('view',next);for(const[key,value]of[['material',material],['draft',draft],['platform',nextPlatform==='all'?'':nextPlatform],['record',record],['author',nextAuthor==='all'?'':nextAuthor]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)}replaceLocation(url)}
  function selectReadState(value:string){setReadState(value);const url=new URL(window.location.href);if(value==='all')url.searchParams.delete('readState');else url.searchParams.set('readState',value);replaceLocation(url)}
  async function selectView(next:string){if(next==='works'){openCollection({kind:'all'});return}if(!(await canLeave()))return;const resolved=originalLocation(new URLSearchParams({view:next==='unread'?'works':next})).view;setRecoveryMaterialId('');setView(resolved);setLibraryMaterialId('');setDraftId('');setSelectedRecord('');setMobileNav(false);readerDirty.current=false;writingDirty.current=false;updateLocation(resolved,resolved==='feed'?selected:'');if(resolved==='works')selectReadState(next==='unread'?'unread':'all')}
  async function openWriting(load:(signal:AbortSignal)=>Promise<string>,material='',tab='播放器'){if(opening.current||!(await canLeave())||opening.current)return;const controller=new AbortController();opening.current=controller;setOpeningWriting(true);setNotice('');try{const next=await load(controller.signal);if(controller.signal.aborted||!(await canLeave())||controller.signal.aborted)return;clearHistoricalTask();if(material)setSelected(material);openDraft(next,true,'original',['逐字稿正文','二创工作台'].includes(tab)?'播放器':tab)}catch(reason){if(!controller.signal.aborted)notify(errorText(reason))}finally{if(opening.current===controller){opening.current=null;setOpeningWriting(false)}}}
  function clearHistoricalTask(){if(studioTaskSelectionAfterNavigation(taskId,task)===taskId)return;setTaskId('');setLogOpen(false);initialTaskLoaded.current=true;setInitialTaskError('');const url=new URL(window.location.href);url.searchParams.delete('task');replaceLocation(url,false)}
  function openMaterial(id:string,tab='播放器'){return openWriting(signal=>openStudioMaterialDraft(id,signal),id,tab)}
  async function openRecoveryMaterial(id:string){if(!id||!(await canLeave()))return;clearHistoricalTask();setAuthor('all');setPlatform('all');setLibraryMaterialId(id);setDraftId('');setView('works');setMobileNav(false);selectReadState('all');setRecoveryMaterialId(id);updateLocation('works',id,'','all')}
  function openTopic(id:string){return openWriting(async signal=>{const topic=object((await api('topics/'+encodeURIComponent(id),'GET',undefined,signal)).item) as RecordItem;return openStudioTopicDraft(topic,signal)})}
  async function openDraft(id:string,confirmed=false,mode:'original'|'editor'='original',tab='播放器'){if(!confirmed&&!(await canLeave()))return;setRecoveryMaterialId('');setInitialWritingMode(mode);setInitialTab(tab);setDraftId(id);setView('drafts');setMobileNav(false);readerDirty.current=false;writingDirty.current=false;updateLocation('drafts','',id);const url=new URL(window.location.href);if(mode==='editor')url.searchParams.set('writingMode',mode);else url.searchParams.delete('writingMode');replaceLocation(url)}
  function showTask(id:string){setTaskId(id);changed();notify('任务已入队，进度和日志会保存在工作台中。')}
  function openTask(id:string){if(id){setTaskId(id);setLogOpen(true)}else selectView('tasks')}
  async function openCollection(entry:StudioCollectionEntry,materialId=''){if(!(await canLeave()))return;const scope=studioCollectionEntry(entry);setRecoveryMaterialId('');readerDirty.current=false;writingDirty.current=false;setReaderFocus(false);setPlatform(scope.platform);setAuthor(scope.accountId);setLibraryMaterialId(materialId);setView('works');setDraftId('');setSelectedRecord('');setMobilePanel('feed');setMobileNav(false);if(entry.kind==='all')setCollectionEntry(value=>value+1);updateLocation('works',materialId,'',scope.platform,'',scope.accountId);selectReadState('all')}
  function choosePlatform(value:string){openCollection({kind:'platform',value})}
  function toggleNav(){if(window.matchMedia('(max-width:767px)').matches)setMobileNav(value=>!value);else setSidebarClosed(value=>!value)}
  async function stopTask(){if(!taskId)return;try{await api(`tasks/${encodeURIComponent(taskId)}/cancel`,'POST',{});changed();notify('已请求停止任务，已完成步骤会保留。')}catch(reason){notify(errorText(reason))}}
  const taskActive=!!task&&['queued','running'].includes(text(task.status)),focus=!!draftId
  const taskDisplay=task?studioTaskDisplay(task):null
  const footerError=taskError||(!taskId?initialTaskError:''),footerPending=!task&&!footerError&&(!!taskId||initialTaskPending)
  const footerMessage=footerError||(footerPending?'正在读取任务状态…':task?.status==='succeeded'?'任务已完成，结果和日志已保存':task?.status==='cancelled'?'任务已停止，已完成步骤保留':taskDisplay?.message||'我的创作工作台')
  return <div className={`original-studio radar-integrated${sidebarClosed?' nav-collapsed':''}${mobileNav?' nav-open':''}`}><div id="appContainer" className={`radar-app${focus||readerFocus?' focus-creation-mode':''}`} data-mobile-nav={mobileNav} data-mobile-panel={mobilePanel}>
    <WorkspaceHeader title="探长雷达" expanded={expanded} onSwitch={switchWorkspace} onNavigation={toggleNav} navigationExpanded={navigationExpanded} actions={<WorkspaceToolButtons onIdeas={()=>setIdeasOpen(true)} onAssistant={openAssistant} ideasOpen={ideasOpen} assistantOpen={assistantOpen} />}>
      <><form className="import-bar" id="import-form" onSubmit={event=>{event.preventDefault();if(link.trim())setImportText(link)}}><Globe className="icon"/><input id="import-url" value={link} onChange={event=>setLink(event.target.value)} aria-label="收录新内容" placeholder="收录新内容：粘贴作品或博主链接…"/><button type="submit" hidden={!link.trim()}>添加 +</button></form>
      <div className="connection-strip"><button className="schedule-button" onClick={()=>selectView('schedule')}>采集调度</button></div></>
    </WorkspaceHeader>
    {mobileNav&&<button className="nav-scrim" aria-label="关闭创作导航" onClick={()=>setMobileNav(false)}/>}
    <StudioWorkbenchSidebar
      navigationExpanded={navigationExpanded} view={view}
      platform={platform} dashboard={dashboard}
      platformLabel={platformLabel} selectView={selectView} choosePlatform={choosePlatform}
    />
    <main id="radar-main" aria-busy={openingWriting} inert={mobileViewport&&mobileNav} className={`radar-main${view==='overview'?' action-dashboard':''}${view==='islands'?' radar-islands-active':''}${['industry','research'].includes(view)?' industry-research-active':''}${focus?' radar-writing-active':''}${!focus&&['topics','feed','works','accounts','schedule'].includes(view)?' radar-creation-active':''}`}>
      {focus?<StudioWriting key={draftId} draftId={draftId} initialMode={initialWritingMode} initialTab={initialTab} onSwitch={openDraft} onPick={(kind,id)=>{if(kind==='topic')void openTopic(id);else void openMaterial(id)}} onClose={async()=>{if(!(await canLeave()))return;setDraftId('');writingDirty.current=false;setView('topics');updateLocation('topics');changed()}} onChanged={changed}/>:['topics','feed'].includes(view)?<StudioCreationCenter initialTopicId={selectedRecord} revision={revision} onChanged={changed} onDraft={openDraft} notify={notify} feed={<StudioFeed total={total} feedMode={feedMode} setFeedMode={setFeedMode} range={range} setRange={setRange} keyword={keyword} setKeyword={setKeyword} status={status} setStatus={setStatus} offset={displayOffset} setOffset={setOffset} sample={sample} setSample={setSample} author={author} setAuthor={setAuthor} accounts={accounts} items={items} error={error} loading={loading} changed={() => void feedQuery.refetch()} setImportText={setImportText} selectView={selectView} openMaterial={(id,tab)=>void openMaterial(id,tab)} onAdopt={setAdopting}/>}/>:view==='works'?<StudioCollection key={collectionEntry} initialMaterialId={libraryMaterialId} explicitRecoveryId={recoveryMaterialId} onSelection={reflectCollectionSelection} revision={revision} initialReadState={readState} platform={platform} accountId={author} accounts={accounts} onAccount={setAuthor} onPlatform={setPlatform} onReadState={selectReadState} onMaterial={openMaterial} onTopic={id=>void openTopic(id)} onDraft={openDraft} onTasks={()=>selectView('pending')} onChanged={changed} onImport={()=>setImportText('')} notify={notify}/>:['accounts','drafts'].includes(view)?<StudioRecords key={view} kind={view} initialSelectedId={selectedRecord} revision={revision} onChanged={changed} onMaterial={openMaterial} onDraft={openDraft} onAccountMaterials={(id,materialId='')=>openCollection({kind:'account',value:id},materialId)} onTask={openTask} notify={notify} onImport={()=>setImportText('')}/>:<StudioOperations key={view} view={view} taskId={taskId} activeTask={task} onTask={showTask} onOpenTask={openTask} onNavigate={selectView} onPlatform={choosePlatform} onMaterial={openRecoveryMaterial} onTopic={id=>void openTopic(id)} notify={notify}/>}
    </main>
    <StudioStatusBar error={footerError} pending={footerPending} status={taskDisplay?.status} message={footerMessage} taskId={taskId} initialTaskError={initialTaskError} active={taskActive} onRetry={changed} onOpenLog={()=>taskId?setLogOpen(true):selectView('tasks')} onStop={()=>void stopTask()}/>
  </div>
    <StudioAssistantDrawer key={assistantContext.draftId||assistantContext.materialId||'global'} context={assistantContext} open={assistantOpen} close={()=>setAssistantOpen(false)} onTask={showTask} onDraft={id=>{setAssistantOpen(false);openDraft(id)}}/>
    <StudioInspirationDrawer open={ideasOpen} close={()=>setIdeasOpen(false)} onTopic={id=>void openTopic(id)} onChanged={changed}/>
    {adopting&&<StudioAdoptDialog material={adopting} close={()=>setAdopting(null)} onSaved={()=>{setAdopting(null);changed();notify('已采纳到选题')}}/>}
    {importText!==null&&<StudioImport initial={importText} close={()=>setImportText(null)} notify={notify} onTask={showTask} onCreated={async(kind,id)=>{setImportText(null);setLink('');changed();if(kind==='materials'){if(!(await canLeave()))return;setAuthor('all');setPlatform('all');setLibraryMaterialId(id);setDraftId('');setView('works');setMobileNav(false);readerDirty.current=false;writingDirty.current=false;selectReadState('all');updateLocation('works',id,'','all')}else{if(!(await canLeave()))return;setView('accounts');setSelectedRecord(id);setDraftId('');updateLocation('accounts','','',platform,id)}}}/>}
    {logOpen&&<StudioRunLogDrawer error={taskError} events={events} loaded={taskLog.logsLoaded} onClose={()=>setLogOpen(false)}/>}
    {(openingWriting||notice)&&<div className="original-notice" role="status">{openingWriting?'正在打开二创…':notice}</div>}
  </div>
}
