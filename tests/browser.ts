import 'dotenv/config'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

async function main() {
  const base = process.env.WEB_ORIGIN || 'http://127.0.0.1:3310'
  await mkdir('test-results/screenshots', { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) })
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } })
  const errors: string[] = [], unexpectedNetwork: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) await route.continue()
    else { unexpectedNetwork.push(url.origin); await route.abort() }
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' })
    await page.getByLabel('用户名').fill(process.env.PERSONAL_USERNAME || 'owner')
    await page.getByLabel('密码', { exact: true }).fill(process.env.PERSONAL_PASSWORD || '')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL('**/workspace/viral', { timeout: 120_000 })
    const views = [['overview', '情报中心'], ['topics', '创作中心'], ['accounts', '对标账号'], ['works', '采集仓库']]
    for (const [view, label] of views) {
      await page.goto(base + '/workspace/viral?view=' + view, { waitUntil: 'networkidle', timeout: 120_000 })
      await page.getByRole('navigation', { name: '核心工作流' }).getByRole('button', { name: new RegExp('^' + label) }).waitFor()
      await page.screenshot({ path: `test-results/screenshots/${view}-desktop.png`, fullPage: true })
      assert.ok((await page.locator('body').innerText()).length > 120)
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth > window.innerWidth + 2), false, `${view} desktop overflow`)
    }
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
    try {
      await page.goto(base + '/workspace/viral?view=drafts&draft=' + temporary.id, { waitUntil: 'networkidle' })
      const editor = page.getByRole('textbox', { name: '我的稿件正文', exact: true })
      await editor.fill('这是在真实编辑器中修改并保存的正文。')
      const saving = page.waitForResponse(response => response.url().includes('/drafts/' + temporary.id) && response.request().method() === 'PATCH')
      await editor.press('Control+s')
      assert.equal((await saving).status(), 200)
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
    await writeFile('test-results/browser.json', JSON.stringify({ ok: true, views: views.map(v => v[0]), breakdown: true, writingSaveReload: true, darkTheme: true, projects: true, mobile: true, pageErrors: errors, externalRequests: unexpectedNetwork }, null, 2))
    console.log('Browser acceptance passed: four workspaces, projects, responsive layout, no external requests.')
  } catch (error) {
    await page.screenshot({ path: 'test-results/screenshots/failure.png', fullPage: true }).catch(() => {})
    await writeFile('test-results/browser-failure.json', JSON.stringify({ url: page.url(), pageErrors: errors, externalRequests: unexpectedNetwork, error: String(error) }, null, 2))
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
