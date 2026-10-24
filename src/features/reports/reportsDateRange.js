import { addSchoolDays, todayInSchoolTimezone } from '../../utils/scheduleDateTime'

export const reportsTimezone = 'Europe/Bucharest'

export function defaultReportRange(today = todayInSchoolTimezone(reportsTimezone)) {
  return { endDate: today, startDate: addSchoolDays(today, -29) }
}

export function touchedMonthCount({ endDate, startDate }) {
  const [startYear, startMonth] = startDate.split('-').map(Number)
  const [endYear, endMonth] = endDate.split('-').map(Number)
  return (endYear * 12 + endMonth) - (startYear * 12 + startMonth) + 1
}

export function validateReportRange({ endDate, startDate }, { requireChartRange = false } = {}) {
  if (!startDate || !endDate) {
    return 'Start and end dates are required.'
  }

  if (startDate > endDate) {
    return 'The end date must be on or after the start date.'
  }

  const inclusiveDays = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1
  if (inclusiveDays > 366) {
    return 'Reports support an inclusive range of up to 366 days.'
  }

  if (requireChartRange && touchedMonthCount({ endDate, startDate }) > 12) {
    return 'The attendance chart supports ranges touching at most 12 calendar months.'
  }

  return ''
}
