import { TZDate, tzScan } from '@date-fns/tz'

export class ScheduleDateTimeError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')

  if (!match) {
    throw new ScheduleDateTimeError('invalid-date', 'Choose a valid schedule date.')
  }

  const [, year, month, day] = match.map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    throw new ScheduleDateTimeError('invalid-date', 'Choose a valid schedule date.')
  }

  return { day, month, year }
}

function parseTime(time) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time ?? '')

  if (!match) {
    throw new ScheduleDateTimeError('invalid-time', 'Choose a valid schedule time.')
  }

  const [, hour, minute, second = '0'] = match
  const values = { hour: Number(hour), minute: Number(minute), second: Number(second) }

  if (values.hour > 23 || values.minute > 59 || values.second > 59) {
    throw new ScheduleDateTimeError('invalid-time', 'Choose a valid schedule time.')
  }

  return values
}

function localEpoch({ year, month, day }, { hour, minute, second }) {
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

function findDstIssue(dateParts, timeParts, timezone) {
  const wallTime = localEpoch(dateParts, timeParts)
  const transitions = tzScan(timezone, {
    end: new Date(wallTime + (48 * 60 * 60 * 1000)),
    start: new Date(wallTime - (48 * 60 * 60 * 1000)),
  })

  for (const transition of transitions) {
    const afterOffset = transition.offset * 60 * 1000
    const beforeOffset = (transition.offset - transition.change) * 60 * 1000
    const localBefore = transition.date.getTime() + beforeOffset
    const localAfter = transition.date.getTime() + afterOffset

    if (transition.change > 0 && wallTime >= localBefore && wallTime < localAfter) {
      return 'nonexistent'
    }

    if (transition.change < 0 && wallTime >= localAfter && wallTime < localBefore) {
      return 'ambiguous'
    }
  }

  return null
}

function formatParts(value, timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(new Date(value))
}

function partsAsObject(parts) {
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function schoolDateTimeToIso({ date, time, timezone }) {
  const dateParts = parseDate(date)
  const timeParts = parseTime(time)
  const dstIssue = findDstIssue(dateParts, timeParts, timezone)

  if (dstIssue === 'nonexistent') {
    throw new ScheduleDateTimeError(
      'nonexistent-time',
      'This local time does not exist because of the daylight-saving change. Choose a different time.',
    )
  }

  if (dstIssue === 'ambiguous') {
    throw new ScheduleDateTimeError(
      'ambiguous-time',
      'This local time occurs twice because of the daylight-saving change. Choose a non-ambiguous time.',
    )
  }

  return new Date(new TZDate(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    timezone,
  ).getTime()).toISOString()
}

export function schoolDateBoundaryToIso(date, timezone) {
  const dateParts = parseDate(date)

  return new Date(new TZDate(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    0,
    0,
    0,
    timezone,
  ).getTime()).toISOString()
}

export function schoolDateFromInstant(value, timezone) {
  const parts = partsAsObject(formatParts(value, timezone))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function schoolTimeFromInstant(value, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}

export function todayInSchoolTimezone(timezone) {
  return schoolDateFromInstant(new Date(), timezone)
}

export function addSchoolDays(date, amount) {
  const { day, month, year } = parseDate(date)
  const result = new Date(Date.UTC(year, month - 1, day + amount))
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, '0'),
    String(result.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function startOfSchoolWeek(date) {
  const { day, month, year } = parseDate(date)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  return addSchoolDays(date, mondayOffset)
}

export function scheduleRangeForView({ date, timezone, view }) {
  const startDate = view === 'week' ? startOfSchoolWeek(date) : date
  const endDate = addSchoolDays(startDate, view === 'week' ? 7 : 1)

  return {
    endDate,
    endIso: schoolDateBoundaryToIso(endDate, timezone),
    startDate,
    startIso: schoolDateBoundaryToIso(startDate, timezone),
  }
}

export function formatSchoolDate(value, timezone, options = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
    year: 'numeric',
    ...options,
  }).format(new Date(value))
}

export function formatSchoolTime(value, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}
