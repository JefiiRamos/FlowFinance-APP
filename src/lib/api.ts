import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Transaction, TransactionType } from './finance'

const AUTH_KEY = 'flowfinance:session:token'
const DEFAULT_API_URL = 'https://flow-finance-five.vercel.app'

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


export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError' }
}

export function getApiBaseUrl() {
  return (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
}
export const setAuthToken = (token: string) => AsyncStorage.setItem(AUTH_KEY, token)
export const getAuthToken = () => AsyncStorage.getItem(AUTH_KEY)
export const clearAuthToken = () => AsyncStorage.removeItem(AUTH_KEY)

async function request<T>(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<T> {
  const token = authenticated ? await getAuthToken() : null
  if (authenticated && !token) throw new ApiError('Entre na sua conta para continuar.', 401)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(getApiBaseUrl() + '/api' + path, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
    if (response.status === 204) return undefined as T
    const raw = await response.text()
    let data: any
    try { data = raw ? JSON.parse(raw) : undefined } catch { throw new ApiError('O servidor retornou uma resposta inválida. Tente novamente.', response.status) }
    if (!response.ok) {
      if (authenticated && response.status === 401) await clearAuthToken()
      throw new ApiError(data?.error || 'Não foi possível concluir a operação.', response.status)
    }
    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(controller.signal.aborted ? 'A conexão demorou demais. Tente novamente.' : 'Não foi possível conectar ao FlowFinance. Verifique sua conexão.', 0)
  } finally { clearTimeout(timeout) }
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: UserProfile }>('/auth/login', 'POST', { email: email.trim().toLowerCase(), password }, false)
  if (!result.token || !result.user) throw new ApiError('Resposta de autenticação inválida.', 502)
  await setAuthToken(result.token)
  return result.user
}
export async function register(name: string, email: string, password: string) {
  await request('/auth/register', 'POST', { name: name.trim(), email: email.trim().toLowerCase(), password }, false)
  return login(email, password)
}
export async function logout() {
  try { await request('/auth/logout', 'POST') } finally { await clearAuthToken() }
}
export const getMe = () => request<UserProfile>('/auth/me')
export function saveOnboarding(data: {
  name: string; salary: number; payDay: number; extraIncome: number; financialProfile: string; primaryGoal: string
  fixedExpenses: { name: string; amount: number; dueDay: number }[]
}) { return request<{ ok: boolean }>('/onboarding', 'POST', data) }

function normalizeTransaction(row: Transaction): Transaction {
  return { ...row, description: row.description ?? '', category: row.category ?? 'Outros', paymentMethod: row.paymentMethod ?? 'Outros' }
}
export async function fetchTransactions() { return (await request<Transaction[]>('/transactions')).map(normalizeTransaction) }
export const createTransaction = (data: { type: TransactionType; amount: number; date: string; description: string; category?: string; paymentMethod?: string }) => request<Transaction>('/transactions', 'POST', data)
export const updateTransaction = (id: string, data: Partial<Transaction>) => request<Transaction>('/transactions/' + encodeURIComponent(id), 'PUT', data)
export const deleteTransaction = (id: string) => request<void>('/transactions/' + encodeURIComponent(id), 'DELETE')
export const fetchGoals = () => request<GoalItem[]>('/goals')
export const createGoal = (data: { name: string; targetAmount: number; currentAmount: number }) => request<GoalItem>('/goals', 'POST', data)
export const deleteGoal = (id: string) => request<void>('/goals/' + encodeURIComponent(id), 'DELETE')
export const fetchBudgetLimits = () => request<Record<string, number>>('/budget-limits')
export const saveBudgetLimits = (limits: Record<string, number>) => request<{ ok: boolean }>('/budget-limits', 'PUT', { limits })
export const fetchRecurringExpenses = () => request<RecurringExpense[]>('/recurring-expenses')
export const createRecurringExpense = (data: { name: string; amount: number; dayOfMonth: number }) => request<RecurringExpense>('/recurring-expenses', 'POST', data)
export const fetchRecurringIncome = () => request<RecurringIncome[]>('/recurring')
export const askAssistant = (messages: { role: 'user' | 'assistant'; content: string }[]) => request<{ reply: string; created: boolean; transaction: Transaction | null }>('/ai/expense-assistant', 'POST', { messages: messages.slice(-48) })
