export const BUSINESS_TIME_ZONE = 'America/Mexico_City'
export const ORDER_OPEN_MINUTES = 8 * 60
export const ORDER_CLOSE_MINUTES = 18 * 60

function partsInMexico(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

export function resolveNow() {
  if (process.env.NODE_ENV !== 'production' && process.env.FOODIEPACK_NOW) {
    const override = new Date(process.env.FOODIEPACK_NOW)
    if (!Number.isNaN(override.getTime())) return override
  }
  return new Date()
}

export function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return result.toISOString().slice(0, 10)
}

export function orderPolicy(now = resolveNow()) {
  const parts = partsInMexico(now)
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  const isOpen = minutes >= ORDER_OPEN_MINUTES && minutes < ORDER_CLOSE_MINUTES

  return {
    timeZone: BUSINESS_TIME_ZONE,
    today,
    tomorrow: addDays(today, 1),
    isOpen,
    opensAt: '08:00',
    closesAt: '18:00',
    currentTime: `${parts.hour}:${parts.minute}`,
  }
}
