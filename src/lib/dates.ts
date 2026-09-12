export function dateFromKey(date: string) {
  return new Date(`${date}T12:00:00`)
}

export function dayName(date: string, long = false) {
  return new Intl.DateTimeFormat('es-MX', { weekday: long ? 'long' : 'short' }).format(dateFromKey(date)).replace('.', '')
}

export function fullDate(date: string) {
  const value = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(date))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dateFromKey(date)).replace('.', '')
}

/** Sábado o domingo: la cocina no produce ni entrega esos días. */
export function isWeekend(date: string) {
  const day = dateFromKey(date).getDay()
  return day === 0 || day === 6
}

/** Lunes de la semana a la que pertenece la fecha. */
function weekStart(date: string) {
  const value = dateFromKey(date)
  const day = value.getDay()
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day))
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${dayOfMonth}`
}

/** ¿La fecha cae en una semana posterior a la de referencia? */
export function isLaterWeek(date: string, reference: string) {
  if (!date || !reference) return false
  return weekStart(date) > weekStart(reference)
}
