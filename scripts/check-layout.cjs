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
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname
      let data = []
      if (pathname.endsWith('/auth/login')) data = { token: 'preview-token', user }
      else if (pathname.endsWith('/auth/me')) data = user
      else if (pathname.endsWith('/transactions')) data = transactions
      else if (pathname.endsWith('/budget-limits')) data = {}
      else if (pathname.endsWith('/goals')) data = [{ id: 'g1', name: 'Minha reserva', targetAmount: 15000, currentAmount: 1800 }]
      else if (pathname.endsWith('/ai/expense-assistant')) data = { reply: 'Despesa de R$ 42 registrada em Transporte.', created: true, transaction: transactions[1] }
      await route.fulfill({ json: data })
    })
    await page.goto('http://127.0.0.1:8831')
    await page.getByText('Bom ter você', { exact: false }).waitFor()
    await page.screenshot({ path: path.join(output, 'login.png') })
    await page.getByLabel('Email', { exact: true }).fill('preview@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('preview-only')
    await page.getByText('Entrar', { exact: true }).last().click()
    await page.getByText('Seu saldo disponível', { exact: true }).waitFor()
    assert.equal(await page.getByRole('tab').count(), 4)
    assert.equal(await page.getByRole('button', { name: 'Adicionar lançamento' }).count(), 1)
    await page.screenshot({ path: path.join(output, 'home.png') })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByLabel('Mensagem para o assistente').fill('Gastei R$ 42 no Uber hoje')
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await page.getByText('Despesa de R$ 42 registrada em Transporte.').waitFor()
    await page.waitForTimeout(500) // Wait for the conversation scroll animation.
    await page.screenshot({ path: path.join(output, 'chat.png') })
    await page.getByRole('tab', { name: 'Mais' }).click()
    for (const label of ['Metas e orçamento', 'Gráficos e relatórios', 'Receitas e contas fixas', 'Simulador de cenários']) assert.ok(await page.getByText(label, { exact: true }).count())
    await page.screenshot({ path: path.join(output, 'more.png') })
    for (const [label, filename] of [['Metas e orçamento', 'goals'], ['Gráficos e relatórios', 'charts'], ['Receitas e contas fixas', 'recurring'], ['Simulador de cenários', 'simulator']]) {
      await page.getByText(label, { exact: true }).click()
      await page.screenshot({ path: path.join(output, filename + '.png') })
      await page.getByRole('tab', { name: 'Mais' }).click()
    }
    await page.getByRole('button', { name: 'Adicionar lançamento' }).click()
    await page.getByText('Nova transacao', { exact: true }).waitFor()
    await page.waitForTimeout(500) // Wait for the sheet opening animation.
    await page.screenshot({ path: path.join(output, 'transaction.png') })
    await page.getByText('Cancelar', { exact: true }).click()
    await page.getByText('Nova transacao', { exact: true }).waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.getByRole('tab', { name: 'Início' }).click()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'The page must not overflow horizontally')
    await page.screenshot({ path: path.join(output, 'home-small.png') })
    assert.deepEqual(errors, [])
    console.log('Mobile layout checks passed. Screenshots: dist/preview')
  } finally { await browser.close(); server.close() }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
