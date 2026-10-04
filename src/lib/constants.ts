export const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
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
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Outros',
]

export function labelForCategory(category?: string | null) {
  if (!category) return 'Outros'
  return CATEGORY_ALIASES[category] ?? category
}

