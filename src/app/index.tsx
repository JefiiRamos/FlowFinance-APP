import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { FinanceBackground, FinanceIcon, palette, type IconName } from '@/components/finance-visuals'
import { WelcomeScreen } from '@/components/welcome-screen'
import { AuthFlowTransition } from '@/components/auth-flow-transition'
import { AccountSurface } from '@/components/account-surface'
import { AccountEntry } from '@/components/account-entry'
import { AuthBackground, authVisuals } from '@/components/auth-visuals'
import { useAuthModeMotion } from '@/components/use-auth-mode-motion'
import { WelcomeKeyboardLayout } from '@/components/keyboard-layout'
import { KeyboardTabFooter } from '@/components/keyboard-tab-footer'
import { SharedEmailAnchor } from '@/components/auth-flow-anchors'

import {
  ApiError,
  askAssistant,
  clearAuthToken,
  checkEmail,
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
  parseMoney as moneyToNumber,
  topSpendingCategories,
  type Transaction,
  type TransactionType,
} from '@/lib/finance'

type Section = 'inicio' | 'transacoes' | 'graficos' | 'metas' | 'recorrentes' | 'simulador' | 'assistente' | 'mais'
type AuthMode = 'login' | 'register'

const tabs: { id: Section; label: string; icon: IconName }[] = [
  { id: 'assistente', label: 'Conversa', icon: 'sparkles' },
  { id: 'transacoes', label: 'Extrato', icon: 'wallet' },
  { id: 'metas', label: 'Planejar', icon: 'target' },
  { id: 'mais', label: 'Perfil', icon: 'user' },
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

function todayIso() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date))
}

