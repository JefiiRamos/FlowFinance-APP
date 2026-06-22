import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Transaction, TransactionType } from './finance'

const AUTH_KEY = 'flowfinance:mock:token'
const DB_KEY = 'flowfinance:mock:supabase-cache'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  onboardingCompleted: boolean
  monthlyIncomeTarget?: number | null
  payDay?: number | null
  financialProfile?: string | null
  primaryGoal?: string | null
}

export interface GoalItem {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
}

export interface RecurringExpense {
  id: string
  name: string
  amount: number
  dueDay: number
}

export interface RecurringIncome {
  id: string
  description: string
  amount: number
  dayOfMonth: number
  startMonth: number
  endMonth: number
}

interface MockUser extends UserProfile {
  password: string
}

interface MockDb {
  users: MockUser[]
  transactionsByUser: Record<string, Transaction[]>
  goalsByUser: Record<string, GoalItem[]>
  limitsByUser: Record<string, Record<string, number>>
  recurringExpensesByUser: Record<string, RecurringExpense[]>
  recurringIncomeByUser: Record<string, RecurringIncome[]>
}

const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms))

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function createSeedDb(): MockDb {
  const userId = 'user_demo'
  const transactions: Transaction[] = [
    {
      id: id('tx'),
      type: 'income',
      description: 'Salario principal',
      amount: 6200,
      date: addDays(-8),
      category: 'Outros',
      paymentMethod: 'PIX',
    },
    {
      id: id('tx'),
      type: 'expense',
      description: 'Aluguel',
      amount: 1800,
      date: addDays(-7),
      category: 'Moradia',
      paymentMethod: 'Transferencia',
    },
    {
      id: id('tx'),
      type: 'expense',
      description: 'Supermercado',
      amount: 426.7,
      date: addDays(-4),
      category: 'Alimentacao',
      paymentMethod: 'Cartao de Debito',
    },
    {
      id: id('tx'),
      type: 'expense',
      description: 'Uber',
      amount: 38.9,
      date: addDays(-2),
      category: 'Transporte',
      paymentMethod: 'PIX',
    },
    {
      id: id('tx'),
      type: 'income',
      description: 'Freelance landing page',
      amount: 900,
      date: todayIso(),
      category: 'Outros',
      paymentMethod: 'PIX',
    },
  ]

  return {
    users: [
      {
        id: userId,
        email: 'demo@flowfinance.app',
        password: '123456',
        name: 'Demo',
        onboardingCompleted: true,
        monthlyIncomeTarget: 6200,
        payDay: 5,
        financialProfile: 'equilibrado',
        primaryGoal: 'organizar',
      },
    ],
    transactionsByUser: { [userId]: transactions },
    goalsByUser: {
      [userId]: [
        { id: id('goal'), name: 'Reserva de emergencia', targetAmount: 15000, currentAmount: 0 },
        { id: id('goal'), name: 'Viagem', targetAmount: 6000, currentAmount: 0 },
      ],
    },
    limitsByUser: {
      [userId]: {
        Alimentacao: 1200,
        Transporte: 600,
        Lazer: 700,
      },
    },
    recurringExpensesByUser: {
      [userId]: [
        { id: id('rexp'), name: 'Aluguel', amount: 1800, dueDay: 8 },
        { id: id('rexp'), name: 'Internet', amount: 119.9, dueDay: 12 },
      ],
    },
    recurringIncomeByUser: {
      [userId]: [
        { id: id('rinc'), description: 'Salario principal', amount: 6200, dayOfMonth: 5, startMonth: 1, endMonth: 12 },
      ],
    },
  }
}

async function readDb(): Promise<MockDb> {
  const raw = await AsyncStorage.getItem(DB_KEY)
  if (!raw) {
    const seed = createSeedDb()
    await writeDb(seed)
    return seed
  }

  try {
    return JSON.parse(raw) as MockDb
  } catch {
    const seed = createSeedDb()
    await writeDb(seed)
    return seed
  }
}

async function writeDb(db: MockDb) {
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db))
}

async function currentUserId() {
  const token = await AsyncStorage.getItem(AUTH_KEY)
  if (!token) throw new Error('Sessao mock nao encontrada')
  return token.replace('mock-token:', '')
}

async function withDb<T>(fn: (db: MockDb, userId: string) => T | Promise<T>) {
  const db = await readDb()
  const userId = await currentUserId()
  const result = await fn(db, userId)
  await writeDb(db)
  await wait()
  return result
}

export function getApiBaseUrl() {
  return 'mock://supabase-cache-local'
}

