export const externalCapabilityNotice = '当前版本未接入此项外部处理能力。'
export function assertPersonalAction(path: string, method: string, _body?: Record<string, unknown>) {
  const [resource, id, action] = path.split('?')[0].split('/')
  if(method.toUpperCase()!=='GET'&&(resource==='collections'||resource==='collectors'||(resource==='accounts'&&['recapture','capture'].includes(action)))){
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ytz-open-local-collector',{detail:{accountId:resource==='accounts'?id:Array.isArray(_body?.accountIds)?_body.accountIds[0]:undefined}}))
    throw new Error('请连接自己的本机采集程序，或直接使用官方在线版。')
  }
  if(resource==='source-images'){
    const query=new URLSearchParams(path.split('?')[1]||'')
    if(query.has('q')||query.get('kind')==='remote')throw new Error(externalCapabilityNotice)
  }
  if (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD') return
  if ((resource === 'tasks' && (!id || !['cancel','dismiss','restore-attention','discard'].includes(action))) ||
      ['collections','collectors','connections','dispatch','assistant-drafts','translate'].includes(resource) ||
      (resource === 'materials' && (id === 'content-batch' || ['prepare','player','comments','rehydrate','cover-repair','recover'].includes(action))) ||
      (resource === 'accounts' && ['recapture','refresh-profile','capture'].includes(action))) throw new Error(externalCapabilityNotice)
}