export default function FlowFinanceApp() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [showAccountIntro, setShowAccountIntro] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authVisible, setAuthVisible] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [section, setSection] = useState<Section>('assistente')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goalsList, setGoalsList] = useState<GoalItem[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([])
  const [recurringWarning, setRecurringWarning] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const loadAll = useCallback(async () => {
    const [tx, goalRows, budgetRows, expenseRows, incomeRows] = await Promise.all([
      fetchTransactions(),
      fetchGoals(),
      fetchBudgetLimits(),
      fetchRecurringExpenses(),
      fetchRecurringIncome().catch((error: unknown) => {
        // Older deployments expose POST /recurring but not its new GET handler.
        if (error instanceof ApiError && error.status === 405) return null
        throw error
      }),
    ])
    setTransactions(tx)
    setGoalsList(goalRows)
    setLimits(budgetRows)
    setRecurringExpenses(expenseRows)
    setRecurringIncome(incomeRows ?? [])
    setRecurringWarning(incomeRows === null ? 'Receitas recorrentes temporariamente indisponíveis. Seus outros dados foram carregados normalmente.' : null)
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      if (!(await getAuthToken())) return
      const profile = await getMe()
      if (profile.onboardingCompleted) await loadAll()
      setShowAccountIntro(true)
      setUser(profile)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearAuthToken()
      else Alert.alert(error instanceof ApiError && error.status > 0 ? 'Erro na API' : 'Conexão', error instanceof Error ? error.message : 'Não foi possível carregar seus dados.')
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

  const refreshTransactions = useCallback(async () => {
    setTransactions(await fetchTransactions())
  }, [])

  async function handleAuthenticated(profile: UserProfile) {
    if (profile.onboardingCompleted) await loadAll()
    Keyboard.dismiss()
    setShowAccountIntro(true)
    setUser(profile)
  }

  async function handleLogout() {
    try { await logout() } catch { /* A sessão local já foi removida. */ }
    setUser(null)
    setShowAccountIntro(false)
    setAuthVisible(false)
    setAuthEmail('')
    setTransactions([])
    setGoalsList([])
    setLimits({})
    setRecurringExpenses([])
    setRecurringIncome([])
    setRecurringWarning(null)
    setTransactionModalOpen(false)
    setEditingTransaction(null)
    setSection('assistente')
  }

  if (booting) return <LoadingScreen />

  const accountContent = !user ? null : !user.onboardingCompleted ? (
      <OnboardingScreen
        user={user}
        onComplete={async () => {
          const profile = await getMe()
          await loadAll()
          Keyboard.dismiss()
          setUser(profile)
        }}
      />
  ) : (

    <View style={styles.app}>
      <View style={styles.safeArea}>
        {['inicio', 'graficos', 'recorrentes', 'simulador'].includes(section) && <Pressable accessibilityRole="button" accessibilityLabel="Voltar para o perfil" onPress={() => setSection('mais')} style={[styles.inline, { minHeight: 44, paddingHorizontal: 24 }]}><FinanceIcon name="back" /><Text style={styles.linkText}>Voltar</Text></Pressable>}
        {recurringWarning && <View accessibilityRole="alert" style={[styles.panel, { marginHorizontal: 22, padding: 12 }]}><Text style={styles.muted}>{recurringWarning}</Text></View>}
        <View style={{ flex: 1, display: section === 'assistente' ? 'flex' : 'none' }}>
          <AssistantSection transactions={transactions} onGoTo={setSection} onTransactionCreated={refreshTransactions} onEdit={(transaction) => { setEditingTransaction(transaction); setTransactionModalOpen(true) }} />
        </View>
        {section !== 'assistente' && <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.contentInner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}>
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
          {section === 'mais' && <MoreSection user={user} onGoTo={setSection} onLogout={handleLogout} />}
        </ScrollView>}
      </View>
      <KeyboardTabFooter><BottomTabs section={section} onChange={setSection} /></KeyboardTabFooter>
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

  if (user) {
    return <AccountEntry animate={showAccountIntro} userName={user.name?.trim() || user.email.split('@')[0]}><AccountSurface>{accountContent}</AccountSurface></AccountEntry>
  }

  return (
      <AuthFlowTransition
        active={authVisible}
        email={authEmail}
        welcome={<WelcomeScreen initialEmail={authEmail} verifiedMode={authVisible ? authMode : undefined} onContinue={async (email) => {
          const exists = await checkEmail(email)
          setAuthEmail(email)
          setAuthMode(exists ? 'login' : 'register')
          setAuthVisible(true)
        }} />}
        auth={authEmail ? <AuthScreen key={authEmail} initialEmail={authEmail} mode={authMode} onAuthenticated={handleAuthenticated} onBack={() => { Keyboard.dismiss(); setAuthVisible(false) }} /> : null}
      />
  )
}

function LoadingScreen() {
  return (
    <View style={styles.centerScreen}>
      <FinanceBackground />
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={styles.muted}>Carregando FlowFinance...</Text>
    </View>
  )
}

function AuthScreen({
  initialEmail,
  mode,
  onAuthenticated,
  onBack,
}: {
  initialEmail: string
  mode: AuthMode
  onAuthenticated: (user: UserProfile) => Promise<void>
  onBack: () => void
}) {
  const modeProgress = useAuthModeMotion(mode)
  const [name, setName] = useState('')
  const email = initialEmail
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible())
  const { height } = useWindowDimensions()
  const layoutHeight = Platform.OS === 'android' ? Dimensions.get('screen').height : height
  const compact = layoutHeight < 680

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    })
    return () => { show.remove(); hide.remove() }
  }, [])

  async function submit() {
    if (loading) return
    setLoading(true)
    try {
      const profile = mode === 'login' ? await login(email, password) : await register(name, email, password)
      await onAuthenticated(profile)
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.app}>
      <AuthBackground variant={mode} progress={modeProgress} />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
      <View style={{ height: compact ? 44 : 56 }} />
      <WelcomeKeyboardLayout>
      <ScrollView ref={scrollRef} scrollEnabled={keyboardOpen} bounces={false} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.authScreen, compact && styles.authCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar para boas-vindas" onPress={onBack} style={[styles.inline, { minHeight: compact ? 44 : 48, alignSelf: 'flex-start' }]}><FinanceIcon name="back" /><Text style={styles.linkText}>Voltar</Text></Pressable>
      <View style={[styles.brandBlock, compact && { gap: 8, paddingBottom: 0 }]}>
        <View style={{ width: '100%', height: compact ? 31 : 35 }}>
          <Animated.Text accessibilityElementsHidden={mode !== 'login'} importantForAccessibility={mode === 'login' ? 'auto' : 'no-hide-descendants'} style={[authVisuals.title, compact && { fontSize: 25, lineHeight: 31 }, { position: 'absolute', width: '100%', opacity: modeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>Entre na sua conta</Animated.Text>
          <Animated.Text accessibilityElementsHidden={mode !== 'register'} importantForAccessibility={mode === 'register' ? 'auto' : 'no-hide-descendants'} style={[authVisuals.title, compact && { fontSize: 25, lineHeight: 31 }, { position: 'absolute', width: '100%', opacity: modeProgress }]}>Crie sua conta</Animated.Text>
        </View>
        <View style={{ width: '100%', height: compact ? 21 : 42 }}>
          <Animated.Text accessibilityElementsHidden={mode !== 'login'} importantForAccessibility={mode === 'login' ? 'auto' : 'no-hide-descendants'} style={[authVisuals.subtitle, { position: 'absolute', width: '100%', opacity: modeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>Seu painel financeiro, sempre com você.</Animated.Text>
          <Animated.Text accessibilityElementsHidden={mode !== 'register'} importantForAccessibility={mode === 'register' ? 'auto' : 'no-hide-descendants'} style={[authVisuals.subtitle, { position: 'absolute', width: '100%', opacity: modeProgress }]}>Organize receitas, gastos e metas.</Animated.Text>
        </View>
      </View>
      <View style={styles.authForm}>
        <View style={{ gap: 0 }}>
        <Animated.View testID="auth-name-reveal" pointerEvents={mode === 'register' ? 'auto' : 'none'} accessibilityElementsHidden={mode !== 'register'} importantForAccessibility={mode === 'register' ? 'auto' : 'no-hide-descendants'} style={{ height: modeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, compact ? 84 : 92] }), overflow: 'hidden', opacity: modeProgress }}>
          {mode === 'register' && <Field authStyle label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" editable={!loading} />}
        </Animated.View>
        <View style={{ gap: compact ? 10 : 14 }}>
        <View style={{ gap: compact ? 4 : 8 }}>
          <Text style={authVisuals.label}>E-mail</Text>
          <SharedEmailAnchor stage="auth"><View style={[authVisuals.input, { justifyContent: 'center' }]}><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 16 }}>{email}</Text></View></SharedEmailAnchor>
          <Text style={styles.muted}>{mode === 'login' ? 'Encontramos sua conta.' : 'Vamos criar sua conta com este e-mail.'}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.linkText}>Alterar e-mail</Text></Pressable>
        </View>
        <Field authStyle label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry returnKeyType="go" onSubmitEditing={() => void submit()} editable={!loading} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => void submit()} style={({ pressed }) => [authVisuals.primary, compact && { minHeight: 48, paddingVertical: 12 }, (pressed || loading) && { opacity: 0.7 }]}>
          <Text style={authVisuals.primaryText}>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
        </Pressable>
        {!compact && <Text style={styles.helper}>Use a mesma conta do seu painel web.</Text>}
        </View>
        </View>
      </View>
      </ScrollView>
      </WelcomeKeyboardLayout>
      </SafeAreaView>
    </View>
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
    <View style={styles.app}>
      <View style={styles.safeArea}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contentInner}>
        <Text style={styles.brandMark}>COMECE DO SEU JEITO</Text>
        <Text style={styles.brandTitle}>Sua vida financeira,\ncom mais clareza.</Text>
        <Text style={styles.muted}>Conte um pouco sobre sua rotina para organizar suas receitas, contas e objetivos.</Text>
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
      </View>
    </View>
  )
}


