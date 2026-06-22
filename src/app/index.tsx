import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import {
  askAssistant,
  clearAuthToken,
  createGoal,
  createRecurringExpense,
  createTransaction,
  deleteGoal,
  deleteTransaction,
  fetchBudgetLimits,
  fetchGoals,
  fetchRecurringExpenses,
  fetchRecurringIncome,
  fetchTransactions,
  getApiBaseUrl,
  getAuthToken,
  getMe,
  login,
  logout,
  register,
  saveBudgetLimits,
  saveOnboarding,
  updateTransaction,
  type GoalItem,
  type RecurringExpense,
  type RecurringIncome,
  type UserProfile,
} from '@/lib/api'
import { CATEGORIES, PAYMENT_METHODS, labelForCategory } from '@/lib/constants'
import {
  currentMonthTransactions,
  financialInsight,
  formatCurrency,
  getBalance,
  getProjectedEndOfMonthBalance,
  getTotalExpenses,
  getTotalIncome,
  monthlyProjections,
  topSpendingCategories,
  type Transaction,
  type TransactionType,
} from '@/lib/finance'

type Section = 'inicio' | 'transacoes' | 'graficos' | 'metas' | 'recorrentes' | 'simulador' | 'assistente'
type AuthMode = 'login' | 'register'

const tabs: { id: Section; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '⌂' },
  { id: 'transacoes', label: 'Transacoes', icon: '+' },
  { id: 'graficos', label: 'Graficos', icon: '▥' },
  { id: 'metas', label: 'Metas', icon: '◎' },
  { id: 'recorrentes', label: 'Fixas', icon: '↻' },
  { id: 'simulador', label: 'Simular', icon: '≈' },
  { id: 'assistente', label: 'IA', icon: '?' },
]

const profiles = [
  { id: 'essencial', label: 'Essencial' },
  { id: 'equilibrado', label: 'Equilibrado' },
  { id: 'crescimento', label: 'Crescimento' },
]

const goals = [
  { id: 'organizar', label: 'Organizar' },
  { id: 'economizar', label: 'Economizar' },
  { id: 'quitar-dividas', label: 'Quitar dividas' },
  { id: 'investir', label: 'Investir' },
]

function moneyToNumber(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date))
}

