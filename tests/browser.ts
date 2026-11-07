import 'dotenv/config'
import { chromium, type BrowserContext } from 'playwright'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import { personalDatabase } from '../prisma/sqlite-runtime.cjs'
import { assertLoopbackApi, assertPersonalSqlite, deleteOwnFixtures } from './demo-cleanup.integration'
import { mkdir, writeFile } from 'node:fs/promises'

async function main() {
  const base = process.env.WEB_ORIGIN || 'http://127.0.0.1:3310'
  assertLoopbackApi(base)
  const db=personalDatabase()
  await assertPersonalSqlite(db)
  let workspaceId=''
  const fixtureIds=new Set<string>(), sessions=new Set<string>()
  await mkdir('test-results/screenshots', { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) })
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } })
  const errors: string[] = [], unexpectedNetwork: string[] = [], nativePopups: string[] = []
  const official='https://yuantanzhang.cn/workspace/viral'
  const onlyLocal=(ctx:BrowserContext)=>ctx.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) await route.continue()
    else { unexpectedNetwork.push(url.origin); await route.abort() }
  })
  await onlyLocal(context)
  const createdDrafts:Promise<void>[]=[]
  context.on('response',reply=>{
    if(new URL(reply.url()).pathname!=='/api/workspace/studio/drafts'||reply.request().method()!=='POST'||reply.status()!==201)return
    createdDrafts.push(reply.json().then(({item})=>{if(item?.id)fixtureIds.add(item.id)}))
  })
  const rememberSession=async ()=>{
    for(const item of await context.cookies(base)) {
      if(item.name==='ytz_personal_session'&&item.httpOnly&&item.sameSite==='Strict') sessions.add(item.name+'='+item.value)
    }
  }
  const page = await context.newPage()
  const loginVisits:string[]=[]
  page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&new URL(frame.url(),'http://localhost').pathname==='/login')loginVisits.push('/login')})
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog',async dialog=>{nativePopups.push(dialog.type());await dialog.dismiss()})
  try {
    const offline=await browser.newPage()
    const offlineRequests:string[]=[]
    try {
      await offline.route('**/*',async route=>{
        const protocol=new URL(route.request().url()).protocol
        if(['file:','data:','blob:'].includes(protocol)){await route.continue();return}
        offlineRequests.push(protocol);await route.abort()
      })
      await offline.goto(pathToFileURL(resolve(__dirname,'../开始使用.html')).href)
      assert.equal(await offline.getByRole('link',{name:/立即使用官方在线版/}).getAttribute('href'),official)
      assert.equal(await offline.getByRole('link',{name:'打开本机个人版'}).getAttribute('href'),'http://127.0.0.1:3310/workspace/viral')
      await offline.setViewportSize({width:1440,height:900})
      await offline.screenshot({path:'test-results/screenshots/start-page-desktop.png',fullPage:true})
      await offline.setViewportSize({width:390,height:844})
      assert.equal(await offline.locator('body').evaluate(el=>el.scrollWidth>innerWidth+2),false)
      await offline.screenshot({path:'test-results/screenshots/start-page-mobile.png',fullPage:true})
      assert.deepEqual(offlineRequests,[],'离线开始页面不得依赖访问外网或后台')
    }finally{await offline.close()}
    const projects=await browser.newContext()
    try{
      await onlyLocal(projects)
      const cold=await projects.newPage()
      assert.equal((await projects.request.get(base+'/api/workspace/content-projects')).status(),401)
      await cold.goto(base+'/workspace/creation',{waitUntil:'networkidle',timeout:120_000})
      await cold.getByRole('heading',{name:'创作工作台',exact:true}).waitFor({timeout:120_000})
      assert.equal(new URL(cold.url()).pathname,'/workspace/creation')
      assert.equal(await cold.locator('input[type=password]').count(),0)
      assert.equal((await projects.request.get(base+'/api/workspace/content-projects')).status(),200)
    }finally{
      for(const item of await projects.cookies(base))if(item.name==='ytz_personal_session'&&item.httpOnly)sessions.add(item.name+'='+item.value)
      await projects.close()
    }
    const direct='/workspace/viral?view=topics'
    assert.equal((await context.request.get(base+'/api/workspace/studio/accounts')).status(),401)
    await page.goto(base+direct,{waitUntil:'networkidle',timeout:120_000})
    await page.getByRole('navigation',{name:'核心工作流'}).waitFor({timeout:120_000})
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,direct)
    assert.equal(await page.locator('input[type=password]').count(),0)
    await rememberSession()
    assert.ok(sessions.size>0)
    workspaceId=(await (await context.request.get(base+'/api/auth/me')).json()).workspace.id
    await page.reload({waitUntil:'networkidle'})
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,direct)
    assert.deepEqual(loginVisits,[],'直接访问工作台时不应绕行登录')
    await page.goto(base+'/',{waitUntil:'networkidle'})
    await page.getByRole('navigation',{name:'核心工作流'}).waitFor()
    assert.deepEqual(loginVisits,[],'根路径打开时不应绕行登录')
    await page.goto(base+'/login',{waitUntil:'networkidle'})
    await page.getByRole('navigation',{name:'核心工作流'}).waitFor()
    assert.equal(await page.locator('input[type=password]').count(),0)
    await page.getByRole('button',{name:/当前工作台：.+切换工作台/}).click()
    const switcher=page.getByRole('dialog',{name:'切换工作台'})
    await switcher.waitFor()
    assert.equal(await switcher.getByRole('button',{name:'退出登录'}).count(),0)
    await switcher.getByRole('button',{name:'关闭工作台菜单'}).click()
    const officialLink=page.locator('#workspace-header').getByRole('link',{name:/官方在线版/})
    await officialLink.waitFor()
    assert.equal(await officialLink.getAttribute('href'),official)
    assert.equal(await officialLink.getAttribute('target'),'_blank')
    assert.ok((await officialLink.getAttribute('rel')||'').includes('noopener'))
    assert.equal(await page.locator('#workspace-header .personal-edition-badge').innerText(),'个人版')
    const sourceEntry='https://source.example.invalid/bring-my-link'
    const addLink=page.getByRole('textbox',{name:'收录新内容'})
    await addLink.fill(sourceEntry);await addLink.press('Enter')
    await page.getByRole('button',{name:'本机采集',exact:true}).click()
    const fromImport=page.getByRole('dialog',{name:'本机采集设置',exact:true})
    assert.equal(await fromImport.getByLabel('来源链接').inputValue(),sourceEntry)
    await fromImport.getByRole('button',{name:'关闭本机采集设置'}).click()
    const views = [['overview', '情报中心'], ['topics', '创作中心'], ['accounts', '对标账号'], ['works', '采集仓库']]
    for (const [view, label] of views) {
      await page.goto(base + '/workspace/viral?view=' + view, { waitUntil: 'networkidle', timeout: 120_000 })
      await page.getByRole('navigation', { name: '核心工作流' }).getByRole('button', { name: new RegExp('^' + label) }).waitFor()
      assert.equal(await page.locator('.telemetry-pill').count(), 0, `${view} no platform badges in the page header`)
      assert.equal(await page.locator('.asr-status').count(), 0, `${view} no transcription badge in the page header`)
      await page.screenshot({ path: `test-results/screenshots/${view}-desktop.png`, fullPage: true })
      if (view === 'topics') await page.locator('#workspace-header').screenshot({ path: 'test-results/screenshots/header.png' })
      assert.ok((await page.locator('body').innerText()).length > 120)
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth > window.innerWidth + 2), false, `${view} desktop overflow`)
    }
    await page.getByRole('button', { name: '采集调度', exact: true }).click()
    const connectionStatus = page.getByRole('region', { name: '平台与转写状态', exact: true })
    await connectionStatus.waitFor()
    assert.equal(await connectionStatus.locator('.telemetry-pill').count(), 8)
    assert.equal(await connectionStatus.locator('.asr-status').count(), 1)
    assert.equal(await page.locator('.connection-strip .telemetry-pill').count(), 0)
    const collectorPath='/api/workspace/studio/local-collector'
    const configBefore=await (await context.request.get(base+collectorPath)).json()
    await page.getByRole('button',{name:'采集设置',exact:true}).click()
    const collector=page.getByRole('dialog',{name:'本机采集设置',exact:true})
    await collector.waitFor()
    const endpoint=collector.getByLabel('程序 HTTP 地址')
    await collector.getByText(configBefore.configured?'已保存地址':'未配置',{exact:true}).waitFor()
    if(!configBefore.configured) {
      assert.equal(await endpoint.inputValue(),'')
      await page.screenshot({path:'test-results/screenshots/local-collector-settings.png'})
    }
    await endpoint.fill('https://example.invalid/invalid-test-endpoint')
    await collector.getByRole('button',{name:/^保存(地址|设置)$/}).click()
    assert.match(await collector.getByRole('alert').innerText(),/本机 HTTP 地址/)
    assert.equal(await collector.getByRole('link',{name:/官方在线版/}).getAttribute('href'),official)
    const configAfter=await (await context.request.get(base+collectorPath)).json()
    assert.deepEqual(configAfter,configBefore,'打开设置或输入非法地址不修改用户配置')
    assert.deepEqual(nativePopups,[],'本机配置通过工作台表单呈现，不弹浏览器原生输入框')
    await collector.getByRole('button',{name:'关闭本机采集设置'}).click()
    await page.screenshot({ path: 'test-results/screenshots/schedule-desktop.png', fullPage: true })
    await connectionStatus.screenshot({ path: 'test-results/screenshots/schedule-status.png' })
    await page.goto(base + '/workspace/viral?view=topics', { waitUntil: 'networkidle' })
    const demoCard = page.locator('.feed-card').filter({ hasText: '演示' }).first()
    await demoCard.getByRole('button', { name: '爆款拆解', exact: true }).click()
    await page.getByRole('tab', { name: '爆款拆解', exact: true }).waitFor({ timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/screenshots/breakdown-desktop.png', fullPage: true })
    const draftsResponse = await context.request.get(base + '/api/workspace/studio/drafts?sample=only&limit=10')
    const drafts = await draftsResponse.json() as { items: Array<{ id: string; title: string }> }
    assert.ok(drafts.items.length >= 3)
    await page.goto(base + '/workspace/viral?view=drafts&draft=' + drafts.items[0].id, { waitUntil: 'networkidle' })
    await page.waitForFunction(title => [...document.querySelectorAll('input')].some(input => input.value === title) || document.body.textContent?.includes(title), drafts.items[0].title, { timeout: 30_000 })
    await page.screenshot({ path: 'test-results/screenshots/writing-desktop.png', fullPage: true })
    const temporaryResponse = await context.request.post(base + '/api/workspace/studio/drafts', { data: { title: '浏览器保存验证', body: '验证开始。' } })
    assert.equal(temporaryResponse.status(), 201)
    const temporary = (await temporaryResponse.json()).item as { id: string; version: number }
    fixtureIds.add(temporary.id)
    try {
      await page.goto(base + '/workspace/viral?view=drafts&draft=' + temporary.id, { waitUntil: 'networkidle' })
      const editor = page.getByRole('textbox', { name: '我的稿件正文', exact: true })
      await editor.fill('这是在真实编辑器中修改并保存的正文。')
      await rememberSession()
      const rejected=page.waitForResponse(r=>r.url().includes('/drafts/'+temporary.id)&&r.request().method()==='PATCH'&&r.status()===401)
      const recovery=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/local'&&r.request().method()==='POST'&&r.status()===200)
      const saving = page.waitForResponse(response => response.url().includes('/drafts/' + temporary.id) && response.request().method() === 'PATCH' && response.status()===200)
      await context.clearCookies()
      await editor.press('Control+s')
      await Promise.all([rejected,recovery,saving]);await rememberSession()
      assert.ok(sessions.size>=3,'失效的 cookie 必须被新的本机会话替换')
      const stored=(await (await context.request.get(base+'/api/workspace/studio/drafts/'+temporary.id)).json()).item
      assert.equal(stored.version,temporary.version+1,'一次保存只提交一个新版本')
      await page.reload({ waitUntil: 'networkidle' })
      assert.ok((await editor.innerText()).includes('真实编辑器中修改并保存'))
    } finally {
      const latest = await (await context.request.get(base + '/api/workspace/studio/drafts/' + temporary.id)).json()
      await context.request.delete(base + '/api/workspace/studio/drafts/' + temporary.id, { data: { expectedVersion: latest.item.version } })
    }
    await page.goto(base + '/workspace/viral?view=drafts&draft=' + drafts.items[0].id, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.setItem('yuantanzhang-theme', 'dark'))
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    await page.screenshot({ path: 'test-results/screenshots/writing-dark.png', fullPage: true })
    await page.evaluate(() => localStorage.setItem('yuantanzhang-theme', 'light'))
    await page.goto(base + '/workspace/creation', { waitUntil: 'networkidle', timeout: 120_000 })
    assert.ok(!(await page.locator('body').innerText()).includes('404'))
    await page.screenshot({ path: 'test-results/screenshots/projects-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base + '/workspace/viral?view=topics', { waitUntil: 'networkidle' })
    await page.screenshot({ path: 'test-results/screenshots/topics-mobile.png', fullPage: true })
    assert.equal(await page.locator('body').evaluate(element => element.scrollWidth > window.innerWidth + 2), false, 'mobile page overflow')
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpectedNetwork, [])
    await writeFile('test-results/browser.json', JSON.stringify({ ok: true, views: views.map(v => v[0]), offlineStartPage:true, officialOnlineHref:official, localCollectorDialog:true, collectionSourceCarried:true, coldContentProjects:true, directLocalEntry:true, freshDeepLink:true, sessionRecoveredDuringSave:true, statusBadgesOnlyInSchedule: true, breakdown: true, writingSaveReload: true, darkTheme: true, projects: true, mobile: true, pageErrors: errors, externalRequests: unexpectedNetwork }, null, 2))
    console.log('Browser acceptance passed: four workspaces, projects, responsive layout, no external requests.')
  } catch (error) {
    await page.screenshot({ path: 'test-results/screenshots/failure.png', fullPage: true }).catch(() => {})
    await writeFile('test-results/browser-failure.json', JSON.stringify({ url: page.url(), pageErrors: errors, externalRequests: unexpectedNetwork, error: String(error) }, null, 2))
    throw error
  } finally {
    try {
      await rememberSession()
      for(const cookie of sessions) {
        const end=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie,origin:base},redirect:'error'})
        assert.equal(end.status,200)
      }
      await Promise.all(createdDrafts)
      await deleteOwnFixtures(db,workspaceId,[...fixtureIds],[])
    } finally {await db.$disconnect();await context.close();await browser.close()}
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
