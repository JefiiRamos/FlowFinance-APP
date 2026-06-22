export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  description: string
  amount: number
  date: string
  category?: string
  paymentMethod?: string
}

export interface MonthlyProjection {
  monthName: string
  income: number
  expenses: number
  balance: number
  accumulatedBalance: number
}

export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function getTotalIncome(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
}

export function getTotalExpenses(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
}

export function getBalance(transactions: Transaction[]): number {
  return getTotalIncome(transactions) - getTotalExpenses(transactions)
}

export function currentMonthTransactions(transactions: Transaction[]): Transaction[] {
  const now = new Date()
  return transactions.filter((t) => {
    const date = new Date(t.date)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  })
}

export function getProjectedEndOfMonthBalance(transactions: Transaction[], currentBalance: number): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(0, daysInMonth - now.getDate())
  const monthExpenses = getTotalExpenses(currentMonthTransactions(transactions))
  const dailyExpenseRate = now.getDate() > 0 ? monthExpenses / now.getDate() : 0
  return currentBalance - dailyExpenseRate * daysLeft
}

export function monthlyProjections(transactions: Transaction[]): MonthlyProjection[] {
  const income = Array(12).fill(0)
  const expenses = Array(12).fill(0)
  const year = new Date().getFullYear()

  for (const transaction of transactions) {
    const date = new Date(transaction.date)
    if (date.getFullYear() !== year) continue
    const month = date.getMonth()
    if (transaction.type === 'income') income[month] += transaction.amount
    else expenses[month] += transaction.amount
  }

  let accumulatedBalance = 0
  return MONTH_NAMES.map((monthName, index) => {
    const balance = income[index] - expenses[index]
    accumulatedBalance += balance
    return { monthName, income: income[index], expenses: expenses[index], balance, accumulatedBalance }
  })
}

export function topSpendingCategories(transactions: Transaction[], limit = 5) {
  const totals: Record<string, number> = {}
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    const category = transaction.category ?? 'Outros'
    totals[category] = (totals[category] ?? 0) + transaction.amount
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, amount]) => ({ category, amount }))
}

export function financialInsight(transactions: Transaction[]): string {
  const month = currentMonthTransactions(transactions)
  const income = getTotalIncome(month)
  const expenses = getTotalExpenses(month)
  if (transactions.length === 0) return 'Comece registrando receitas e gastos para receber leituras mais precisas.'
  if (income <= 0) return 'Ainda nao ha receita neste mes. Registre entradas para acompanhar sua margem real.'
  const percent = (expenses / income) * 100
  if (percent < 50) return 'Seu mes esta com boa folga. Voce pode direcionar parte do saldo para metas ou reserva.'
  if (percent < 80) return 'Seu ritmo esta equilibrado. Acompanhe categorias maiores para manter previsibilidade.'
  if (percent < 100) return 'Atencao: os gastos ja consomem boa parte da receita do mes.'
  return 'Os gastos do mes passaram da receita. Priorize cortes imediatos e revise despesas fixas.'
}

