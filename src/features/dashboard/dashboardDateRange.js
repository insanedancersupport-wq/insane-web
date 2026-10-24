import { addSchoolDays, todayInSchoolTimezone } from '../../utils/scheduleDateTime'

export const schoolTimezone = 'Europe/Bucharest'

function monthRange(date) {
  const [year, month] = date.split('-').map(Number)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  return { endDate: addSchoolDays(nextMonth, -1), startDate }
}

export function dashboardDateRanges(currentDate = todayInSchoolTimezone(schoolTimezone)) {
  const currentMonth = monthRange(currentDate)
  const previousMonthEnd = addSchoolDays(currentMonth.startDate, -1)

  return {
    currentMonth,
    last30Days: { endDate: currentDate, startDate: addSchoolDays(currentDate, -29) },
    previousMonth: monthRange(previousMonthEnd),
  }
}
