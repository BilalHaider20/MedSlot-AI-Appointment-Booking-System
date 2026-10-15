const LOCALE = 'en-GB'
const CURRENCY = 'GBP'

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options)
  let cached = formatterCache.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options })
    formatterCache.set(key, cached)
  }
  return cached
}

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const result: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of formatter(timeZone, options).formatToParts(date)) {
    result[part.type] = part.value
  }
  return result
}

export function formatTime(iso: string, timeZone: string): string {
  const p = parts(new Date(iso), timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${p.hour}:${p.minute}`
}

export function formatTimeRange(startIso: string, endIso: string, timeZone: string): string {
  return `${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}`
}

export function dateBlock(iso: string, timeZone: string) {
  const p = parts(new Date(iso), timeZone, { weekday: 'short', day: 'numeric', month: 'short' })
  return { weekday: p.weekday ?? '', day: p.day ?? '', month: p.month ?? '' }
}

export function formatDate(iso: string, timeZone: string): string {
  const { weekday, day, month } = dateBlock(iso, timeZone)
  return `${weekday} ${day} ${month}`
}

/** Formats a calendar date ("2026-10-16") that is already in the business timezone. */
export function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return formatDate(new Date(Date.UTC(year, month - 1, day, 12)).toISOString(), 'UTC')
}

export function todayIn(timeZone: string): string {
  const p = parts(new Date(), timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${p.year}-${p.month}-${p.day}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

const priceFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })

export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100).replace(/\.00$/, '')
}
