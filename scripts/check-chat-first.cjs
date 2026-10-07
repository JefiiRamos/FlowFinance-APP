// Run after the web export. All API requests are intercepted with local fixtures.
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

async function main() {
  await new Promise(resolve => server.listen(8835, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const errors = []
  try {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
      page.on('pageerror', error => errors.push(error.message))
      const now = new Date()
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString()
      let transactions = [
        { id: '1', type: 'income', amount: 1000, date: now.toISOString(), category: 'Outros', description: 'Salário', paymentMethod: 'PIX' },
        { id: '2', type: 'expense', amount: 200, date: now.toISOString(), category: 'Alimentação', description: 'Mercado', paymentMethod: 'PIX' },
        { id: '3', type: 'expense', amount: 500, date: previousMonth, category: 'Outros', description: 'Mês anterior', paymentMethod: 'PIX' },
      ]
      let assistantRequests = 0
      const dataReads = []
      await page.route('**/api/**', route => {
        const endpoint = new URL(route.request().url()).pathname
        if (route.request().method() === 'GET') dataReads.push(endpoint)
        if (endpoint.endsWith('/auth/check-email')) return route.fulfill({ json: { exists: true } })
        if (endpoint.endsWith('/auth/login')) return route.fulfill({ json: { token: 'preview-token', user } })
        if (endpoint.endsWith('/auth/me')) return route.fulfill({ json: user })
        if (endpoint.endsWith('/transactions')) return route.fulfill({ json: transactions })
        if (endpoint.endsWith('/ai/expense-assistant')) {
          assistantRequests++
          const transaction = { id: '4', type: 'expense', amount: 42, date: now.toISOString(), category: 'Transporte', description: 'Uber', paymentMethod: 'PIX' }
          transactions = [...transactions, transaction]
          return route.fulfill({ json: { reply: 'Gasto registrado.', created: true, transaction } })
        }
        return route.fulfill({ json: endpoint.endsWith('/budget-limits') ? {} : [] })
      })
      await page.goto('http://127.0.0.1:8835')
      await page.getByLabel('Seu e-mail', { exact: true }).fill(user.email)
      await page.getByRole('button', { name: 'Continuar', exact: true }).click()
      await page.getByLabel('Senha', { exact: true }).fill('preview-password')
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await page.getByRole('button', { name: 'Registrar gasto', exact: true }).waitFor()
      assert.equal(await page.getByText('FlowFinance', { exact: true }).count(), 1)
      assert.equal(await page.getByText('Marina', { exact: true }).count(), 0, 'No second user header')
      for (const [label, value] of [['Ver visão geral do saldo', 'R$ 300,00'], ['Ver gastos no extrato', 'R$ 200,00']]) {
        const fits = await page.getByRole('button', { name: label, exact: true }).getByText(value, { exact: true }).evaluate(node => node.scrollWidth <= node.clientWidth + 1)
        assert.ok(fits, 'Summary amounts must remain fully readable at ' + width)
      }
      for (const name of ['Registrar gasto', 'Entender meu mês', 'Planejar meta']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox()
        assert.ok(box.y >= 0 && box.y + box.height <= height, 'Shortcuts must fit at ' + width)
      }
      fs.mkdirSync(path.join(root, 'preview'), { recursive: true })
      await page.screenshot({ path: path.join(root, 'preview', 'chat-first-' + width + '.png') })
      await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click()
      assert.equal(await page.getByLabel('Mensagem para o assistente').inputValue(), 'Gastei R$ ')
      assert.equal(assistantRequests, 0, 'Draft must not create a transaction')
      await page.getByRole('button', { name: 'Planejar meta', exact: true }).click()
      await page.getByLabel('Nome da meta', { exact: true }).waitFor()
      await page.getByRole('tab', { name: 'Conversa', exact: true }).click()
      assert.equal(await page.getByLabel('Mensagem para o assistente').inputValue(), 'Gastei R$ ')
      await page.getByRole('button', { name: 'Entender meu mês', exact: true }).click()
      const summary = await page.getByText('Seu mês até agora:', { exact: false }).innerText()
      assert.ok(summary.includes('1.000,00') && summary.includes('200,00') && summary.includes('800,00'))
      assert.ok(!summary.includes('500,00'), 'Monthly summary must exclude last month')
      assert.equal(assistantRequests, 0)
      dataReads.length = 0
      await page.getByLabel('Mensagem para o assistente').fill('Gastei R$ 42 no Uber hoje')
      await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click()
      await page.getByText('Lançamento registrado', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Ver gastos no extrato', exact: true }).getByText('R$ 242,00', { exact: true }).waitFor()
      assert.deepEqual(dataReads.map(endpoint => endpoint.split('/').at(-1)), ['transactions'], 'Chat expense should refresh only transactions')
      await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Ver gastos no extrato', exact: true }).getByText('•••••', { exact: true }).count(), 1)
      await page.getByRole('tab', { name: 'Extrato', exact: true }).click()
      await page.getByRole('tab', { name: 'Conversa', exact: true }).click()
      await page.getByText('Gasto registrado.', { exact: true }).waitFor()
      await page.close()
    }
    assert.deepEqual(errors, [])
    console.log('Chat-first checks passed: one header, responsive shortcuts, correct monthly summary, no accidental writes, summary refresh, privacy and persistent chat/draft.')
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
