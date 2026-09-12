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