export function setAuthToken(token: string) {
  return AsyncStorage.setItem(AUTH_KEY, token)
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_KEY)
}

export function clearAuthToken() {
  return AsyncStorage.removeItem(AUTH_KEY)
}

export async function login(email: string, password: string) {
  const db = await readDb()
  const normalizedEmail = email.trim().toLowerCase()
  let user = db.users.find((item) => item.email === normalizedEmail && item.password === password)

  if (!user && normalizedEmail === 'demo@flowfinance.app' && password === '123456') {
    user = db.users[0]
  }

  if (!user) throw new Error('Email ou senha incorretos no mock')

  await setAuthToken(`mock-token:${user.id}`)
  await wait()
  return toProfile(user)
}

export async function register(name: string, email: string, password: string) {
  const db = await readDb()
  const normalizedEmail = email.trim().toLowerCase()
  if (db.users.some((item) => item.email === normalizedEmail)) {
    throw new Error('Email ja cadastrado no mock')
  }

  const user: MockUser = {
    id: id('user'),
    email: normalizedEmail,
    password,
    name: name.trim() || null,
    onboardingCompleted: false,
    monthlyIncomeTarget: null,
    payDay: null,
    financialProfile: null,
    primaryGoal: null,
  }

  db.users.push(user)
  db.transactionsByUser[user.id] = []
  db.goalsByUser[user.id] = []
  db.limitsByUser[user.id] = {}
  db.recurringExpensesByUser[user.id] = []
  db.recurringIncomeByUser[user.id] = []
  await writeDb(db)
  await setAuthToken(`mock-token:${user.id}`)
  await wait()
  return toProfile(user)
}

export async function logout() {
  await clearAuthToken()
  await wait(80)
}

export async function getMe() {
  const db = await readDb()
  const userId = await currentUserId()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Usuario mock nao encontrado')
  await wait(120)
  return toProfile(user)
}

export async function saveOnboarding(data: {
  name: string
  salary: number
  payDay: number
  extraIncome: number
  financialProfile: string
  primaryGoal: string
  fixedExpenses: { name: string; amount: number; dueDay: number }[]
}) {
  return withDb((db, userId) => {
    const user = db.users.find((item) => item.id === userId)
    if (!user) throw new Error('Usuario mock nao encontrado')

    user.name = data.name
    user.onboardingCompleted = true
    user.monthlyIncomeTarget = data.salary + data.extraIncome
    user.payDay = data.payDay
    user.financialProfile = data.financialProfile
    user.primaryGoal = data.primaryGoal

    db.recurringIncomeByUser[userId] = [
      {
        id: id('rinc'),
        description: 'Salario principal',
        amount: data.salary,
        dayOfMonth: data.payDay,
        startMonth: 1,
        endMonth: 12,
      },
      ...(data.extraIncome > 0
        ? [
            {
              id: id('rinc'),
              description: 'Renda extra media',
              amount: data.extraIncome,
              dayOfMonth: Math.min(28, data.payDay + 5),
              startMonth: 1,
              endMonth: 12,
            },
          ]
        : []),
    ]

    db.recurringExpensesByUser[userId] = data.fixedExpenses.map((item) => ({
      id: id('rexp'),
      name: item.name,
      amount: item.amount,
      dueDay: item.dueDay,
    }))

    db.transactionsByUser[userId] = [
      {
        id: id('tx'),
        type: 'income',
        description: 'Salario principal',
        amount: data.salary,
        date: todayIso(),
        category: 'Outros',
        paymentMethod: 'PIX',
      },
      ...(data.extraIncome > 0
        ? [
            {
              id: id('tx'),
              type: 'income' as const,
              description: 'Renda extra media',
              amount: data.extraIncome,
              date: todayIso(),
              category: 'Outros',
              paymentMethod: 'PIX',
            },
          ]
        : []),
      ...data.fixedExpenses.map((item) => ({
        id: id('tx'),
        type: 'expense' as const,
        description: item.name,
        amount: item.amount,
        date: todayIso(),
        category: 'Outros',
        paymentMethod: 'Outros',
      })),
    ]

    return { ok: true }
  })
}

export function fetchTransactions() {
  return withDb((db, userId) => [...(db.transactionsByUser[userId] ?? [])])
}

export function createTransaction(data: {
  type: TransactionType
  amount: number
  date: string
  description: string
  category?: string
  paymentMethod?: string
}) {
  return withDb((db, userId) => {
    const transaction: Transaction = { id: id('tx'), ...data }
    db.transactionsByUser[userId] = [transaction, ...(db.transactionsByUser[userId] ?? [])]
    return transaction
  })
}

