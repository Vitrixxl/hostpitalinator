const DATE_TEXT_VALUE_PATTERN = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
const DATE_TIME_TEXT_VALUE_PATTERN =
  /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2})[:h](\d{1,2})$/
const ISO_DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/
const ISO_DATE_TIME_VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

export const DATE_TEXT_INPUT_TITLE = "Format attendu : jj-mm-aaaa"
export const DATE_TIME_TEXT_INPUT_TITLE = "Format attendu : jj-mm-aaaa HH:mm"

export function formatDateTextDraftValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

export function formatDateTimeTextDraftValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 12)
  const date = formatDateTextDraftValue(digits.slice(0, 8))

  if (digits.length <= 8) {
    return date
  }

  const timeDigits = digits.slice(8)

  if (timeDigits.length <= 2) {
    return `${date} ${timeDigits}`
  }

  return `${date} ${timeDigits.slice(0, 2)}:${timeDigits.slice(2)}`
}

export function formatDateTextInputValue(value: string) {
  const parts = isoDateParts(value)

  if (!parts) {
    return value
  }

  return `${padDatePart(parts.day)}-${padDatePart(parts.month)}-${padDatePart(
    parts.year,
    4
  )}`
}

export function formatDateTimeTextInputValue(value: string) {
  const match = value.match(ISO_DATE_TIME_VALUE_PATTERN)

  if (!match) {
    return value
  }

  const [, year, month, day, hour, minute] = match
  return `${day}-${month}-${year} ${hour}:${minute}`
}

export function parseDateTextInputValue(value: string) {
  const match = value.trim().match(DATE_TEXT_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, dayValue, monthValue, yearValue] = match
  const day = Number(dayValue)
  const month = Number(monthValue)
  const year = Number(yearValue)

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return `${padDatePart(year, 4)}-${padDatePart(month)}-${padDatePart(day)}`
}

export function parseDateTimeTextInputValue(value: string) {
  const match = value.trim().match(DATE_TIME_TEXT_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, dayValue, monthValue, yearValue, hourValue, minuteValue] = match
  const day = Number(dayValue)
  const month = Number(monthValue)
  const year = Number(yearValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)

  if (
    !isValidDateParts(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return `${padDatePart(year, 4)}-${padDatePart(month)}-${padDatePart(
    day
  )}T${padDatePart(hour)}:${padDatePart(minute)}`
}

export function isoDateParts(value: string) {
  const match = value.match(ISO_DATE_VALUE_PATTERN)

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return { day, month, year }
}

export function dateFromIsoValue(value: string) {
  const parts = isoDateParts(value)

  if (!parts) {
    return null
  }

  return new Date(parts.year, parts.month - 1, parts.day)
}

export function isoDateFromDate(date: Date) {
  return `${padDatePart(date.getFullYear(), 4)}-${padDatePart(
    date.getMonth() + 1
  )}-${padDatePart(date.getDate())}`
}

export function timeFromIsoDateTime(value: string) {
  const match = value.match(ISO_DATE_TIME_VALUE_PATTERN)

  if (!match) {
    return "00:00"
  }

  const [, , , , hour, minute] = match
  return `${hour}:${minute}`
}

function isValidDateParts(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false
  }

  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function padDatePart(value: number, length = 2) {
  return value.toString().padStart(length, "0")
}

export function dateTimeLocalInput(value: string) {
  if (!value) {
    return nowLocalInput()
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16)
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function dateInput(value: string) {
  if (!value) {
    return todayInput()
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

export function nowLocalInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function todayInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

export function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("fr-FR").format(date)
}

export function formatShortDateTime(value: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ")
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function evolutionNoteDate(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatEvolutionNoteDay(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return "--"
  }

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date)
}

export function formatEvolutionNoteMonth(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return value.replace("T", " ").split(" ")[0] || "-"
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatEvolutionNoteTime(value: string) {
  const date = evolutionNoteDate(value)

  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
