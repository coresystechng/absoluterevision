type DbDateValue = Date | string | null | undefined

export function toDateInputValue(value: DbDateValue) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).split("T")[0] ?? String(value)
}

export function toIsoDateTime(value: DbDateValue) {
  if (!value) {
    return new Date().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

export function toTimeInputValue(value: DbDateValue) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toTimeString().slice(0, 5)
  }

  return String(value).slice(0, 5)
}
