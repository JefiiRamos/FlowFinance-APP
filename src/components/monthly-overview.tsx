import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native'
import { FinanceIcon, palette } from './finance-visuals'
import { formatCurrency, getTotalExpenses, getTotalIncome, type Transaction } from '@/lib/finance'
import type { RecurringExpense, UserProfile } from '@/lib/api'

export function MonthlyOverview({ transactions, user, bills, visible, onToggle, onStatement, onBills }: {
  transactions: Transaction[]; user: UserProfile; bills: RecurringExpense[]; visible: boolean
  onToggle: () => void; onStatement: () => void; onBills: () => void
}) {
  const monthKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date())
  const month = transactions.filter(transaction => transaction.date.slice(0, 7) === monthKey)
  const income = getTotalIncome(month)
  const expenses = getTotalExpenses(month)
  const balance = income - expenses
  const fixed = bills.reduce((total, bill) => total + bill.amount, 0)
  const used = income > 0 ? Math.round(expenses / income * 100) : null
  const money = (value: number) => visible ? formatCurrency(value) : '•••••'
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' }).format(new Date())
  const progress = (visible && used !== null ? Math.min(100, used) + '%' : '0%') as DimensionValue
  return <View style={s.card}>
    <View style={s.header}>
      <View style={s.heading}><Text style={s.eyebrow}>SEU MÊS EM DIA</Text><Text accessibilityRole="header" style={s.title}>{monthLabel}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar valores' : 'Mostrar valores'} onPress={onToggle} style={s.eye}><FinanceIcon name={visible ? 'eye-off' : 'eye'} size={20} color={palette.muted} /></Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Ver resultado mensal no extrato" onPress={onStatement} style={s.balance}>
      <Text style={s.label}>Saldo do mês</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[s.balanceValue, balance < 0 && { color: palette.danger }]}>{money(balance)}</Text>
      <Text style={s.caption}>Receitas recebidas menos gastos registrados</Text>
    </Pressable>
    <View style={s.metrics}>
      <Pressable accessibilityRole="button" onPress={onStatement} style={s.metric}><Text style={s.label}>Receitas recebidas</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[s.value, { color: palette.success }]}>{money(income)}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onStatement} style={s.metric}><Text style={s.label}>Gastos do mês</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.value}>{money(expenses)}</Text></Pressable>
    </View>
    <View style={s.track} accessibilityLabel={visible && used !== null ? used + '% das receitas usadas' : 'Uso das receitas'}><View style={[s.fill, { width: progress, backgroundColor: used !== null && used >= 100 ? palette.danger : palette.primary }]} /></View>
    <Text style={s.caption}>{!visible ? 'Valores ocultos' : used !== null ? used + '% das receitas já usadas neste mês' : 'Registre seu salário para acompanhar o mês'}</Text>
    <View style={s.footer}>
      <View style={s.salary}><Text style={s.label}>Renda mensal planejada</Text><Text style={s.smallValue}>{user.monthlyIncomeTarget ? money(user.monthlyIncomeTarget) : 'Não informada'}</Text>{!!user.payDay && <Text style={s.caption}>Recebimento previsto: dia {user.payDay}</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver contas fixas cadastradas" onPress={onBills} style={s.salary}><Text style={s.label}>Contas fixas</Text><Text style={s.smallValue}>{money(fixed)}</Text><Text style={s.caption}>{bills.length} {bills.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}</Text></Pressable>
    </View>
  </View>
}
const s = StyleSheet.create({
  card: { padding: 20, gap: 12, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(110,124,255,0.22)', backgroundColor: '#141924' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { flex: 1, gap: 4 },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '600', letterSpacing: 1.6 },
  title: { color: palette.ink, fontSize: 18, fontWeight: '500', textTransform: 'capitalize' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  balance: { gap: 5 }, label: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  balanceValue: { color: palette.ink, fontSize: 32, fontWeight: '600', letterSpacing: -1 },
  caption: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: 'row', gap: 14, paddingTop: 4 }, metric: { flex: 1, gap: 6, minHeight: 48 },
  value: { color: palette.ink, fontSize: 19, fontWeight: '500' },
  track: { height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 5 },
  footer: { flexDirection: 'row', gap: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  salary: { flex: 1, gap: 4 }, smallValue: { color: palette.ink, fontSize: 15, fontWeight: '500' },
})
