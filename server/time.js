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

export function isBusinessDay(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

export function addBusinessDays(dateKey, amount) {
  let result = dateKey
  let remaining = amount
  while (remaining > 0) {
    result = addDays(result, 1)
    if (isBusinessDay(result)) remaining -= 1
  }
  return result
}

export function upcomingDeliveryDates(dateKey, count = 5) {
  return Array.from({ length: count }, (_, index) => addBusinessDays(dateKey, index + 1))
}

// Ordering does not open before this date, no matter how early "today" is.
export const MIN_ORDER_DATE = '2026-09-07'

export function eligibleOrderDates(today, count = 5) {
  const dates = []
  let cursor = today
  while (dates.length < count) {
    cursor = addBusinessDays(cursor, 1)
    if (cursor >= MIN_ORDER_DATE) dates.push(cursor)
  }
  return dates
}

export function orderPolicy(now = resolveNow()) {
  const parts = partsInMexico(now)
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  const isOpen = minutes >= ORDER_OPEN_MINUTES && minutes < ORDER_CLOSE_MINUTES

  return {
    timeZone: BUSINESS_TIME_ZONE,
    today,
    tomorrow: eligibleOrderDates(today, 1)[0],
    isOpen,
    opensAt: '08:00',
    closesAt: '18:00',
    currentTime: `${parts.hour}:${parts.minute}`,
  }
}
