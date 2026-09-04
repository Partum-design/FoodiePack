export type PackageTier = 'economico' | 'ejecutivo' | 'completo'

export type PackageDefinition = {
  tier: PackageTier
  label: string
  dailyPrice: number
  weeklyRegular: number
  weeklyPrepay: number
  includes: string[]
}

export const PACKAGES: Record<PackageTier, PackageDefinition> = {
  economico: {
    tier: 'economico', label: 'Económico', dailyPrice: 60, weeklyRegular: 300, weeklyPrepay: 290,
    includes: ['1 guisado a elegir', 'Arroz o frijoles', '3 tortillas'],
  },
  ejecutivo: {
    tier: 'ejecutivo', label: 'Ejecutivo', dailyPrice: 75, weeklyRegular: 375, weeklyPrepay: 365,
    includes: ['1 guisado a elegir', 'Arroz y frijoles', 'Huevo hervido opcional', '3 tortillas y salsa'],
  },
  completo: {
    tier: 'completo', label: 'Foodie+', dailyPrice: 90, weeklyRegular: 450, weeklyPrepay: 430,
    includes: ['2 guisados del día', '2 guarniciones', '3 tortillas', 'Agua 500 ml y gelatina'],
  },
}

export const PACKAGE_ORDER: PackageTier[] = ['economico', 'ejecutivo', 'completo']

export type Garnish = 'arroz' | 'frijoles'

export const GARNISH_OPTIONS: Array<{ value: Garnish; label: string }> = [
  { value: 'arroz', label: 'Arroz' },
  { value: 'frijoles', label: 'Frijoles' },
]

// Only Económico offers one guarnición to choose; Ejecutivo and Foodie+ already include both.
export const GARNISH_CHOICE_TIER: PackageTier = 'economico'

export const REPEAT_GUISADO_SURCHARGE = 15
export const REPEAT_GUISADO_TIER: PackageTier = 'completo'
export const WEEKLY_PLAN_DAYS = 5

export const BANK_TRANSFER = {
  bank: 'Banamex',
  clabe: '002180702441208124',
  holder: 'Dana Rodríguez',
}

export const ORDER_KEY_POINTS = [
  { title: 'Pedido anticipado', detail: 'Haz tu pedido y pago un día antes para entrar en la producción del día.' },
  { title: 'Comprobante', detail: 'Envíalo al WhatsApp del código QR ubicado al frente, junto con tu menú seleccionado.' },
  { title: 'Horario de entrega', detail: 'Entre 12:00 PM y 2:00 PM.' },
  { title: 'Envío gratis', detail: 'A menos de 3 km a la redonda (Lindavista Sur y San Felipe de Jesús).' },
  { title: 'Menú actualizado', detail: 'Consulta la carta de cada semana en nuestra página web.' },
]
