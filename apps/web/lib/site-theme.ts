export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const themeKey = 'yuantanzhang-theme'
export function parseTheme(value: unknown): ThemePreference | null {
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}
export function resolveTheme(preference: ThemePreference, dark: boolean): ResolvedTheme {
  return preference === 'system' ? dark ? 'dark' : 'light' : preference
}
export function initialPreference(saved: unknown, legacy: unknown): ThemePreference {
  return parseTheme(saved) ?? parseTheme(legacy) ?? 'light'
}
// Runs before first paint; only predefined theme names are accepted.
export const themeBootstrap = `(()=>{let p=document.documentElement.dataset.preference||'light';try{const s=localStorage.getItem('yuantanzhang-theme');if(['light','dark','system'].includes(s))p=s;else localStorage.setItem('yuantanzhang-theme',p);}catch{}try{document.cookie='yuantanzhang-theme='+p+'; Path=/; Max-Age=31536000; SameSite=Lax'}catch{}let d=false;try{d=matchMedia('(prefers-color-scheme: dark)').matches}catch{}document.documentElement.dataset.preference=p;document.documentElement.dataset.theme=p==='system'?(d?'dark':'light'):p;document.documentElement.style.colorScheme=document.documentElement.dataset.theme;})();`
