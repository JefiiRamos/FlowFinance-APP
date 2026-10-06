// Optional visual QA: node scripts/check-layout.cjs <path-to-playwright-module>
// Uses local fixtures only; no requests reach the production API.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require(process.argv[2] || 'playwright')
const root = path.resolve('dist')
const output = path.join(root, 'preview')
const user = { id: 'preview', email: 'preview@example.com', name: 'Marina', onboardingCompleted: true }
const transactions = [
  { id: '1', type: 'income', description: 'Salário', amount: 6200, date: new Date().toISOString(), category: 'Outros', paymentMethod: 'PIX' },
  { id: '2', type: 'expense', description: 'Supermercado', amount: 246.8, date: new Date().toISOString(), category: 'Alimentação', paymentMethod: 'PIX' },
  { id: '3', type: 'expense', description: 'Café da manhã', amount: 28, date: new Date().toISOString(), category: 'Alimentação', paymentMethod: 'PIX' },
]
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html')
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream')
  fs.createReadStream(target).pipe(res)
})
async function main() {
  fs.mkdirSync(output, { recursive: true })
  await new Promise(resolve => server.listen(8831, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    const errors = []
    let recurringUnavailable = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname.endsWith('/recurring') && recurringUnavailable) {
        await route.fulfill({ status: 405, body: '' })
        return
      }
      let data = []
      if (pathname.endsWith('/auth/login')) data = { token: 'preview-token', user }
      else if (pathname.endsWith('/auth/me')) data = user
      else if (pathname.endsWith('/transactions')) data = transactions
      else if (pathname.endsWith('/budget-limits')) data = {}
      else if (pathname.endsWith('/goals')) data = [{ id: 'g1', name: 'Minha reserva', targetAmount: 15000, currentAmount: 1800 }]
      else if (pathname.endsWith('/ai/expense-assistant')) data = { reply: 'Despesa de R$ 42 registrada em Transporte.', created: true, transaction: { ...transactions[1], amount: 42, category: 'Transporte', description: 'Uber' } }
      await route.fulfill({ json: data })
    })
    await page.goto('http://127.0.0.1:8831')
    await page.waitForFunction(() => {
      const body = document.querySelector('[data-testid="welcome-body"]')
      return body && Number(getComputedStyle(body).opacity) === 1
    })
    await page.getByRole('button', { name: 'Começar agora', exact: true }).waitFor()
    for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: path.join(output, 'welcome-' + width + '.png') })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('*')].every(node => {
        const overflow = getComputedStyle(node).overflowY
        return !['auto', 'scroll'].includes(overflow) || node.scrollHeight <= node.clientHeight + 1
      })), 'Welcome must not have a scrollable container')
      for (const name of ['Começar agora', 'Já tenho uma conta']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox()
        assert.ok(box.y >= 0 && box.y + box.height <= height && box.height >= 48, 'Welcome buttons must fit: ' + width + 'x' + height)
      }
    }
    await page.getByRole('button', { name: 'Começar agora', exact: true }).click()
    await page.getByLabel('Nome', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Voltar para boas-vindas' }).click()
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('Entre na sua conta', { exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, 'login.png') })
    await page.getByLabel('Email', { exact: true }).fill('preview@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('preview-only')
    await page.getByText('Entrar', { exact: true }).last().click()
    await page.getByText('Seu saldo disponível', { exact: true }).waitFor()
    assert.equal(await page.getByRole('tab').count(), 5)
    const tabNames = await page.getByRole('tab').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
    assert.deepEqual(tabNames, ['Início', 'Extrato', 'Assistente IA', 'Metas', 'Mais'])
    await page.screenshot({ path: path.join(output, 'home.png') })
    await page.getByRole('tab', { name: 'Assistente IA' }).click()
    await page.getByLabel('Mensagem para o assistente').fill('Gastei R$ 42 no Uber hoje')
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await page.getByText('Despesa de R$ 42 registrada em Transporte.').waitFor()
    await page.waitForTimeout(500) // Wait for the conversation scroll animation.
    await page.screenshot({ path: path.join(output, 'chat.png') })
    await page.getByText('Lançamento registrado', { exact: true }).waitFor()
    await page.getByRole('tab', { name: 'Início' }).click()
    await page.getByRole('tab', { name: 'Assistente IA' }).click()
    await page.getByText('Despesa de R$ 42 registrada em Transporte.').waitFor()
    await page.getByRole('tab', { name: 'Mais' }).click()
    for (const label of ['Metas e orçamento', 'Gráficos e relatórios', 'Receitas e contas fixas', 'Simulador de cenários']) assert.ok(await page.getByText(label, { exact: true }).count())
    await page.screenshot({ path: path.join(output, 'more.png') })
    for (const [label, filename] of [['Metas e orçamento', 'goals'], ['Gráficos e relatórios', 'charts'], ['Receitas e contas fixas', 'recurring'], ['Simulador de cenários', 'simulator']]) {
      await page.getByText(label, { exact: true }).click()
      await page.screenshot({ path: path.join(output, filename + '.png') })
      await page.getByRole('tab', { name: 'Mais' }).click()
    }
    await page.getByRole('tab', { name: 'Extrato' }).click()
    await page.getByLabel('Buscar transações').fill('Supermercado')
    assert.equal(await page.getByText('Café da manhã', { exact: true }).count(), 0)
    await page.getByLabel('Buscar transações').fill('')
    await page.screenshot({ path: path.join(output, 'transactions.png') })
    await page.getByRole('button', { name: 'Nova', exact: true }).click()
    await page.getByText('Nova transacao', { exact: true }).waitFor()
    await page.waitForTimeout(500) // Wait for the sheet opening animation.
    await page.screenshot({ path: path.join(output, 'transaction.png') })
    await page.getByText('Cancelar', { exact: true }).click()
    await page.getByText('Nova transacao', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByText('Supermercado', { exact: true }).locator('..').locator('..').locator('..').getByRole('button', { name: 'Editar', exact: true }).click()
    await page.getByLabel('Valor (R$)').waitFor()
    assert.equal(await page.getByLabel('Valor (R$)').inputValue(), '246,80')
    await page.getByText('Cancelar', { exact: true }).click()
    await page.getByText('Editar transacao', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByText('Nova transacao', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('tab', { name: 'Início' }).click()
    for (const width of [320, 360, 390, 430, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow at ' + width)
      for (const tab of await page.getByRole('tab').all()) {
        const box = await tab.boundingBox()
        assert.ok(box.x >= 0 && box.x + box.width <= width && box.height >= 48, 'Tabs must fit and remain touchable')
      }
      await page.screenshot({ path: path.join(output, 'home-' + width + '.png') })
    }
    user.name = 'Marina de Albuquerque Ferreira da Silva'
    transactions[0].amount = 123456789.12
    transactions[1].description = 'Compra de supermercado com descrição extensa para validar leitura em telas pequenas'
    await page.setViewportSize({ width: 360, height: 844 })
    await page.reload()
    await page.getByText('Seu saldo disponível', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Large values must not overflow')
    await page.screenshot({ path: path.join(output, 'home-long-values.png') })
    await page.getByRole('tab', { name: 'Extrato' }).click()
    await page.getByText(transactions[1].description, { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Long descriptions must not overflow')
    await page.screenshot({ path: path.join(output, 'transactions-long-values.png') })
    recurringUnavailable = true
    await page.reload()
    await page.getByText('Seu saldo disponível', { exact: true }).waitFor()
    await page.getByText('Receitas recorrentes temporariamente indisponíveis.', { exact: false }).waitFor()
    assert.equal(await page.getByRole('tab').count(), 5)
    assert.deepEqual(errors, [])
    console.log('Mobile layout checks passed. Screenshots: dist/preview')
  } finally { await browser.close(); server.close() }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
