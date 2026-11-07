import { object, text, type RecordItem } from './studio-client'

const collectionKinds = new Set(['resolve_creator', 'collect_creator', 'import', 'prepare_source', 'prepare_player', 'transcribe'])
/** Task percentages and delayed metrics are not evidence of body collection progress. */
export function studioCollectionActivity(items: RecordItem[], platform = 'all', accountId = 'all', now = Date.now()) {
  const canonical = (value: string) => value === 'bili' ? 'bilibili' : value
  const tasks = items.filter(task => {
    const input = object(task.input)
    return collectionKinds.has(text(task.kind)) && ['queued', 'running'].includes(text(task.status))
      && !(task.status === 'queued' && Date.parse(text(task.notBefore)) > now)
      && (platform === 'all' || canonical(text(input.platform)) === canonical(platform))
      && (accountId === 'all' || input.accountId === accountId
        || object(input.target).kind === 'accounts' && object(input.target).id === accountId
        || input.entityKind === 'accounts' && input.entityId === accountId)
  })
  return { running: tasks.filter(task => task.status === 'running').length, queued: tasks.filter(task => task.status === 'queued').length }
}
