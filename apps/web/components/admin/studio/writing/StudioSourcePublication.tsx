import React from 'react'
import type { originalPublication } from '@ytz/contracts/studio-radar'

export function StudioSourcePublication({ publication }: { publication: ReturnType<typeof originalPublication> }) {
  const title = publication?.title.trim() || ''
  const description = publication?.description.trim() || ''
  return <>
    <section className="cw-topics-section">
      <h3>原作品标题</h3>
      <p>{title || '未取得原作品标题'}</p>
    </section>
    <section className="cw-topics-section">
      <h3>原作品发布文案</h3>
      <p>{description ? description === title ? '与原作品标题相同。' : description : '未取得原作品发布文案'}</p>
    </section>
    <section className="cw-topics-section">
      <h3>原作品话题</h3>
      <ul className="cw-topic-directions">{(publication?.topics.length ? publication.topics : ['未取得原作品话题']).map((topic, i) => <li key={i}>{topic}</li>)}</ul>
    </section>
    <section className="cw-topics-section">
      <h3>原作品标签</h3>
      <div className="cw-topic-tags">{publication?.tags.length ? publication.tags.map((tag, i) => <span key={i}># {tag}</span>) : <span>未取得原作品标签</span>}</div>
    </section>
  </>
}
