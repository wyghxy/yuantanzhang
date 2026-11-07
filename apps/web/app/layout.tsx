import type { ReactNode } from 'react'
import {cookies} from 'next/headers'
import SiteThemeProvider from '@/components/SiteTheme'
import {initialPreference,themeKey,themeBootstrap} from '@/lib/site-theme'
import '@/styles/ui-theme.css'
import '@/styles/ui-typography.css'
import '@/styles/ui-admin-font.css'
import './utility.css'
import './personal.css'
export const metadata = {title:'元探长',description:'个人创作、对标账号与素材收录'}
export default async function RootLayout({children}:{children:ReactNode}) {
 const preference=initialPreference((await cookies()).get(themeKey)?.value,null)
 return <html lang="zh-CN" data-preference={preference} data-theme={preference==='dark'?'dark':'light'} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body><SiteThemeProvider initialTheme={preference}>{children}</SiteThemeProvider></body></html>
}