export default function FlowFinanceApp() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [section, setSection] = useState<Section>('inicio')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goalsList, setGoalsList] = useState<GoalItem[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const loadAll = useCallback(async () => {
    const [tx, goalRows, budgetRows, expenseRows, incomeRows] = await Promise.all([
      fetchTransactions(),
      fetchGoals().catch(() => []),
      fetchBudgetLimits().catch(() => ({})),
      fetchRecurringExpenses().catch(() => []),
      fetchRecurringIncome().catch(() => []),
    ])
    setTransactions(tx)
    setGoalsList(goalRows)
    setLimits(budgetRows)
    setRecurringExpenses(expenseRows)
    setRecurringIncome(incomeRows)
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      if (!(await getAuthToken())) return
      const profile = await getMe()
      setUser(profile)
      if (profile.onboardingCompleted) await loadAll()
    } catch {
      clearAuthToken()
      setUser(null)
    } finally {
      setBooting(false)
    }
  }, [loadAll])

  useEffect(() => {
    const id = setTimeout(() => {
      void bootstrap()
    }, 0)
    return () => clearTimeout(id)
  }, [bootstrap])

  async function refresh() {
    if (!user?.onboardingCompleted) return
    setRefreshing(true)
    try {
      await loadAll()
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleAuthenticated(profile: UserProfile) {
    setUser(profile)
    if (profile.onboardingCompleted) await loadAll()
  }

  async function handleLogout() {
    await logout()
    setUser(null)
    setTransactions([])
    setGoalsList([])
    setSection('inicio')
  }

  if (booting) return <LoadingScreen />

  if (!user) {
    return <AuthScreen mode={authMode} onModeChange={setAuthMode} onAuthenticated={handleAuthenticated} />
  }

  if (!user.onboardingCompleted) {
    return (
      <OnboardingScreen
        user={user}
        onComplete={async () => {
          const profile = await getMe()
          setUser(profile)
          await loadAll()
        }}
      />
    )
  }

  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <Header user={user} onLogout={handleLogout} />
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#a78bfa" />}>
          {section === 'inicio' && <HomeSection transactions={transactions} goals={goalsList} onGoTo={setSection} />}
          {section === 'transacoes' && (
            <TransactionsSection
              transactions={transactions}
              onAdd={() => {
                setEditingTransaction(null)
                setTransactionModalOpen(true)
              }}
              onEdit={(transaction) => {
                setEditingTransaction(transaction)
                setTransactionModalOpen(true)
              }}
              onDelete={async (id) => {
                await deleteTransaction(id)
                await refresh()
              }}
            />
          )}
          {section === 'graficos' && <ChartsSection transactions={transactions} />}
          {section === 'metas' && (
            <GoalsSection
              transactions={transactions}
              goals={goalsList}
              limits={limits}
              onRefresh={refresh}
              onLimitsChange={setLimits}
            />
          )}
          {section === 'recorrentes' && (
            <RecurringSection
              income={recurringIncome}
              expenses={recurringExpenses}
              onRefresh={refresh}
            />
          )}
          {section === 'simulador' && <SimulatorSection transactions={transactions} />}
          {section === 'assistente' && <AssistantSection onTransactionCreated={refresh} />}
        </ScrollView>
      </SafeAreaView>
      <BottomTabs section={section} onChange={setSection} />
      <Pressable
        style={styles.fab}
        onPress={() => {
          setSection('transacoes')
          setEditingTransaction(null)
          setTransactionModalOpen(true)
        }}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
      <TransactionModal
        open={transactionModalOpen}
        editing={editingTransaction}
        onClose={() => {
          setTransactionModalOpen(false)
          setEditingTransaction(null)
        }}
        onSaved={refresh}
      />
    </View>
  )
}

function LoadingScreen() {
  return (
    <View style={styles.centerScreen}>
      <ActivityIndicator color="#a78bfa" size="large" />
      <Text style={styles.muted}>Carregando FlowFinance...</Text>
    </View>
  )
}

