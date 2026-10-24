import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatSchoolDate } from '../../utils/scheduleDateTime'
import { defaultReportRange, reportsTimezone, validateReportRange } from './reportsDateRange'

afterEach(() => vi.useRealTimers())

describe('reportsDateRange', () => {
  it('uses Bucharest calendar dates around local midnight and daylight-saving boundaries', () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-03-28T22:30:00.000Z'))
    expect(defaultReportRange()).toEqual({ endDate: '2026-03-29', startDate: '2026-02-28' })

    vi.setSystemTime(new Date('2026-10-24T21:30:00.000Z'))
    expect(defaultReportRange()).toEqual({ endDate: '2026-10-25', startDate: '2026-09-26' })
  })

  it('accepts a 366-day table range touching thirteen months while rejecting it for charts', () => {
    const range = { endDate: '2027-01-01', startDate: '2026-01-01' }

    expect(validateReportRange(range)).toBe('')
    expect(validateReportRange(range, { requireChartRange: true }))
      .toBe('The attendance chart supports ranges touching at most 12 calendar months.')
  })

  it('keeps monthly bucket labels on their Bucharest calendar month', () => {
    expect(formatSchoolDate('2026-03-01T12:00:00Z', reportsTimezone, {
      month: 'short',
      year: '2-digit',
    })).toBe('1 Mar 26')
    expect(formatSchoolDate('2026-10-01T12:00:00Z', reportsTimezone, {
      month: 'short',
      year: '2-digit',
    })).toBe('1 Oct 26')
  })
})
