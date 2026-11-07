export const externalCapabilityNotice = '当前版本未接入此项外部处理能力。'
export function assertPersonalAction(path: string, method: string, _body?: Record<string, unknown>) {
  const [resource, id, action] = path.split('?')[0].split('/')
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