function AuthScreen({
  mode,
  onModeChange,
  onAuthenticated,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onAuthenticated: (user: UserProfile) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    try {
      const profile = mode === 'login' ? await login(email, password) : await register(name, email, password)
      onAuthenticated(profile)
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar style="light" />
      <View style={styles.brandBlock}>
        <Text style={styles.brandMark}>FlowFinance</Text>
        <Text style={styles.brandTitle}>Seu financeiro no bolso</Text>
        <Text style={styles.brandSubtitle}>Conectado ao mesmo backend do seu painel web.</Text>
      </View>
      <View style={styles.panel}>
        <Segmented
          value={mode}
          options={[
            { id: 'login', label: 'Entrar' },
            { id: 'register', label: 'Cadastrar' },
          ]}
          onChange={(value) => onModeChange(value as AuthMode)}
        />
        {mode === 'register' && <Field label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" />
        <Field label="Senha" value={password} onChangeText={setPassword} placeholder="Minimo 6 caracteres" secureTextEntry />
        <PrimaryButton label={loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={submit} disabled={loading} />
        <Text style={styles.helper}>Mock ativo: demo@flowfinance.app / 123456</Text>
        <Text style={styles.helper}>Cache: {getApiBaseUrl()}</Text>
      </View>
    </SafeAreaView>
  )
}

function OnboardingScreen({ user, onComplete }: { user: UserProfile; onComplete: () => Promise<void> }) {
  const [name, setName] = useState(user.name ?? '')
  const [salary, setSalary] = useState('')
  const [extraIncome, setExtraIncome] = useState('0')
  const [payDay, setPayDay] = useState('5')
  const [profile, setProfile] = useState('equilibrado')
  const [primaryGoal, setPrimaryGoal] = useState('organizar')
  const [fixedName, setFixedName] = useState('')
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedDay, setFixedDay] = useState('10')
  const [fixedExpenses, setFixedExpenses] = useState<{ name: string; amount: number; dueDay: number }[]>([])
  const [saving, setSaving] = useState(false)

  function addFixedExpense() {
    const amount = moneyToNumber(fixedAmount)
    const dueDay = Math.max(1, Math.min(31, Number(fixedDay) || 1))
    if (!fixedName.trim() || amount <= 0) return
    setFixedExpenses((items) => [...items, { name: fixedName.trim(), amount, dueDay }])
    setFixedName('')
    setFixedAmount('')
  }

  async function submit() {
    setSaving(true)
    try {
      await saveOnboarding({
        name,
        salary: moneyToNumber(salary),
        payDay: Math.max(1, Math.min(31, Number(payDay) || 1)),
        extraIncome: moneyToNumber(extraIncome),
        financialProfile: profile,
        primaryGoal,
        fixedExpenses,
      })
      await onComplete()
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel salvar seu inicio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.app}>
      <ScrollView contentContainerStyle={styles.contentInner}>
        <Text style={styles.title}>Vamos configurar sua conta</Text>
        <Text style={styles.muted}>Esses dados criam receitas e despesas fixas, igual no onboarding web.</Text>
        <View style={styles.panel}>
          <Field label="Nome" value={name} onChangeText={setName} />
          <Field label="Salario principal" value={salary} onChangeText={setSalary} keyboardType="numeric" placeholder="5000" />
          <Field label="Dia do pagamento" value={payDay} onChangeText={setPayDay} keyboardType="numeric" />
          <Field label="Renda extra media" value={extraIncome} onChangeText={setExtraIncome} keyboardType="numeric" />
          <Text style={styles.label}>Perfil financeiro</Text>
          <ChoiceRow value={profile} options={profiles} onChange={setProfile} />
          <Text style={styles.label}>Objetivo principal</Text>
          <ChoiceRow value={primaryGoal} options={goals} onChange={setPrimaryGoal} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.cardTitle}>Despesas fixas</Text>
          {fixedExpenses.map((item, index) => (
            <Text key={`${item.name}-${index}`} style={styles.listLine}>
              {item.name} · {formatCurrency(item.amount)} · dia {item.dueDay}
            </Text>
          ))}
          <Field label="Nome da conta" value={fixedName} onChangeText={setFixedName} placeholder="Aluguel, internet..." />
          <Field label="Valor" value={fixedAmount} onChangeText={setFixedAmount} keyboardType="numeric" />
          <Field label="Vencimento" value={fixedDay} onChangeText={setFixedDay} keyboardType="numeric" />
          <SecondaryButton label="Adicionar despesa fixa" onPress={addFixedExpense} />
        </View>
        <PrimaryButton label={saving ? 'Salvando...' : 'Finalizar'} onPress={submit} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Header({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerEyebrow}>FlowFinance</Text>
        <Text style={styles.headerTitle}>Ola, {user.name ?? user.email.split('@')[0]}</Text>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </View>
  )
}

function HomeSection({ transactions, goals, onGoTo }: { transactions: Transaction[]; goals: GoalItem[]; onGoTo: (section: Section) => void }) {
  const monthTransactions = useMemo(() => currentMonthTransactions(transactions), [transactions])
  const monthlyIncome = getTotalIncome(monthTransactions)
  const monthlyExpenses = getTotalExpenses(monthTransactions)
  const balance = getBalance(transactions)
  const projected = getProjectedEndOfMonthBalance(transactions, balance)
  const recent = [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6)

  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <MetricCard title="Saldo atual" value={formatCurrency(balance)} tone={balance >= 0 ? 'good' : 'bad'} />
        <MetricCard title="Receitas do mes" value={formatCurrency(monthlyIncome)} tone="good" />
        <MetricCard title="Gastos do mes" value={formatCurrency(monthlyExpenses)} tone="bad" />
        <MetricCard title="Projecao" value={formatCurrency(projected)} tone={projected >= 0 ? 'good' : 'bad'} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Inteligencia financeira</Text>
        <Text style={styles.bodyText}>{financialInsight(transactions)}</Text>
      </View>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Ultimas transacoes</Text>
          <Pressable onPress={() => onGoTo('transacoes')}>
            <Text style={styles.linkText}>Ver todas</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? <EmptyText text="Nenhuma transacao registrada." /> : recent.map((item) => <TransactionRow key={item.id} item={item} />)}
      </View>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Metas</Text>
          <Pressable onPress={() => onGoTo('metas')}>
            <Text style={styles.linkText}>Gerenciar</Text>
          </Pressable>
        </View>
        {goals.length === 0 ? <EmptyText text="Crie metas para acompanhar seu progresso." /> : goals.slice(0, 3).map((goal) => <GoalProgress key={goal.id} goal={goal} balance={balance} />)}
      </View>
    </View>
  )
}

