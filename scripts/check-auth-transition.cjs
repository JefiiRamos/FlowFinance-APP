// Local browser regression: export the web app first. No production API calls.
// node scripts/check-auth-transition.cjs <optional-path-to-playwright>
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require(process.argv[2] || 'playwright')
const root = path.resolve('dist')
const user = { id: 'preview', email: 'preview@example.com', name: 'Marina', onboardingCompleted: true }
const server = http.createServer((request, response) => {
  const file = path.join(root, new URL(request.url, 'http://localhost').pathname)
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html')
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }
  response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream')
  fs.createReadStream(target).pipe(response)
})

async function fixtures(page, errors) {
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint.endsWith('/auth/check-email')) return route.fulfill({ json: { exists: true } })
    if (endpoint.endsWith('/auth/login')) return route.fulfill({ json: { token: 'preview-token', user } })
    if (endpoint.endsWith('/auth/me')) return route.fulfill({ json: user })
    return route.fulfill({ json: endpoint.endsWith('/budget-limits') ? {} : [] })
  })
}

async function login(page) {
  await page.getByLabel('Seu e-mail', { exact: true }).fill(user.email)
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await page.getByLabel('Senha', { exact: true }).waitFor()
  await page.getByTestId('auth-shared-email').waitFor({ state: 'detached' })
  await page.getByLabel('Senha', { exact: true }).fill('preview-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function assertReady(page) {
  await page.getByTestId('account-content').waitFor()
  await page.getByTestId('account-content-reveal-mask').waitFor({ state: 'detached' })
  await page.waitForFunction(() => {
    const content = document.querySelector('[data-testid="account-content"]')
    if (!content || content.getBoundingClientRect().height < 100) return false
    for (let node = content; node; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) !== 1) return false
    }
    return true
  })
  const box = await page.getByText('Seu saldo disponível', { exact: true }).boundingBox()
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height)
  assert.equal(await page.getByRole('tab').count(), 4)
  assert.equal(await page.getByTestId('auth-flow-form').count(), 0, 'Authentication stack must unmount after login')
}

async function main() {
  await new Promise(resolve => server.listen(8834, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await fixtures(page, errors)
    await page.goto('http://127.0.0.1:8834')
    for (let session = 0; session < 3; session++) {
      await login(page)
      await page.waitForFunction(() => {
        const greeting = document.querySelector('[data-testid="account-welcome-greeting"]')
        return greeting && Number(getComputedStyle(greeting).opacity) > 0.99 && greeting.getBoundingClientRect().top > 300
      })
      assert.equal(await page.getByTestId('account-content').count(), 0, 'Content must wait for the header')
      await page.getByTestId('account-content-reveal-mask').waitFor()
      const header = await page.getByTestId('auth-shared-brand').boundingBox()
      assert.ok(header.y < 50, 'Header must finish before content reveal')
      await assertReady(page)
      await page.getByRole('tab', { name: 'Perfil', exact: true }).click()
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
      await page.getByLabel('Seu e-mail', { exact: true }).waitFor()
    }
    await login(page)
    await page.getByTestId('account-entry').waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await assertReady(page)
    await page.reload()
    await assertReady(page)
    assert.ok((await page.getByTestId('auth-shared-brand').boundingBox()).y < 50, 'Restored session must skip the introduction')
    const reduced = await browser.newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' })
    await fixtures(reduced, errors)
    await reduced.goto('http://127.0.0.1:8834')
    await login(reduced)
    await assertReady(reduced)
    assert.deepEqual(errors, [])
    console.log('Account entry checks passed: three logout/login cycles, header-before-content order, smooth reveal, interrupted animation, restored session and reduced motion.')
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
