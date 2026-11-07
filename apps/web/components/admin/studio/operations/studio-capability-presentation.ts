type Entry=Record<string,unknown>
export type CapabilityTone='neutral'|'success'|'warning'|'danger'
export type CapabilitySummary={label:string;tone:CapabilityTone;reason:string;next:string}
export function workspaceCapabilitySummary(_value:unknown):CapabilitySummary {
 return {label:'未接入',tone:'neutral',reason:'当前版本未接入此项外部处理能力。',next:''}
}
export function capabilityIndicator(_value:unknown){return {label:'暂不可用',color:'var(--ui-text-muted)'}}
export function capabilityEvidenceTime(value:unknown,now=Date.now()){
 const time=(value as Entry|null)?.observedAt
 return typeof time==='string'&&Number.isFinite(Date.parse(time))&&Date.parse(time)<=now ? time:''
}
