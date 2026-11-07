import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RadarPageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="admin-page-title" data-section={eyebrow}><div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export function RadarCard({ children, className }: { children: React.ReactNode; className?: string }) { return <section className={cn('radar-panel', className)}>{children}</section> }

export function RadarStat({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: LucideIcon; hint?: string }) {
  return <RadarCard><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>{hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}</div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ui-selection)] text-primary"><Icon className="h-4 w-4" /></span></div></RadarCard>
}

const statusLabels: Record<string, string> = { collected: '已采集', verifying: '待核实', verified: '已验证', clustered: '已聚类', selected: '已选择', expired: '已过期', proposed: '待确认', master_script: '母版脚本', producing: '制作中', ready_to_publish: '待发布', published: '已发布', reviewed: '已复盘', not_connected: '未连接', application_required: '待申请', connected: '已连接', syncing: '正常同步', expired_auth: '授权过期', platform_limited: '平台暂不开放', import_transition: '导入过渡', sync_error: '同步异常', future_phase: '后续阶段', draft: '草稿', active: '进行中', completed: '已完成', pending: '待处理', sent: '已发送', failed: '失败', not_configured: '未配置', accepted: '已接受', rejected: '已拒绝', archived: '已归档', needs_review: '需重新核对', opportunity: '创作机会', abandoned: '已放弃', confirmed: '已确认', planned: '已排期', ready: '待发布', cancelled: '已取消', pending_confirmation: '待确认发布', prepared: '已准备', blocked: '等待配置', disabled: '未启用', configured_unverified: '已配置 · 未验证', contacted: '已跟进', new: '新线索', not_implemented: '接入层就绪' }

export function RadarStatus({ status }: { status: string }) {
  const good = ['verified', 'connected', 'syncing', 'published', 'reviewed', 'completed', 'sent', 'confirmed', 'accepted'].includes(status)
  const warning = ['verifying', 'application_required', 'import_transition', 'pending', 'proposed', 'needs_review', 'pending_confirmation', 'blocked'].includes(status)
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px]', good ? 'border-[var(--ui-success)] bg-[var(--ui-success-bg)] text-[var(--ui-success)]' : warning ? 'border-[var(--ui-warning)] bg-[var(--ui-warning-bg)] text-[var(--ui-warning)]' : 'border-border bg-[var(--ui-surface-secondary)] text-muted-foreground')}>{statusLabels[status] || status}</span>
}

export function RadarEmpty({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center"><p className="text-sm text-muted-foreground">{title}</p><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">{description}</p></div> }