function HomeSection({ transactions, goals, onGoTo }: { transactions: Transaction[]; goals: GoalItem[]; onGoTo: (section: Section) => void }) {
  const { width } = useWindowDimensions()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthTransactions = useMemo(() => currentMonthTransactions(transactions, new Date(year, month, 1)), [transactions, year, month])
  const monthlyIncome = getTotalIncome(monthTransactions)
  const monthlyExpenses = getTotalExpenses(monthTransactions)
  const balance = getBalance(transactions)
  const projected = getProjectedEndOfMonthBalance(transactions, balance)
  const recent = [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const balanceText = balanceVisible ? formatCurrency(balance) : 'R$ •••••'
  const balanceFontSize = Math.max(18, Math.min(37, (Math.min(width, 600) - 160) / (balanceText.length * 0.56)))
  const quickActions: { section: Section; label: string; icon: IconName }[] = [
    { section: 'transacoes', label: 'Transações', icon: 'wallet' },
    { section: 'metas', label: 'Metas', icon: 'target' },
    { section: 'recorrentes', label: 'Contas fixas', icon: 'repeat' },
    { section: 'graficos', label: 'Gráficos', icon: 'chart' },
  ]

  return (
    <View style={styles.stack}>
      <View style={styles.balanceCard}>
        <View style={styles.rowBetween}>
          <View style={styles.inline}><FinanceIcon name="wallet" size={18} /><Text style={styles.muted}>Seu saldo disponível</Text></View>
          <Pressable accessibilityLabel="Ver transações" style={styles.balanceArrow} onPress={() => onGoTo('transacoes')}><FinanceIcon name="arrow" color="#FFFFFF" size={18} /></Pressable>
        </View>
        <View style={styles.inline}>
          <Text selectable style={[styles.balanceValue, { fontSize: balanceFontSize }]}>{balanceText}</Text>
          <Pressable accessibilityLabel={balanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'} style={styles.eyeButton} onPress={() => setBalanceVisible(!balanceVisible)}><FinanceIcon name={balanceVisible ? 'eye-off' : 'eye'} size={20} color={palette.muted} /></Pressable>
        </View>
        <Pressable style={styles.balancePill} onPress={() => onGoTo('simulador')}><Text style={styles.balancePillText}>Previsão do mês · {balanceVisible ? formatCurrency(projected) : '•••••'}</Text><FinanceIcon name="arrow" size={13} /></Pressable>
      </View>
      <View style={styles.summaryGrid}>
        <MetricCard title="Receitas do mês" value={balanceVisible ? formatCurrency(monthlyIncome) : '•••••'} tone="good" />
        <MetricCard title="Gastos do mês" value={balanceVisible ? formatCurrency(monthlyExpenses) : '•••••'} tone="bad" />
      </View>
      <Text style={styles.muted}>Economia do mês · {balanceVisible ? formatCurrency(monthlyIncome - monthlyExpenses) : "•••••"}</Text>
      <View style={styles.panel}>
        <View style={styles.inline}><FinanceIcon name="sparkles" /><Text style={styles.cardTitle}>Um olhar sobre seu mês</Text></View>
        <Text style={styles.bodyText}>{financialInsight(transactions)}</Text>
        <PrimaryButton label="Registre um gasto com a IA" onPress={() => onGoTo('assistente')} />
      </View>
      <Text style={styles.cardTitle}>Ações rápidas</Text>
      <View style={styles.quickActions}>
        {quickActions.map((action) => <Pressable key={action.section} accessibilityRole="button" style={styles.quickAction} onPress={() => onGoTo(action.section)}><View style={styles.quickActionCircle}><FinanceIcon name={action.icon} /></View><Text style={styles.quickActionLabel}>{action.label}</Text></Pressable>)}
      </View>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Últimas transações</Text>
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
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('month')
  const [deleting, setDeleting] = useState<string | null>(null)
  async function remove(id: string) {
    setDeleting(id)
    try { await onDelete(id) } catch (error) { Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível excluir.') } finally { setDeleting(null) }
  }
  const filtered = (period === 'month' ? currentMonthTransactions(transactions) : transactions)
    .filter((item) => `${item.description} ${labelForCategory(item.category)}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .filter((item) => filter === 'all' || item.type === filter)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))

  return (
    <View style={styles.stack}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Transações</Text>
        <PrimaryButton label="Nova" onPress={onAdd} compact />
      </View>
      <Field label="Buscar transações" value={search} onChangeText={setSearch} placeholder="Descrição ou categoria" />
      <Segmented value={period} options={[{ id: 'month', label: 'Este mês' }, { id: 'all', label: 'Todo o histórico' }]} onChange={setPeriod} />
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
            <View key={item.id}>
              <TransactionRow item={item} />
              <View style={styles.modalActions}>
                <SecondaryButton label="Editar" onPress={() => onEdit(item)} />
                <Pressable accessibilityRole="button" disabled={deleting !== null} style={styles.secondaryButton} onPress={() => Alert.alert('Excluir transação?', `${item.description} · ${formatCurrency(item.amount)}`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void remove(item.id) }])}><Text style={styles.badText}>{deleting === item.id ? 'Excluindo...' : 'Excluir'}</Text></Pressable>
              </View>
            </View>
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
          <View key={item.monthName} style={styles.goalBlock}>
            <Text style={styles.cardTitle}>{item.monthName}</Text>
            <Text style={styles.bodyText}>Receitas {formatCurrency(item.income)} · Gastos {formatCurrency(item.expenses)}</Text>
            <Text style={item.balance >= 0 ? styles.goodText : styles.badText}>Saldo {formatCurrency(item.balance)} · Acumulado {formatCurrency(item.accumulatedBalance)}</Text>
          <View style={styles.chartRow}>
            <Text style={styles.chartLabel}>{item.monthName}</Text>
            <View style={styles.chartBars}>
              <View style={[styles.bar, styles.incomeBar, { width: `${Math.max(3, (item.income / maxMonth) * 100)}%` }]} />
              <View style={[styles.bar, styles.expenseBar, { width: `${Math.max(3, (item.expenses / maxMonth) * 100)}%` }]} />
            </View>
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

function AssistantSection({ transactions, onGoTo, onTransactionCreated, onEdit }: { transactions: Transaction[]; onGoTo: (section: Section) => void; onTransactionCreated: () => Promise<void>; onEdit: (transaction: Transaction) => void }) {
  const composer = useRef<TextInput>(null)
  const [valuesVisible, setValuesVisible] = useState(true)
  const { width, height } = useWindowDimensions()
  const compact = (Platform.OS === 'android' ? Dimensions.get('screen').height : height) < 680
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthTransactions = useMemo(() => currentMonthTransactions(transactions, new Date(year, month, 1)), [transactions, year, month])
  const balance = useMemo(() => getBalance(transactions), [transactions])
  const monthExpenses = useMemo(() => getTotalExpenses(monthTransactions), [monthTransactions])
  const balanceText = useMemo(() => formatCurrency(balance), [balance])
  const expenseText = useMemo(() => formatCurrency(monthExpenses), [monthExpenses])
  const summaryFontSize = Math.max(9, Math.min(22, (Math.min(width * 0.9, 560) - 101) / 2 / (Math.max(balanceText.length, expenseText.length) * 0.66)))
  const [createdTransaction, setCreatedTransaction] = useState<Transaction | null>(null)
  const conversation = useRef<ScrollView>(null)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messageBubbles = useMemo(() => messages.map((message, index) => (
          <View key={`${message.role}-${index}`} style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text style={message.role === 'user' ? styles.userMessageLabel : styles.messageLabel}>{message.role === 'user' ? 'VOCÊ' : 'FLOW ASSISTANT'}</Text>
            <Text selectable style={message.role === 'user' ? styles.userMessageText : styles.bodyText}>{message.content}</Text>
          </View>
        )), [messages])

  function summarizeMonth() {
    if (loading) return
    const month = monthTransactions
    const income = getTotalIncome(month)
    const expenses = getTotalExpenses(month)
    const reply = month.length === 0
      ? 'Ainda não há lançamentos neste mês. Conte uma receita ou um gasto para começarmos.'
      : `Seu mês até agora:\n\nReceitas: ${formatCurrency(income)}\nGastos: ${formatCurrency(expenses)}\nResultado do mês: ${formatCurrency(income - expenses)}\n\nVocê pode conferir cada lançamento no Extrato.`
    setMessages(previous => [...previous, { role: 'user', content: 'Como está meu mês?' }, { role: 'assistant', content: reply }])
    setError(null)
  }

  async function send(text = input) {
    if (!text.trim() || loading) return
    const next = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const response = await askAssistant(next)
      setMessages([...next, { role: 'assistant', content: response.reply }])
      if (response.created) {
        setCreatedTransaction(response.transaction)
        try { await onTransactionCreated() } catch {
          setError('Lançamento registrado. Atualize o extrato para ver o saldo mais recente.')
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não consegui responder agora.')
      setInput(text)
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  return (
    <WelcomeKeyboardLayout>
    <View style={styles.chatScreen}>
      <View style={styles.chatSummary}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver visão geral do saldo" onPress={() => onGoTo('inicio')} style={{ flex: 1, gap: 5 }}><Text style={[styles.muted, compact && { fontSize: 11, lineHeight: 16, minHeight: 32 }]}>Seu saldo disponível</Text><Text numberOfLines={1} style={[styles.summaryValue, { fontSize: summaryFontSize }]}>{valuesVisible ? balanceText : '•••••'}</Text></Pressable>
        <View style={styles.summaryDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ver gastos no extrato" onPress={() => onGoTo('transacoes')} style={{ flex: 1, gap: 5 }}><Text style={[styles.muted, compact && { fontSize: 11, lineHeight: 16, minHeight: 32 }]}>Gastos do mês</Text><Text numberOfLines={1} style={[styles.summaryValue, { fontSize: summaryFontSize }]}>{valuesVisible ? expenseText : '•••••'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={valuesVisible ? 'Ocultar valores' : 'Mostrar valores'} onPress={() => setValuesVisible(value => !value)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><FinanceIcon name={valuesVisible ? 'eye-off' : 'eye'} size={18} color={palette.muted} /></Pressable>
      </View>
      <ScrollView style={styles.chatMessages} ref={conversation} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.conversation, compact && { paddingVertical: 12 }]} onLayout={({ nativeEvent }) => { if (messages.length > 0 && nativeEvent.layout.height > 0) conversation.current?.scrollToEnd({ animated: true }) }} onContentSizeChange={() => { if (messages.length > 0) conversation.current?.scrollToEnd({ animated: true }) }}>
        {messages.length === 0 && <View style={[styles.chatIntro, compact && { paddingTop: 0, paddingBottom: 8, gap: 8 }]}>
          {!compact && <View style={styles.chatEmblem}><FinanceIcon name="sparkles" size={24} /></View>}
          <Text accessibilityRole="header" style={[styles.title, { textAlign: 'center', fontSize: compact ? 20 : 25, lineHeight: compact ? 26 : 32 }]}>O que vamos organizar hoje?</Text>
          {!compact && <Text style={styles.chatSubtitle}>Um gasto, um resumo ou o próximo objetivo. Vamos por partes.</Text>}
          <View style={styles.chatShortcuts}>
            <Pressable accessibilityRole="button" accessibilityLabel="Registrar gasto" disabled={loading} onPress={() => { setInput('Gastei R$ '); composer.current?.focus() }} style={styles.chatShortcut}><FinanceIcon name="plus" size={20} /><Text style={styles.chatShortcutText}>Registrar gasto</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Entender meu mês" disabled={loading} onPress={summarizeMonth} style={styles.chatShortcut}><FinanceIcon name="chart" size={20} /><Text style={styles.chatShortcutText}>Entender meu mês</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Planejar meta" onPress={() => onGoTo('metas')} style={styles.chatShortcut}><FinanceIcon name="target" size={20} /><Text style={styles.chatShortcutText}>Planejar meta</Text></Pressable>
          </View>
        </View>}
        {messageBubbles}
        {loading && <View style={[styles.chatBubble, styles.assistantBubble, styles.inline]}><ActivityIndicator color={palette.primary} /><Text style={styles.muted}>Organizando por aqui...</Text></View>}
        {createdTransaction && <View accessibilityLiveRegion="polite" style={styles.panel}>
          <Text style={styles.cardTitle}>Lançamento registrado</Text>
          <Text style={styles.bodyText}>{createdTransaction.type === 'income' ? 'Receita' : 'Gasto'} · {formatCurrency(createdTransaction.amount)} · {labelForCategory(createdTransaction.category)} · {formatDate(createdTransaction.date)}</Text>
          <SecondaryButton label="Revisar ou editar" onPress={() => onEdit(createdTransaction)} />
          <SecondaryButton label="Fechar confirmação" onPress={() => setCreatedTransaction(null)} />
        </View>}
      </ScrollView>
      <View style={styles.composerArea}>
        {error && <Text accessibilityRole="alert" style={styles.badText}>{error}</Text>}
        <View style={styles.composer}>
          <TextInput ref={composer} accessibilityLabel="Mensagem para o assistente" multiline value={input} onChangeText={setInput} placeholder="Conte um gasto ou pergunte sobre seu mês..." placeholderTextColor={palette.muted} style={styles.composerInput} />
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={loading || !input.trim()} onPress={() => void send()} style={[styles.sendButton, (loading || !input.trim()) && styles.disabled]}><FinanceIcon name="send" size={20} color="#FFFFFF" /></Pressable>
        </View>
        <Text style={styles.helper}>Você conversa. O Flow organiza.</Text>
      </View>
    </View>
    </WelcomeKeyboardLayout>
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
  const insets = useSafeAreaInsets()
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
      setAmount(editing ? editing.amount.toFixed(2).replace('.', ',') : '')
      setDate(editing?.date.slice(0, 10) ?? todayIso())
      setCategory(editing?.category ?? CATEGORIES[0])
      setPaymentMethod(editing?.paymentMethod ?? PAYMENT_METHODS[1])
    }, 0)
    return () => clearTimeout(id)
  }, [editing, open])

  async function save() {
    if (saving) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      Alert.alert('Data inválida', 'Informe uma data válida no formato YYYY-MM-DD.')
      return
    }
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
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHandle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalForm}>
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
          <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
          <Field label="Data" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>Categoria</Text>
          <ChoiceRow value={category} options={CATEGORIES.map((item) => ({ id: item, label: labelForCategory(item) }))} onChange={setCategory} />
          <Text style={styles.label}>Pagamento</Text>
          <ChoiceRow value={paymentMethod} options={PAYMENT_METHODS.map((item) => ({ id: item, label: item }))} onChange={setPaymentMethod} />
          </ScrollView>
          <View style={styles.modalActions}>
            <SecondaryButton label="Cancelar" onPress={onClose} />
            <PrimaryButton label={saving ? 'Salvando...' : 'Salvar'} onPress={() => void save()} disabled={saving} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function MoreSection({ user, onGoTo, onLogout }: { user: UserProfile; onGoTo: (section: Section) => void; onLogout: () => void }) {
  const entries: { id: Section; title: string; description: string; icon: IconName }[] = [
    { id: 'inicio', title: 'Visão geral', description: 'Veja seu saldo, projeções e movimentações', icon: 'home' },
    { id: 'metas', title: 'Metas e orçamento', description: 'Planeje seus objetivos e limites de gastos', icon: 'target' },
    { id: 'graficos', title: 'Gráficos e relatórios', description: 'Entenda para onde vai seu dinheiro', icon: 'chart' },
    { id: 'recorrentes', title: 'Receitas e contas fixas', description: 'Organize o que se repete todo mês', icon: 'repeat' },
    { id: 'simulador', title: 'Simulador de cenários', description: 'Veja como suas escolhas mudam o futuro', icon: 'sparkles' },
  ]
  return <View style={styles.stack}>
    <View style={styles.panel}><Text style={styles.title}>Tudo no seu ritmo.</Text><Text style={styles.muted}>{user.email}</Text></View>
    <View style={styles.panel}>{entries.map((entry) => <Pressable key={entry.id} accessibilityRole="button" style={styles.moreRow} onPress={() => onGoTo(entry.id)}><View style={styles.quickActionCircle}><FinanceIcon name={entry.icon} /></View><View style={styles.headerCopy}><Text style={styles.cardTitle}>{entry.title}</Text><Text style={styles.muted}>{entry.description}</Text></View><FinanceIcon name="arrow" size={18} /></Pressable>)}</View>
    <Pressable accessibilityRole="button" style={styles.signOut} onPress={onLogout}><FinanceIcon name="logout" size={19} /><Text style={styles.linkText}>Sair da conta</Text></Pressable>
  </View>
}

function BottomTabs({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  const selected = ['inicio', 'graficos', 'recorrentes', 'simulador'].includes(section) ? 'mais' : section
  return (
    <View testID="bottom-tab-footer" style={styles.tabFooter}>
    <View style={styles.bottomTabs}>
      <View style={styles.bottomTabsInner}>
        {tabs.map((tab) => {
          const active = tab.id === selected
          const destination = tab.id
          return (
            <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} style={[styles.tabButton, active && styles.tabButtonActive, tab.id === 'assistente' && styles.aiTab]} onPress={() => onChange(destination)}>
              <FinanceIcon name={tab.icon} size={21} color={tab.id === 'assistente' ? '#FFFFFF' : active ? palette.primary : palette.muted} />
              <Text style={[styles.tabLabel, active && styles.tabTextActive, tab.id === 'assistente' && { color: '#FFFFFF' }]}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
    </View>
  )
}

function TransactionRow({ item }: { item: Transaction }) {
  const isIncome = item.type === 'income'
  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionCategory}><FinanceIcon name={isIncome ? 'arrow' : 'wallet'} size={20} /></View>
      <View style={styles.transactionInfo}>
        <Text style={styles.bodyText}>{item.description || 'Sem descrição'}</Text>
        <Text style={styles.muted}>{formatDate(item.date)} · {labelForCategory(item.category)}</Text>
      </View>
      <Text style={isIncome ? styles.goodText : styles.badText}>{isIncome ? '+' : '-'}{formatCurrency(item.amount)}</Text>
    </View>
  )
}

function GoalProgress({ goal, balance }: { goal: GoalItem; balance: number }) {
  const current = Math.max(0, Math.min(goal.currentAmount, goal.targetAmount))
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
    <View style={[styles.metricCard, value.length > 16 && { flexBasis: '100%' }]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={tone === 'bad' ? styles.metricBad : tone === 'good' ? styles.metricGood : styles.metricValue}>{value}</Text>
    </View>
  )
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string; authStyle?: boolean }) {
  const { label, authStyle, ...inputProps } = props
  const [passwordVisible, setPasswordVisible] = useState(false)
  const icon: IconName | null = inputProps.secureTextEntry ? 'lock' : inputProps.keyboardType === 'email-address' ? 'mail' : label === 'Nome' ? 'user' : null
  return (
    <View style={styles.field}>
      <Text style={authStyle ? authVisuals.label : styles.label}>{label}</Text>
      <View style={styles.fieldInputRow}>
      {icon && <View style={styles.fieldIcon}><FinanceIcon name={icon} size={19} /></View>}
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        secureTextEntry={inputProps.secureTextEntry && !passwordVisible}
        placeholderTextColor={palette.muted}
        style={[authStyle ? authVisuals.input : styles.input, { flex: 1 }, icon && { paddingLeft: 44 }, inputProps.secureTextEntry && { paddingRight: 46 }, inputProps.style]}
        autoCapitalize={inputProps.secureTextEntry || inputProps.keyboardType === 'email-address' ? 'none' : undefined}
        autoCorrect={inputProps.secureTextEntry ? false : undefined}
      />
      {inputProps.secureTextEntry && <Pressable accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'} style={styles.passwordEye} onPress={() => setPasswordVisible(!passwordVisible)}><FinanceIcon name={passwordVisible ? 'eye-off' : 'eye'} size={19} /></Pressable>}
      </View>
    </View>
  )
}

function Segmented({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: value === option.id }} style={[styles.segmentButton, value === option.id && styles.segmentActive]} onPress={() => onChange(option.id)}>
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
          <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.choiceChip, active && styles.choiceChipActive]} onPress={() => onChange(option.id)}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function PrimaryButton({ label, onPress, disabled, compact }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={[styles.primaryButton, compact && styles.compactButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

function EmptyText({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>
}

const styles = StyleSheet.create({
  aiTab: { backgroundColor: '#6E7CFF', minHeight: 60, borderWidth: 2, borderColor: '#8893FF' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#BDC9D8', alignSelf: 'center' },
  modalForm: { gap: 16, paddingBottom: 6 },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center' },
  fieldIcon: { position: 'absolute', left: 16, zIndex: 1 },
  passwordEye: { position: 'absolute', right: 6, padding: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1, gap: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#141924', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)' },
  avatarText: { color: '#6E7CFF', fontSize: 20, fontWeight: '500' },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  balanceCard: { ...authVisuals.card, gap: 26, padding: 22 },
  balanceArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6E7CFF' },
  balanceValue: { flexShrink: 1, color: '#FFFFFF', fontSize: 37, fontWeight: '500', letterSpacing: -0.8 },
  eyeButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  balancePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  balancePillText: { flexShrink: 1, color: '#6E7CFF', fontSize: 11 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  quickAction: { flex: 1, alignItems: 'center', gap: 10 },
  quickActionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  transactionCategory: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
  addTabSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addTab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6E7CFF', borderWidth: 2, borderColor: '#8893FF', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
  chatSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 20, marginTop: 6, marginBottom: 4, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#141924', maxWidth: 560, width: '90%', alignSelf: 'center' },
  summaryValue: { color: '#FFFFFF', fontWeight: '500', letterSpacing: -0.5 },
  summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)' },
  chatShortcuts: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 6 },
  chatShortcut: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 82, padding: 8, borderRadius: 18, backgroundColor: '#141924', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chatShortcutText: { color: '#E3E6EF', fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },
  chatScreen: { flex: 1, minHeight: 0, paddingBottom: 8 },
  chatMessages: { flex: 1, minHeight: 0 },
  conversation: { padding: 22, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center', flexGrow: 1 },
  chatIntro: { alignItems: 'center', gap: 12, paddingTop: 4, paddingBottom: 12 },
  chatEmblem: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  chatSubtitle: { color: '#A1A7B3', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  messageLabel: { color: '#A1A7B3', fontSize: 13, fontWeight: '600', letterSpacing: 1.2 },
  userMessageLabel: { color: '#CDDCEC', fontSize: 13, fontWeight: '600', letterSpacing: 1.2 },
  userMessageText: { color: '#FFFFFF', fontSize: 14, lineHeight: 22 },
  suggestions: { gap: 10, marginTop: 6 },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.06)' },
  suggestionText: { color: '#6E7CFF', fontSize: 13, flex: 1 },
  composerArea: { flexShrink: 0, gap: 8, paddingHorizontal: 18, paddingTop: 10, maxWidth: 600, width: '100%', alignSelf: 'center' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 30, backgroundColor: '#141924', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  composerInput: { flex: 1, color: '#FFFFFF', fontSize: 16, lineHeight: 22, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 104 },
  sendButton: { width: 48, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6E7CFF' },
  app: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
  safeArea: { flex: 1 },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#090B10' },
  authScreen: { flexGrow: 1, flexShrink: 1, flexBasis: 0, justifyContent: 'center', gap: 20, paddingHorizontal: 24, paddingVertical: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  authCompact: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  authForm: { gap: 14 },
  brandBlock: { gap: 18, alignItems: 'center', paddingBottom: 8 },
  brandMark: { color: '#6E7CFF', fontSize: 22, fontWeight: '500', letterSpacing: -1 },
  brandTitle: { ...authVisuals.title, fontSize: 26, lineHeight: 32 },
  brandSubtitle: { ...authVisuals.subtitle, maxWidth: 300 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22, paddingVertical: 14, width: '100%', maxWidth: 600, alignSelf: 'center' },
  headerEyebrow: { color: '#6E7CFF', fontSize: 13, fontWeight: '500' },
  headerTitle: { ...authVisuals.title, fontSize: 24, lineHeight: 30, textAlign: 'left' },
  logoutButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#6E7CFF', fontWeight: '500' },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  stack: { gap: 22 },
  panel: { ...authVisuals.card, gap: 16, padding: 20 },
  title: { ...authVisuals.title, fontSize: 25, lineHeight: 32, textAlign: 'left' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.3 },
  bodyText: { color: '#E3E6EF', fontSize: 14, lineHeight: 20 },
  muted: { color: '#A1A7B3', fontSize: 13, lineHeight: 18 },
  helper: { color: '#A1A7B3', fontSize: 13, textAlign: 'center' },
  label: { ...authVisuals.label },
  field: { gap: 6 },
  input: { ...authVisuals.input },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  linkText: { color: '#6E7CFF', fontWeight: '500' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { ...authVisuals.card, flexGrow: 1, flexBasis: '45%', minHeight: 98, gap: 16, justifyContent: 'space-between', padding: 16 },
  metricTitle: { color: '#A1A7B3', fontSize: 13, fontWeight: '500' },
  metricValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '500' },
  metricGood: { color: '#4ADE80', fontSize: 18, fontWeight: '500' },
  metricBad: { color: '#F87171', fontSize: 18, fontWeight: '500' },
  goodText: { color: '#4ADE80', fontSize: 13, fontWeight: '500' },
  badText: { color: '#F87171', fontSize: 13, fontWeight: '500' },
  transactionRow: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(64,93,134,0.08)' },
  transactionDot: { width: 10, height: 10, borderRadius: 5 },
  dotGood: { backgroundColor: '#4ADE80' },
  dotBad: { backgroundColor: '#F87171' },
  transactionInfo: { flex: 1, minWidth: 0 },
  segmented: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  segmentButton: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center', paddingVertical: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: '#6E7CFF' },
  segmentText: { color: '#A1A7B3', fontSize: 13, fontWeight: '500' },
  segmentTextActive: { color: '#fff' },
  choiceRow: { gap: 8, paddingVertical: 2 },
  choiceChip: { paddingHorizontal: 12, minHeight: 48, justifyContent: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.06)' },
  choiceChipActive: { borderColor: '#6E7CFF', backgroundColor: 'rgba(64,93,134,0.12)' },
  choiceText: { color: '#6E7CFF', fontWeight: '500', fontSize: 12 },
  choiceTextActive: { color: '#FFFFFF' },
  primaryButton: { ...authVisuals.primary },
  compactButton: { minHeight: 48 },
  primaryButtonText: { ...authVisuals.primaryText },
  secondaryButton: { ...authVisuals.secondary },
  secondaryButtonText: { color: '#E3E6EF', fontSize: 15, fontWeight: '500' },
  disabled: { opacity: 0.55 },
  emptyText: { color: '#A1A7B3', textAlign: 'center', paddingVertical: 12 },
  listLine: { color: '#E3E6EF', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(64,93,134,0.08)' },
  goalBlock: { gap: 8, paddingVertical: 8 },
  progressTrack: { height: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 12, backgroundColor: '#6E7CFF' },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartLabel: { width: 32, color: '#A1A7B3', fontSize: 13, fontWeight: '500' },
  chartBars: { flex: 1, gap: 4 },
  bar: { height: 8, borderRadius: 12 },
  incomeBar: { backgroundColor: '#4ADE80' },
  expenseBar: { backgroundColor: '#F87171' },
  categoryLine: { gap: 6 },
  categoryTrack: { height: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  categoryFill: { height: 8, borderRadius: 12, backgroundColor: '#6E7CFF' },
  budgetLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(64,93,134,0.08)' },
  chatBubble: { ...authVisuals.card, gap: 8, padding: 18, maxWidth: '88%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6E7CFF', borderBottomRightRadius: 6, borderColor: '#6E7CFF' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#141924', borderBottomLeftRadius: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  modalCard: { maxHeight: '92%', gap: 16, padding: 24, paddingBottom: 38, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#141924', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  tabFooter: { flexShrink: 0, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  bottomTabs: { width: '100%', alignSelf: 'center', maxWidth: 560, borderRadius: 40, backgroundColor: 'rgba(15,19,28,0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', shadowColor: '#314A70', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  bottomTabsInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 78 },
  tabButton: { flex: 1, alignItems: 'center', gap: 6, borderRadius: 28, paddingVertical: 12 },
  tabButtonActive: { backgroundColor: 'rgba(64,93,134,0.06)' },
  tabIcon: { color: '#A1A7B3', fontSize: 16, fontWeight: '500' },
  tabLabel: { color: '#A1A7B3', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#6E7CFF' },
  fab: { position: 'absolute', right: 18, bottom: 86, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6E7CFF' },
  fabText: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '500' },
})
