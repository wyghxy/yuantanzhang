import { HttpException } from '@nestjs/common'
import { Prisma, type StudioRecord } from '@prisma/client'
import { personalDatabase } from '../../../prisma/sqlite-runtime.cjs'
export const db = personalDatabase()
export type Data = Record<string, unknown>
export type Tx = Prisma.TransactionClient
export type Scope = { ownerId: string; workspaceId: string }
export const obj = (v: unknown): Data => v && typeof v === 'object' && !Array.isArray(v) ? v as Data : {}
export const json = (v: Data) => v as Prisma.InputJsonObject
export const txt = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
export function fail(status: number, code: string, message: string): never { throw new HttpException({ code, error: message }, status) }
export function show(r: StudioRecord) {
  const d=obj(r.data)
  const referenceIds=new Set<string>()
  if(r.kind==='topics'){
    if(typeof d.materialId==='string'&&d.materialId)referenceIds.add(d.materialId)
    for(const input of [d.materialIds,d.sourceMaterialIds,d.referenceIds])if(Array.isArray(input))for(const id of input)if(typeof id==='string'&&id)referenceIds.add(id)
    if(Array.isArray(d.references))for(const row of d.references){const id=obj(row).materialId;if(typeof id==='string'&&id)referenceIds.add(id)}
  }
  return { ...d, ...(r.kind==='topics'?{referenceCount:referenceIds.size}:{}), id:r.id, kind:r.kind, version:r.version,sample:r.sample,isSample:r.sample,createdAt:r.createdAt,updatedAt:r.updatedAt,deletedAt:r.deletedAt }
}
export function version(v: unknown) { const n=typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN; if (!Number.isInteger(n)||n<1) fail(400,'version_required','需要当前记录版本'); return n }
export const kinds = ['accounts','materials','topics','drafts','identities','ideas','works','reports','candidates','notes'] as const
export const singular:Record<string,string>={accounts:'account',materials:'material',topics:'topic',drafts:'draft',identities:'identity',ideas:'idea',works:'work',reports:'report',candidates:'candidate',notes:'note'}
export function known(k: string) { if (!kinds.includes(k as typeof kinds[number])) fail(404,'not_found','未找到该功能'); return k }
export async function record(tx:Tx, scope:Scope, kind:string,id:string, includeTrash=false) {
  const r=await tx.studioRecord.findFirst({where:{id,workspaceId:scope.workspaceId,workspace:{ownerId:scope.ownerId},kind,...(!includeTrash?{deletedAt:null}:{})}})
  if (!r) fail(404,'not_found','未找到这条记录'); return r
}
export function conflict():never { return fail(409,'version_conflict','记录已更新，请刷新后重试；当前修改未覆盖已保存版本') }
