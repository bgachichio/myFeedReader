// Centralised date formatter — respects user's date/time/timezone settings
import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

function parseDate(dateStr) {
  if (!dateStr) return null
  try { return parseISO(dateStr) } catch {}
  try { return new Date(dateStr) } catch {}
  return null
}

export function formatArticleDate(dateStr, settings = {}) {
  const date = parseDate(dateStr)
  if (!date || isNaN(date)) return ''

  const { dateFormat = 'relative', timeFormat = '12h', timezone } = settings

  try {
    if (dateFormat === 'relative') {
      return formatDistanceToNow(date, { addSuffix: true })
    }

    // Format in user's timezone if available
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

    const timeStr = timeFormat === '24h'
      ? formatInTimeZone(date, tz, 'HH:mm')
      : formatInTimeZone(date, tz, 'h:mm a')

    let dateStr2
    switch (dateFormat) {
      case 'dmy':    dateStr2 = formatInTimeZone(date, tz, 'dd/MM/yyyy'); break
      case 'mdy':    dateStr2 = formatInTimeZone(date, tz, 'MM/dd/yyyy'); break
      case 'ymd':    dateStr2 = formatInTimeZone(date, tz, 'yyyy/MM/dd'); break
      case 'medium': dateStr2 = formatInTimeZone(date, tz, 'MMM d, yyyy'); break
      default:       dateStr2 = formatInTimeZone(date, tz, 'dd/MM/yyyy')
    }

    return `${dateStr2} ${timeStr}`
  } catch {
    // Fallback if date-fns-tz fails
    try { return formatDistanceToNow(date, { addSuffix: true }) } catch { return '' }
  }
}

export function formatFullDate(dateStr, settings = {}) {
  const date = parseDate(dateStr)
  if (!date || isNaN(date)) return ''
  const { timezone } = settings
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    return formatInTimeZone(date, tz, 'EEEE, MMMM d, yyyy')
  } catch {
    return format(date, 'EEEE, MMMM d, yyyy')
  }
}
