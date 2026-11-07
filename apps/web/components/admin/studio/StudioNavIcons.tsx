/**
 * 侧栏两个业务图标的专属画法，其余导航仍用 lucide。
 *
 * 共通规格：24 网格、1.65 描边（与侧栏 CSS 一致）、圆端点、不填充。
 * 1.65 在 20px 显示时约 1.4px，和相邻 lucide 图标同粗细。
 *
 * 情报中心：圆环留 60° 缺口，圆心向外一支短指针加一个点 —— 雷达扫描的简写。
 * 对标账号：人像加右上角取景角 —— 被框定下来当参照的那个账号。
 * 两者都是「观测」的手势，一个转着找，一个框住看。
 */

type NavIconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IntelligenceNavIcon({ className }: NavIconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M16.1 4.9A8.2 8.2 0 1 0 20.2 12" />
      <path d="M12 12 16.6 9.4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BenchmarkNavIcon({ className }: NavIconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9.8" cy="9.2" r="3.4" />
      <path d="M3.9 19.9c0-3.3 2.7-5.4 6-5.4 1.4 0 2.6.4 3.6 1.1" />
      <path d="M14.8 3.4H21.2V10" />
    </svg>
  )
}
