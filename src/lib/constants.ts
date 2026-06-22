export const CATEGORIES = [
  'Alimentacao',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saude',
  'Educacao',
  'Investimentos',
  'Outros',
]

export const CATEGORY_ALIASES: Record<string, string> = {
  Alimentacao: 'Alimentação',
  Saude: 'Saúde',
  Educacao: 'Educação',
}

export const PAYMENT_METHODS = [
  'Dinheiro',
  'PIX',
  'Cartao de Credito',
  'Cartao de Debito',
  'Transferencia',
  'Outros',
]

export function labelForCategory(category?: string | null) {
  if (!category) return 'Outros'
  return CATEGORY_ALIASES[category] ?? category
}

