import { describe, expect, it } from 'vitest'

import {
  ScheduleDateTimeError,
  scheduleRangeForView,
  schoolDateTimeToIso,
} from './scheduleDateTime'

describe('scheduleDateTime', () => {
  it('converts school-local values using the configured timezone rather than the browser timezone', () => {
    expect(schoolDateTimeToIso({
      date: '2026-01-15',
      time: '10:00',
      timezone: 'Europe/Bucharest',
    })).toBe('2026-01-15T08:00:00.000Z')

    expect(schoolDateTimeToIso({
      date: '2026-07-15',
      time: '10:00',
      timezone: 'Europe/Bucharest',
    })).toBe('2026-07-15T07:00:00.000Z')
  })

  it('rejects nonexistent and ambiguous daylight-saving local times', () => {
    expect(() => schoolDateTimeToIso({
      date: '2026-03-29',
      time: '03:30',
      timezone: 'Europe/Bucharest',
    })).toThrow(ScheduleDateTimeError)

    expect(() => schoolDateTimeToIso({
      date: '2026-10-25',
      time: '03:30',
      timezone: 'Europe/Bucharest',
    })).toThrow(ScheduleDateTimeError)
  })

  it('creates bounded day and Monday-through-Monday week ranges', () => {
    expect(scheduleRangeForView({
      date: '2026-10-07',
      timezone: 'Europe/Bucharest',
      view: 'day',
    })).toMatchObject({
      endDate: '2026-10-08',
      startDate: '2026-10-07',
    })

    expect(scheduleRangeForView({
      date: '2026-10-07',
      timezone: 'Europe/Bucharest',
      view: 'week',
    })).toMatchObject({
      endDate: '2026-10-12',
      startDate: '2026-10-05',
    })
  })
})
