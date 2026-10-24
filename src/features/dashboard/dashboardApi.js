import { listScheduleEntries } from '../calendar/calendarApi'
import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export function dashboardSummaryQueryKey({ endDate, role, startDate, userId }) {
  return ['dashboard', userId, role, 'summary', startDate, endDate]
}

export function dashboardUpcomingClassesQueryKey({ rangeEndDate, rangeStartDate, role, userId }) {
  return ['dashboard', userId, role, 'upcoming-classes', rangeStartDate, rangeEndDate]
}

export async function getDashboardSummary({ endDate, role, startDate }) {
  const functionName = role === 'admin'
    ? 'get_admin_dashboard_summary'
    : 'get_trainer_dashboard_summary'
  const { data, error } = await client().rpc(functionName, {
    target_end_date: endDate,
    target_start_date: startDate,
  })

  if (error) {
    throw error
  }

  return data?.[0] ?? null
}

export async function getUpcomingDashboardClasses({ rangeEnd, rangeStart }) {
  const entries = await listScheduleEntries({
    entryType: 'class',
    excludeCancelled: true,
    limit: 5,
    rangeEnd,
    rangeStart,
  })

  return entries.filter((entry) => entry.status !== 'cancelled' && entry.starts_at >= rangeStart)
}

export function invalidateDashboardQueries(queryClient) {
  return queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