export function updateTransaction(idToUpdate: string, data: Partial<Transaction>) {
  return withDb((db, userId) => {
    const rows = db.transactionsByUser[userId] ?? []
    const index = rows.findIndex((item) => item.id === idToUpdate)
    if (index === -1) throw new Error('Transacao mock nao encontrada')
    rows[index] = { ...rows[index], ...data, id: idToUpdate }
    return rows[index]
  })
}

export function deleteTransaction(idToDelete: string) {
  return withDb((db, userId) => {
    db.transactionsByUser[userId] = (db.transactionsByUser[userId] ?? []).filter((item) => item.id !== idToDelete)
    return undefined
  })
}

export function fetchGoals() {
  return withDb((db, userId) => [...(db.goalsByUser[userId] ?? [])])
}

export function createGoal(data: { name: string; targetAmount: number; currentAmount: number }) {
  return withDb((db, userId) => {
    const goal: GoalItem = { id: id('goal'), ...data }
    db.goalsByUser[userId] = [goal, ...(db.goalsByUser[userId] ?? [])]
    return goal
  })
}

export function deleteGoal(idToDelete: string) {
  return withDb((db, userId) => {
    db.goalsByUser[userId] = (db.goalsByUser[userId] ?? []).filter((item) => item.id !== idToDelete)
    return undefined
  })
}

export function fetchBudgetLimits() {
  return withDb((db, userId) => ({ ...(db.limitsByUser[userId] ?? {}) }))
}

export function saveBudgetLimits(limits: Record<string, number>) {
  return withDb((db, userId) => {
    db.limitsByUser[userId] = { ...limits }
    return { ok: true }
  })
}

export function fetchRecurringExpenses() {
  return withDb((db, userId) => [...(db.recurringExpensesByUser[userId] ?? [])])
}

export function createRecurringExpense(data: { name: string; amount: number; dayOfMonth: number }) {
  return withDb((db, userId) => {
    const item: RecurringExpense = {
      id: id('rexp'),
      name: data.name,
      amount: data.amount,
      dueDay: data.dayOfMonth,
    }
    db.recurringExpensesByUser[userId] = [item, ...(db.recurringExpensesByUser[userId] ?? [])]
    return item
  })
}

export function fetchRecurringIncome() {
  return withDb((db, userId) => [...(db.recurringIncomeByUser[userId] ?? [])])
}

export async function askAssistant(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const last = messages.filter((item) => item.role === 'user').at(-1)?.content ?? ''
  const amountMatch = last.match(/(\d+[,.]?\d*)/)
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : 0
  const isIncome = /recebi|ganhei|sal[aá]rio|renda|pix entrou/i.test(last)
  const isExpense = /gastei|paguei|comprei|despesa|uber|mercado|aluguel/i.test(last)

  if (amount > 0 && (isIncome || isExpense)) {
    const transaction = await createTransaction({
      type: isIncome ? 'income' : 'expense',
      amount,
      date: todayIso(),
      description: last.slice(0, 48),
      category: isIncome ? 'Outros' : inferCategory(last),
      paymentMethod: 'Outros',
    })

    return {
      reply: `${isIncome ? 'Receita' : 'Despesa'} registrada no mock: ${transaction.description}.`,
      created: true,
      transaction,
    }
  }

  await wait()
  return {
    reply: 'Estou em modo mock. Posso registrar frases como "gastei 42 no uber" ou "recebi 900 de freelance", e tudo fica salvo no cache local.',
    created: false,
    transaction: null,
  }
}

function inferCategory(text: string) {
  if (/uber|onibus|metro|gasolina|transporte/i.test(text)) return 'Transporte'
  if (/mercado|restaurante|ifood|comida|almoco|jantar/i.test(text)) return 'Alimentacao'
  if (/aluguel|internet|luz|agua|condominio/i.test(text)) return 'Moradia'
  if (/cinema|bar|show|lazer/i.test(text)) return 'Lazer'
  if (/farmacia|medico|saude/i.test(text)) return 'Saude'
  if (/curso|livro|faculdade|educacao/i.test(text)) return 'Educacao'
  return 'Outros'
}

function toProfile(user: MockUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onboardingCompleted: user.onboardingCompleted,
    monthlyIncomeTarget: user.monthlyIncomeTarget,
    payDay: user.payDay,
    financialProfile: user.financialProfile,
    primaryGoal: user.primaryGoal,
  }
}

