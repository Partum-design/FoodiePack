export type PackageTier = 'economico' | 'ejecutivo' | 'completo'

export type PackageDefinition = {
  tier: PackageTier
  label: string
  dailyPrice: number
  weeklyRegular: number
  weeklyPrepay: number
}

export const PACKAGES: Record<PackageTier, PackageDefinition> = {
  economico: { tier: 'economico', label: 'Económico', dailyPrice: 60, weeklyRegular: 300, weeklyPrepay: 290 },
  ejecutivo: { tier: 'ejecutivo', label: 'Ejecutivo', dailyPrice: 75, weeklyRegular: 375, weeklyPrepay: 365 },
  completo: { tier: 'completo', label: 'Completo Foodie', dailyPrice: 90, weeklyRegular: 450, weeklyPrepay: 430 },
}

export const PACKAGE_ORDER: PackageTier[] = ['economico', 'ejecutivo', 'completo']

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
