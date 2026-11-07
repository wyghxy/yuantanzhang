'use client'
import { useMemo, type ReactNode } from 'react'
import { articleBlocks, type ArticleBlock } from './studio-article-blocks'
import styles from './StudioArticleBody.module.css'

export function ArticleBlockText({ block, children = block.text }: { block: ArticleBlock; children?: ReactNode }) {
  if (block.kind === 'heading') {
    const Heading = (['h2', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)[(block.level || 1) - 1]
    return <Heading className={styles.heading} data-level={block.level}>{children}</Heading>
  }
  if (block.kind === 'quote') return <blockquote className={styles.quote}>{children}</blockquote>
  return <p className={block.kind === 'list' ? styles.list : styles.paragraph}>{children}</p>
}

export function StudioArticleBody({ body, select, renderText, filter = '' }: { body: string; filter?: string; select?: (block: ArticleBlock, index: number) => ReactNode; renderText?: (block: ArticleBlock, index: number) => ReactNode }) {
  const blocks = useMemo(() => articleBlocks(body), [body])
  return <div className={styles.body}>{blocks.map((block, index) => (!filter || block.text.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) && <div className={styles.row} key={index}>
    {select?.(block, index)}<ArticleBlockText block={block}>{renderText?.(block, index) ?? block.text}</ArticleBlockText>
  </div>)}</div>
}