function TransactionsSection({
  transactions,
  onAdd,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[]
  onAdd: () => void
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [filter, setFilter] = useState<'all' | TransactionType>('all')
  const filtered = transactions
    .filter((item) => filter === 'all' || item.type === filter)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))

  return (
    <View style={styles.stack}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Transacoes</Text>
        <PrimaryButton label="Nova" onPress={onAdd} compact />
      </View>
      <Segmented
        value={filter}
        options={[
          { id: 'all', label: 'Todas' },
          { id: 'income', label: 'Receitas' },
          { id: 'expense', label: 'Gastos' },
        ]}
        onChange={(value) => setFilter(value as 'all' | TransactionType)}
      />
      <View style={styles.panel}>
        {filtered.length === 0 ? (
          <EmptyText text="Nenhuma transacao nesse filtro." />
        ) : (
          filtered.map((item) => (
            <Pressable key={item.id} onPress={() => onEdit(item)} onLongPress={() => void onDelete(item.id)}>
              <TransactionRow item={item} />
            </Pressable>
          ))
        )}
      </View>
    </View>
  )
}

function ChartsSection({ transactions }: { transactions: Transaction[] }) {
  const projections = monthlyProjections(transactions)
  const categories = topSpendingCategories(transactions)
  const maxMonth = Math.max(1, ...projections.map((item) => Math.max(item.income, item.expenses)))
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount))

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Graficos e relatorios</Text>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Receita x gastos no ano</Text>
        {projections.map((item) => (
          <View key={item.monthName} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{item.monthName}</Text>
            <View style={styles.chartBars}>
              <View style={[styles.bar, styles.incomeBar, { width: `${Math.max(3, (item.income / maxMonth) * 100)}%` }]} />
              <View style={[styles.bar, styles.expenseBar, { width: `${Math.max(3, (item.expenses / maxMonth) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Gastos por categoria</Text>
        {categories.length === 0 ? <EmptyText text="Sem gastos categorizados." /> : categories.map((item) => (
          <View key={item.category} style={styles.categoryLine}>
            <Text style={styles.bodyText}>{labelForCategory(item.category)}</Text>
            <Text style={styles.badText}>{formatCurrency(item.amount)}</Text>
            <View style={styles.categoryTrack}>
              <View style={[styles.categoryFill, { width: `${(item.amount / maxCategory) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function GoalsSection({
  transactions,
  goals,
  limits,
  onRefresh,
  onLimitsChange,
}: {
  transactions: Transaction[]
  goals: GoalItem[]
  limits: Record<string, number>
  onRefresh: () => Promise<void>
  onLimitsChange: (limits: Record<string, number>) => void
}) {
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [limitCategory, setLimitCategory] = useState(CATEGORIES[0])
  const [limitValue, setLimitValue] = useState('')
  const balance = getBalance(transactions)
  const currentMonth = currentMonthTransactions(transactions)

  async function addGoal() {
    const targetAmount = moneyToNumber(goalTarget)
    if (targetAmount <= 0) return
    await createGoal({ name: goalName.trim() || 'Meta', targetAmount, currentAmount: 0 })
    setGoalName('')
    setGoalTarget('')
    await onRefresh()
  }

  async function setLimit() {
    const next = { ...limits }
    const amount = moneyToNumber(limitValue)
    if (amount <= 0) delete next[limitCategory]
    else next[limitCategory] = amount
    onLimitsChange(next)
    await saveBudgetLimits(next)
    setLimitValue('')
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Metas e orcamento</Text>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Metas financeiras</Text>
        {goals.map((goal) => (
          <Pressable key={goal.id} onLongPress={async () => { await deleteGoal(goal.id); await onRefresh() }}>
            <GoalProgress goal={goal} balance={balance} />
          </Pressable>
        ))}
        {goals.length === 0 && <EmptyText text="Nenhuma meta criada." />}
        <Field label="Nome da meta" value={goalName} onChangeText={setGoalName} placeholder="Viagem, reserva..." />
        <Field label="Valor alvo" value={goalTarget} onChangeText={setGoalTarget} keyboardType="numeric" />
        <SecondaryButton label="Criar meta" onPress={() => void addGoal()} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Orcamento mensal</Text>
        <ChoiceRow value={limitCategory} options={CATEGORIES.map((item) => ({ id: item, label: labelForCategory(item) }))} onChange={setLimitCategory} />
        <Field label="Limite da categoria" value={limitValue} onChangeText={setLimitValue} keyboardType="numeric" />
        <SecondaryButton label="Salvar limite" onPress={() => void setLimit()} />
        {CATEGORIES.map((category) => {
          const spent = getTotalExpenses(currentMonth.filter((item) => item.category === category))
          const limit = limits[category] ?? 0
          if (!limit && !spent) return null
          const over = limit > 0 && spent > limit
          return (
            <View key={category} style={styles.budgetLine}>
              <Text style={styles.bodyText}>{labelForCategory(category)}</Text>
              <Text style={over ? styles.badText : styles.muted}>{formatCurrency(spent)} / {limit ? formatCurrency(limit) : 'sem limite'}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function RecurringSection({ income, expenses, onRefresh }: { income: RecurringIncome[]; expenses: RecurringExpense[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('10')

  async function addExpense() {
    const parsedAmount = moneyToNumber(amount)
    if (!name.trim() || parsedAmount <= 0) return
    await createRecurringExpense({ name: name.trim(), amount: parsedAmount, dayOfMonth: Number(day) || 1 })
    setName('')
    setAmount('')
    await onRefresh()
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Receitas e despesas fixas</Text>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Receitas recorrentes</Text>
        {income.length === 0 ? <EmptyText text="Nenhuma receita recorrente." /> : income.map((item) => (
          <Text key={item.id} style={styles.listLine}>{item.description} · {formatCurrency(item.amount)} · dia {item.dayOfMonth}</Text>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Despesas recorrentes</Text>
        {expenses.length === 0 ? <EmptyText text="Nenhuma despesa fixa." /> : expenses.map((item) => (
          <Text key={item.id} style={styles.listLine}>{item.name} · {formatCurrency(item.amount)} · dia {item.dueDay}</Text>
        ))}
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Internet, aluguel..." />
        <Field label="Valor" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Field label="Vencimento" value={day} onChangeText={setDay} keyboardType="numeric" />
        <SecondaryButton label="Adicionar despesa fixa" onPress={() => void addExpense()} />
      </View>
    </View>
  )
}

function SimulatorSection({ transactions }: { transactions: Transaction[] }) {
  const [months, setMonths] = useState('12')
  const [incomeDelta, setIncomeDelta] = useState('0')
  const [expenseDelta, setExpenseDelta] = useState('0')
  const [oneTimeExpense, setOneTimeExpense] = useState('0')
  const monthTransactions = currentMonthTransactions(transactions)
  const monthlyIncome = getTotalIncome(monthTransactions)
  const monthlyExpenses = getTotalExpenses(monthTransactions)
  const balance = getBalance(transactions)
  const count = Math.max(1, Number(months) || 1)
  const projected = Array.from({ length: Math.min(24, count) }, (_, index) => {
    const income = monthlyIncome + moneyToNumber(incomeDelta)
    const expenses = monthlyExpenses + moneyToNumber(expenseDelta) + (index === 0 ? moneyToNumber(oneTimeExpense) : 0)
    return { month: index + 1, balance: balance + (income - expenses) * (index + 1) }
  })
  const finalBalance = projected.at(-1)?.balance ?? balance

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Simulador de cenarios</Text>
      <View style={styles.summaryGrid}>
        <MetricCard title="Receita base" value={formatCurrency(monthlyIncome)} tone="good" />
        <MetricCard title="Gasto base" value={formatCurrency(monthlyExpenses)} tone="bad" />
        <MetricCard title="Saldo final" value={formatCurrency(finalBalance)} tone={finalBalance >= 0 ? 'good' : 'bad'} />
      </View>
      <View style={styles.panel}>
        <Field label="Periodo em meses" value={months} onChangeText={setMonths} keyboardType="numeric" />
        <Field label="Aumento mensal de receita" value={incomeDelta} onChangeText={setIncomeDelta} keyboardType="numeric" />
        <Field label="Aumento mensal de gasto" value={expenseDelta} onChangeText={setExpenseDelta} keyboardType="numeric" />
        <Field label="Gasto unico no primeiro mes" value={oneTimeExpense} onChangeText={setOneTimeExpense} keyboardType="numeric" />
      </View>
      <View style={styles.panel}>
        <Text style={styles.cardTitle}>Projecao</Text>
        {projected.map((item) => (
          <View key={item.month} style={styles.budgetLine}>
            <Text style={styles.bodyText}>Mes {item.month}</Text>
            <Text style={item.balance >= 0 ? styles.goodText : styles.badText}>{formatCurrency(item.balance)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function AssistantSection({ onTransactionCreated }: { onTransactionCreated: () => Promise<void> }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Oi! Me diga um gasto, receita ou pergunta sobre suas financas.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim()) return
    const next = [...messages, { role: 'user' as const, content: input.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const response = await askAssistant(next)
      setMessages([...next, { role: 'assistant', content: response.reply }])
      if (response.created) await onTransactionCreated()
    } catch (error) {
      setMessages([...next, { role: 'assistant', content: error instanceof Error ? error.message : 'Nao consegui responder agora.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.title}>Assistente financeiro</Text>
      <View style={styles.panel}>
        {messages.map((message, index) => (
          <View key={`${message.role}-${index}`} style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text style={styles.bodyText}>{message.content}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator color="#a78bfa" />}
        <Field label="Mensagem" value={input} onChangeText={setInput} placeholder="Ex: gastei 42 no uber hoje" />
        <PrimaryButton label="Enviar" onPress={() => void send()} disabled={loading} />
      </View>
    </View>
  )
}

function TransactionModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: Transaction | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [type, setType] = useState<TransactionType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [category, setCategory] = useState(CATEGORIES[0])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[1])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      setType(editing?.type ?? 'expense')
      setDescription(editing?.description ?? '')
      setAmount(editing ? String(editing.amount) : '')
      setDate(editing?.date ?? todayIso())
      setCategory(editing?.category ?? CATEGORIES[0])
      setPaymentMethod(editing?.paymentMethod ?? PAYMENT_METHODS[1])
    }, 0)
    return () => clearTimeout(id)
  }, [editing, open])

  async function save() {
    const parsedAmount = moneyToNumber(amount)
    if (!description.trim() || parsedAmount <= 0) {
      Alert.alert('Dados incompletos', 'Informe descricao e valor.')
      return
    }
    setSaving(true)
    try {
      const payload = { type, description: description.trim(), amount: parsedAmount, date, category, paymentMethod }
      if (editing) await updateTransaction(editing.id, payload)
      else await createTransaction(payload)
      await onSaved()
      onClose()
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{editing ? 'Editar transacao' : 'Nova transacao'}</Text>
          <Segmented
            value={type}
            options={[
              { id: 'expense', label: 'Gasto' },
              { id: 'income', label: 'Receita' },
            ]}
            onChange={(value) => setType(value as TransactionType)}
          />
          <Field label="Descricao" value={description} onChangeText={setDescription} placeholder="Mercado, salario..." />
          <Field label="Valor" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <Field label="Data" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>Categoria</Text>
          <ChoiceRow value={category} options={CATEGORIES.map((item) => ({ id: item, label: labelForCategory(item) }))} onChange={setCategory} />
          <Text style={styles.label}>Pagamento</Text>
          <ChoiceRow value={paymentMethod} options={PAYMENT_METHODS.map((item) => ({ id: item, label: item }))} onChange={setPaymentMethod} />
          <View style={styles.modalActions}>
            <SecondaryButton label="Cancelar" onPress={onClose} />
            <PrimaryButton label={saving ? 'Salvando...' : 'Salvar'} onPress={() => void save()} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function BottomTabs({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  return (
    <View style={styles.bottomTabs}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomTabsInner}>
        {tabs.map((tab) => {
          const active = tab.id === section
          return (
            <Pressable key={tab.id} style={[styles.tabButton, active && styles.tabButtonActive]} onPress={() => onChange(tab.id)}>
              <Text style={[styles.tabIcon, active && styles.tabTextActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function TransactionRow({ item }: { item: Transaction }) {
  const isIncome = item.type === 'income'
  return (
    <View style={styles.transactionRow}>
      <View style={[styles.transactionDot, isIncome ? styles.dotGood : styles.dotBad]} />
      <View style={styles.transactionInfo}>
        <Text style={styles.bodyText} numberOfLines={1}>{item.description || 'Sem descricao'}</Text>
        <Text style={styles.muted}>{formatDate(item.date)} · {labelForCategory(item.category)}</Text>
      </View>
      <Text style={isIncome ? styles.goodText : styles.badText}>{isIncome ? '+' : '-'}{formatCurrency(item.amount)}</Text>
    </View>
  )
}

function GoalProgress({ goal, balance }: { goal: GoalItem; balance: number }) {
  const current = Math.max(0, Math.min(balance, goal.targetAmount))
  const progress = goal.targetAmount > 0 ? Math.min(100, (current / goal.targetAmount) * 100) : 0
  return (
    <View style={styles.goalBlock}>
      <View style={styles.rowBetween}>
        <Text style={styles.bodyText}>{goal.name}</Text>
        <Text style={styles.muted}>{progress.toFixed(0)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.muted}>{formatCurrency(current)} / {formatCurrency(goal.targetAmount)}</Text>
    </View>
  )
}

function MetricCard({ title, value, tone }: { title: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={tone === 'bad' ? styles.metricBad : tone === 'good' ? styles.metricGood : styles.metricValue}>{value}</Text>
    </View>
  )
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#6b7280"
        style={[styles.input, inputProps.style]}
        autoCapitalize={inputProps.keyboardType === 'email-address' ? 'none' : undefined}
      />
    </View>
  )
}

function Segmented({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable key={option.id} style={[styles.segmentButton, value === option.id && styles.segmentActive]} onPress={() => onChange(option.id)}>
          <Text style={[styles.segmentText, value === option.id && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function ChoiceRow({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
      {options.map((option) => {
        const active = value === option.id
        return (
          <Pressable key={option.id} style={[styles.choiceChip, active && styles.choiceChipActive]} onPress={() => onChange(option.id)}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function PrimaryButton({ label, onPress, disabled, compact }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Pressable style={[styles.primaryButton, compact && styles.compactButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

function EmptyText({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#070711' },
  safeArea: { flex: 1 },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#070711' },
  authScreen: { flex: 1, justifyContent: 'center', gap: 22, padding: 18, backgroundColor: '#070711' },
  brandBlock: { gap: 8 },
  brandMark: { color: '#a78bfa', fontSize: 15, fontWeight: '800', textTransform: 'uppercase' },
  brandTitle: { color: '#f8fafc', fontSize: 34, lineHeight: 38, fontWeight: '900' },
  brandSubtitle: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerEyebrow: { color: '#a78bfa', fontSize: 12, fontWeight: '800' },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  logoutButton: { borderWidth: 1, borderColor: '#2f3142', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#cbd5e1', fontWeight: '700' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 118, gap: 14 },
  stack: { gap: 14 },
  panel: { gap: 12, padding: 14, borderRadius: 8, backgroundColor: 'rgba(15, 15, 26, 0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  bodyText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  helper: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '800' },
  field: { gap: 6 },
  input: { color: '#f8fafc', minHeight: 46, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#111322', borderWidth: 1, borderColor: '#25283a' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  linkText: { color: '#a78bfa', fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 92, justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: '#111322', borderWidth: 1, borderColor: '#25283a' },
  metricTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  metricValue: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
  metricGood: { color: '#34d399', fontSize: 18, fontWeight: '900' },
  metricBad: { color: '#fb7185', fontSize: 18, fontWeight: '900' },
  goodText: { color: '#34d399', fontSize: 13, fontWeight: '900' },
  badText: { color: '#fb7185', fontSize: 13, fontWeight: '900' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  transactionDot: { width: 10, height: 10, borderRadius: 5 },
  dotGood: { backgroundColor: '#34d399' },
  dotBad: { backgroundColor: '#fb7185' },
  transactionInfo: { flex: 1, minWidth: 0 },
  segmented: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 8, backgroundColor: '#0b0c16', borderWidth: 1, borderColor: '#25283a' },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: '#7c3aed' },
  segmentText: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  choiceRow: { gap: 8, paddingVertical: 2 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#25283a', backgroundColor: '#111322' },
  choiceChipActive: { borderColor: '#8b5cf6', backgroundColor: 'rgba(124,58,237,0.28)' },
  choiceText: { color: '#cbd5e1', fontWeight: '800', fontSize: 12 },
  choiceTextActive: { color: '#fff' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#7c3aed' },
  compactButton: { minHeight: 38 },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#35384d', backgroundColor: '#111322' },
  secondaryButtonText: { color: '#e5e7eb', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  emptyText: { color: '#94a3b8', textAlign: 'center', paddingVertical: 12 },
  listLine: { color: '#e5e7eb', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  goalBlock: { gap: 8, paddingVertical: 8 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: '#25283a', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 8, backgroundColor: '#8b5cf6' },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartLabel: { width: 32, color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  chartBars: { flex: 1, gap: 4 },
  bar: { height: 8, borderRadius: 8 },
  incomeBar: { backgroundColor: '#34d399' },
  expenseBar: { backgroundColor: '#fb7185' },
  categoryLine: { gap: 6 },
  categoryTrack: { height: 8, borderRadius: 8, backgroundColor: '#25283a', overflow: 'hidden' },
  categoryFill: { height: 8, borderRadius: 8, backgroundColor: '#a78bfa' },
  budgetLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  chatBubble: { padding: 12, borderRadius: 8, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(124,58,237,0.35)' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#111322' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  modalCard: { maxHeight: '92%', gap: 12, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#090a14', borderWidth: 1, borderColor: '#25283a' },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  bottomTabs: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 12, paddingTop: 8, backgroundColor: 'rgba(7,7,17,0.96)', borderTopWidth: 1, borderTopColor: '#25283a' },
  bottomTabsInner: { gap: 8, paddingHorizontal: 12 },
  tabButton: { width: 76, alignItems: 'center', gap: 3, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  tabButtonActive: { backgroundColor: '#15172a', borderColor: '#39324f' },
  tabIcon: { color: '#94a3b8', fontSize: 16, fontWeight: '900' },
  tabLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#c4b5fd' },
  fab: { position: 'absolute', right: 18, bottom: 86, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed' },
  fabText: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '700' },
})
