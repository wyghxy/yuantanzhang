import type {Renderer} from './useOriginalComments'
const element=(tag:string,className:string,value?:string)=>{
 const node=document.createElement(tag);node.className=className;if(value!==undefined)node.textContent=value;return node
}
type Comment={text?:string;content?:string;nickname?:string;author?:string;like_count?:number;likes?:number}
export const renderer:Renderer={createPane({studio,host,ui}){
 const pane=element('section','cw-viral-comments');pane.hidden=true;pane.setAttribute('aria-label','爆款评论');studio.append(pane)
 return {pane,render(source){
  pane.replaceChildren();const raw=(source.comment_snapshot||{}) as {items?:Comment[];status?:string}
  const items=Array.isArray(raw.items)?raw.items:[]
  const heading=element('header','cw-comments-heading');heading.append(element('h2','','爆款评论'),element('span','',items.length+' 条'));pane.append(heading)
  const body=element('div','cw-comments-body');body.tabIndex=0;pane.append(body)
  if(!items.length){const empty=element('div','cw-comments-empty');empty.append(element('h3','',raw.status==='loading'?'正在读取评论…':raw.status==='failed'?'评论暂时无法读取':'暂无已保存评论'));body.append(empty);return}
  const list=element('ol','cw-comments-list');body.append(list)
  items.forEach((value,index)=>{const item=element('li','cw-comment'),content=element('div','cw-comment-content');const text=String(value.text||value.content||'')
   item.append(element('span','cw-comment-rank',String(index+1)),content);content.append(element('p','cw-comment-text',text))
   const likes=value.likes??value.like_count;content.append(element('p','cw-comment-meta',[value.author||value.nickname||'',likes!==undefined?likes+' 赞':''].filter(Boolean).join(' · ')))
   const save=document.createElement('button');save.type='button';save.className='cw-comment-save';save.dataset.commentIndex=String(index);save.textContent='加入我的笔记'
   save.onclick=()=>{const previous=host.notes(source.record_id),note=[previous,'【'+source.video_title+'】'+text].filter(Boolean).join('\n');if(note.length>12000){ui.showToast('笔记已接近 12,000 字');return}host.notes(source.record_id,note);ui.showToast('已加入笔记')}
   content.append(save);list.append(item)
  })
 }}
}}
