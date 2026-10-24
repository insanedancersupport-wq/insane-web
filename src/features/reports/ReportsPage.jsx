import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { formatSchoolDate } from '../../utils/scheduleDateTime'
import { useAuth } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import {
  getAttendanceTrendSeries,
  getCompetitionParticipationSeries,
  getCompetitionResultsReport,
  getGroupAttendanceReport,
  getStudentAttendanceReport,
  getTrainerActivityReport,
  reportsQueryKey,
} from './reportsApi'
import { defaultReportRange, reportsTimezone, validateReportRange } from './reportsDateRange'

const fiveMinutes = 5 * 60 * 1000
const pageSize = 25

function attendanceRate(value) {
  return value == null ? '—' : new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(Number(value))
}

function reportError(error, fallback) {
  if (error?.code === '42501') {
    return 'You do not have permission to view this report.'
  }

  return fallback
}

function TrendChart({ rows }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [
    Number(row.present_count),
    Number(row.absent_count),
    Number(row.recovery_count),
  ]))

  return (
    <section aria-labelledby="attendance-trend-title" className="reports-trend">
      <div className="section-heading">
        <div>
          <h2 id="attendance-trend-title">Attendance trend</h2>
          <p>Recorded monthly marks. Recovery is shown separately and excluded from attendance rate.</p>
        </div>
      </div>
      <div aria-label="Attendance trend chart" className="reports-chart" role="img">
        {rows.map((row) => (
          <div className="reports-chart__month" key={row.bucket_start}>
            <div className="reports-chart__bars">
              <span aria-label={`Present ${row.present_count}`} className="reports-chart__bar reports-chart__bar--present" style={{ height: `${(Number(row.present_count) / maximum) * 100}%` }} />
              <span aria-label={`Absent ${row.absent_count}`} className="reports-chart__bar reports-chart__bar--absent" style={{ height: `${(Number(row.absent_count) / maximum) * 100}%` }} />
              <span aria-label={`Recovery ${row.recovery_count}`} className="reports-chart__bar reports-chart__bar--recovery" style={{ height: `${(Number(row.recovery_count) / maximum) * 100}%` }} />
            </div>
            <span>{formatSchoolDate(`${row.bucket_start}T12:00:00Z`, reportsTimezone, { month: 'short', year: '2-digit' })}</span>
          </div>
        ))}
      </div>
      <div className="reports-table-wrap">
        <table className="reports-table">
          <caption>Attendance trend data</caption>
          <thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Recovery</th><th>Attendance rate</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.bucket_start}>
              <td>{formatSchoolDate(`${row.bucket_start}T12:00:00Z`, reportsTimezone, { month: 'long', year: 'numeric' })}</td>
              <td>{row.present_count}</td><td>{row.absent_count}</td><td>{row.recovery_count}</td><td>{attendanceRate(row.attendance_rate)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}

function ReportFilters({ draft, groups, onApply, onReset, onUpdate, validationError }) {
  return (
    <form className="reports-filters" onSubmit={onApply}>
      <label className="field" htmlFor="reports-start-date"><span className="field__label">Start date</span><input className="field__input" id="reports-start-date" onChange={(event) => onUpdate({ startDate: event.target.value })} type="date" value={draft.startDate} /></label>
      <label className="field" htmlFor="reports-end-date"><span className="field__label">End date</span><input className="field__input" id="reports-end-date" onChange={(event) => onUpdate({ endDate: event.target.value })} type="date" value={draft.endDate} /></label>
      <label className="field" htmlFor="reports-group"><span className="field__label">Group</span>
        <select className="field__input" id="reports-group" onChange={(event) => onUpdate({ groupId: event.target.value || null })} value={draft.groupId ?? ''}>
          <option value="">All authorized groups</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <p className="reports-filters__note">Student filtering is unavailable here because the current client API has no bounded authorized student search. Reports remain group-filtered and server-aggregated.</p>
      <div className="reports-filters__actions"><Button type="submit">Apply filters</Button><Button onClick={onReset} type="button" variant="secondary">Reset filters</Button></div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
    </form>
  )
}

function StudentReport({ data, onNext, onPrevious, page }) {
  if (data.length === 0) {
    if (page === 1) {
      return <EmptyState description="No recorded attendance matches these filters." title="No student attendance records" />
    }

    return (
      <>
        <EmptyState description="No further results are available. You can return to the previous page." title="No additional student attendance records" />
        <nav aria-label="Student attendance pagination" className="reports-pagination">
          <Button onClick={onPrevious} variant="secondary"><ChevronLeft aria-hidden="true" size={18} />Previous</Button>
          <span>Page {page}</span>
          <Button disabled onClick={onNext}>Next<ChevronRight aria-hidden="true" size={18} /></Button>
        </nav>
      </>
    )
  }

  const finalRow = data.at(-1)
  return (
    <>
      <div className="reports-table-wrap"><table className="reports-table"><caption>Student attendance by historical class group</caption>
        <thead><tr><th>Student</th><th>Historical group</th><th>Present</th><th>Absent</th><th>Recovery</th><th>Recorded marks</th><th>Attendance rate</th></tr></thead>
        <tbody>{data.map((row) => <tr key={`${row.student_id}-${row.group_id}`}><td>{row.student_display_name}</td><td>{row.group_name}</td><td>{row.present_count}</td><td>{row.absent_count}</td><td>{row.recovery_count}</td><td>{row.recorded_marks_count}</td><td>{attendanceRate(row.attendance_rate)}</td></tr>)}</tbody>
      </table></div>
      <nav aria-label="Student attendance pagination" className="reports-pagination"><Button disabled={page === 1} onClick={onPrevious} variant="secondary"><ChevronLeft aria-hidden="true" size={18} />Previous</Button><span>Page {page}</span><Button disabled={!finalRow?.has_more} onClick={onNext}>Next<ChevronRight aria-hidden="true" size={18} /></Button></nav>
    </>
  )
}

function GroupReport({ data }) {
  if (data.length === 0) {
    return <EmptyState description="No classes match these filters." title="No group attendance records" />
  }

  return <div className="reports-table-wrap"><table className="reports-table"><caption>Group attendance aggregates</caption>
    <thead><tr><th>Group</th><th>Current active students</th><th>Historical recorded students</th><th>Started classes</th><th>Status-completed classes</th><th>Present</th><th>Absent</th><th>Recovery</th><th>Attendance rate</th></tr></thead>
    <tbody>{data.map((row) => <tr key={row.group_id}><td>{row.group_name}</td><td>{row.current_active_students_count}</td><td>{row.historical_recorded_students_count}</td><td>{row.started_classes_count}</td><td>{row.status_completed_classes_count}</td><td>{row.present_count}</td><td>{row.absent_count}</td><td>{row.recovery_count}</td><td>{attendanceRate(row.attendance_rate)}</td></tr>)}</tbody>
  </table></div>
}

function TrainerActivityFilters({ draft, onApply, onReset, onUpdate, validationError }) {
  return (
    <form className="reports-filters" onSubmit={onApply}>
      <label className="field" htmlFor="trainer-reports-start-date"><span className="field__label">Start date</span><input className="field__input" id="trainer-reports-start-date" onChange={(event) => onUpdate({ startDate: event.target.value })} type="date" value={draft.startDate} /></label>
      <label className="field" htmlFor="trainer-reports-end-date"><span className="field__label">End date</span><input className="field__input" id="trainer-reports-end-date" onChange={(event) => onUpdate({ endDate: event.target.value })} type="date" value={draft.endDate} /></label>
      <p className="reports-filters__note">Trainer filtering is unavailable because the current client API has no bounded authorized trainer search. Trainers are scoped by the reporting service.</p>
      <div className="reports-filters__actions"><Button type="submit">Apply filters</Button><Button onClick={onReset} type="button" variant="secondary">Reset filters</Button></div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
    </form>
  )
}

function CompetitionFilters({ draft, onApply, onReset, onUpdate, validationError }) {
  return (
    <form className="reports-filters" onSubmit={onApply}>
      <label className="field" htmlFor="competition-reports-start-date"><span className="field__label">Start date</span><input className="field__input" id="competition-reports-start-date" onChange={(event) => onUpdate({ startDate: event.target.value })} type="date" value={draft.startDate} /></label>
      <label className="field" htmlFor="competition-reports-end-date"><span className="field__label">End date</span><input className="field__input" id="competition-reports-end-date" onChange={(event) => onUpdate({ endDate: event.target.value })} type="date" value={draft.endDate} /></label>
      <label className="field" htmlFor="competition-reports-status"><span className="field__label">Competition status</span><select className="field__input" id="competition-reports-status" onChange={(event) => onUpdate({ status: event.target.value || null })} value={draft.status ?? ''}><option value="">All statuses</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <label className="field" htmlFor="competition-reports-result-type"><span className="field__label">Result type</span><select className="field__input" id="competition-reports-result-type" onChange={(event) => onUpdate({ resultType: event.target.value || null })} value={draft.resultType ?? ''}><option value="">All result types</option><option value="individual">Individual</option><option value="team">Team</option></select></label>
      <p className="reports-filters__note">Competition filtering is unavailable because the current client API has no bounded authorized competition search. Status and result type filters narrow the server-authorized result set.</p>
      <div className="reports-filters__actions"><Button type="submit">Apply filters</Button><Button onClick={onReset} type="button" variant="secondary">Reset filters</Button></div>
      {validationError && <p className="form-error" role="alert">{validationError}</p>}
    </form>
  )
}

function TrainerActivityChart({ rows }) {
  const chartRows = rows.slice(0, 10)
  const maximum = Math.max(1, ...chartRows.flatMap((row) => [Number(row.started_classes_count), Number(row.status_completed_classes_count)]))

  return (
    <section aria-labelledby="trainer-activity-chart-title" className="reports-trend">
      <div className="section-heading"><div><h2 id="trainer-activity-chart-title">Class activity comparison</h2><p>Started and status-completed classes for the first 10 trainers alphabetically. The table contains the complete returned set.</p></div></div>
      <div aria-label="Trainer class activity chart" className="reports-chart reports-chart--activity" role="img">
        {chartRows.map((row) => <div className="reports-chart__month" key={row.trainer_id}><div className="reports-chart__bars"><span aria-label={`${row.trainer_display_name}: ${row.started_classes_count} started classes`} className="reports-chart__bar reports-chart__bar--present" style={{ height: `${(Number(row.started_classes_count) / maximum) * 100}%` }} /><span aria-label={`${row.trainer_display_name}: ${row.status_completed_classes_count} status-completed classes`} className="reports-chart__bar reports-chart__bar--completed" style={{ height: `${(Number(row.status_completed_classes_count) / maximum) * 100}%` }} /></div><span>{row.trainer_display_name}</span></div>)}
      </div>
    </section>
  )
}

function TrainerActivityReport({ data }) {
  if (data.length === 0) {
    return <EmptyState description="No trainer class activity matches these filters." title="No trainer activity records" />
  }

  return (
    <>
      <div className="reports-table-wrap"><table className="reports-table"><caption>Trainer activity aggregates</caption><thead><tr><th>Trainer</th><th>Started classes</th><th>Status-completed classes</th><th>Future scheduled classes</th><th>Cancelled classes</th><th>Distinct groups taught</th><th>Recorded attendance marks</th><th>Present</th><th>Absent</th><th>Recovery</th><th>Attendance rate</th></tr></thead><tbody>{data.map((row) => <tr key={row.trainer_id}><td>{row.trainer_display_name}</td><td>{row.started_classes_count}</td><td>{row.status_completed_classes_count}</td><td>{row.future_scheduled_classes_count}</td><td>{row.cancelled_classes_count}</td><td>{row.distinct_groups_taught_count}</td><td>{row.recorded_attendance_marks_count}</td><td>{row.present_count}</td><td>{row.absent_count}</td><td>{row.recovery_count}</td><td>{attendanceRate(row.attendance_rate)}</td></tr>)}</tbody></table></div>
      <TrainerActivityChart rows={data} />
    </>
  )
}

function CompetitionMembers({ row }) {
  const members = Array.isArray(row.result_member_display_names) ? row.result_member_display_names : []
  const truncated = members.length < Number(row.result_member_count)

  return <details className="reports-members"><summary>{truncated ? `Showing ${members.length} of ${row.result_member_count} members` : `${row.result_member_count} member${Number(row.result_member_count) === 1 ? '' : 's'}`}</summary><ul>{members.map((member) => <li key={member.student_id}>{member.display_name}</li>)}</ul></details>
}

function CompetitionResultsReport({ data, onNext, onPrevious, page }) {
  if (data.length === 0) {
    if (page === 1) {
      return <EmptyState description="No competitions match these filters." title="No competition result records" />
    }

    return <><EmptyState description="No further results are available. You can return to the previous page." title="No additional competition result records" /><nav aria-label="Competition results pagination" className="reports-pagination"><Button onClick={onPrevious} variant="secondary"><ChevronLeft aria-hidden="true" size={18} />Previous</Button><span>Page {page}</span><Button disabled>Next<ChevronRight aria-hidden="true" size={18} /></Button></nav></>
  }

  const finalRow = data.at(-1)
  return <><div className="reports-table-wrap"><table className="reports-table"><caption>Competition results by result entry</caption><thead><tr><th>Competition</th><th>Date</th><th>Status</th><th>Enrolled participants</th><th>Result type</th><th>Category</th><th>Team name</th><th>Placement</th><th>Award</th><th>Result members</th></tr></thead><tbody>{data.map((row) => <tr key={row.result_id ?? `${row.competition_id}-no-result`}><td>{row.competition_name}</td><td>{formatSchoolDate(`${row.competition_date}T12:00:00Z`, reportsTimezone)}</td><td>{row.competition_status}</td><td>{row.unique_enrolled_participants_count}</td>{row.result_id ? <><td>{row.result_type}</td><td>{row.category}</td><td>{row.team_name ?? '—'}</td><td>{row.placement ?? '—'}</td><td>{row.award ?? '—'}</td><td><CompetitionMembers row={row} /></td></> : <td colSpan="6">No results recorded</td>}</tr>)}</tbody></table></div><nav aria-label="Competition results pagination" className="reports-pagination"><Button disabled={page === 1} onClick={onPrevious} variant="secondary"><ChevronLeft aria-hidden="true" size={18} />Previous</Button><span>Page {page}</span><Button disabled={!finalRow?.has_more} onClick={onNext}>Next<ChevronRight aria-hidden="true" size={18} /></Button></nav></>
}

function CompetitionTrend({ rows }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [Number(row.competitions_count), Number(row.unique_enrolled_participants_count), Number(row.result_entries_count)]))

  return <section aria-labelledby="competition-trend-title" className="reports-trend"><div className="section-heading"><div><h2 id="competition-trend-title">Competition participation trend</h2><p>Unique enrolled participants are distinct students per month, not verified attendees.</p></div></div><div aria-label="Competition participation chart" className="reports-chart" role="img">{rows.map((row) => <div className="reports-chart__month" key={row.bucket_start}><div className="reports-chart__bars"><span aria-label={`Competitions ${row.competitions_count}`} className="reports-chart__bar reports-chart__bar--present" style={{ height: `${(Number(row.competitions_count) / maximum) * 100}%` }} /><span aria-label={`Unique enrolled participants ${row.unique_enrolled_participants_count}`} className="reports-chart__bar reports-chart__bar--completed" style={{ height: `${(Number(row.unique_enrolled_participants_count) / maximum) * 100}%` }} /><span aria-label={`Result entries ${row.result_entries_count}`} className="reports-chart__bar reports-chart__bar--recovery" style={{ height: `${(Number(row.result_entries_count) / maximum) * 100}%` }} /></div><span>{formatSchoolDate(`${row.bucket_start}T12:00:00Z`, reportsTimezone, { month: 'short', year: '2-digit' })}</span></div>)}</div><div className="reports-table-wrap"><table className="reports-table"><caption>Competition participation trend data</caption><thead><tr><th>Month</th><th>Competitions</th><th>Unique enrolled participants</th><th>Result entries</th><th>Individual results</th><th>Team results</th></tr></thead><tbody>{rows.map((row) => <tr key={row.bucket_start}><td>{formatSchoolDate(`${row.bucket_start}T12:00:00Z`, reportsTimezone, { month: 'long', year: 'numeric' })}</td><td>{row.competitions_count}</td><td>{row.unique_enrolled_participants_count}</td><td>{row.result_entries_count}</td><td>{row.individual_results_count}</td><td>{row.team_results_count}</td></tr>)}</tbody></table></div></section>
}

export function ReportsPage() {
  const { profile, session } = useAuth()
  const initialRange = useMemo(() => defaultReportRange(), [])
  const [attendanceDraft, setAttendanceDraft] = useState({ ...initialRange, groupId: null })
  const [attendanceApplied, setAttendanceApplied] = useState({ ...initialRange, groupId: null })
  const [trainerDraft, setTrainerDraft] = useState(initialRange)
  const [trainerApplied, setTrainerApplied] = useState(initialRange)
  const [competitionDraft, setCompetitionDraft] = useState({ ...initialRange, competitionId: null, resultType: null, status: null })
  const [competitionApplied, setCompetitionApplied] = useState({ ...initialRange, competitionId: null, resultType: null, status: null })
  const [activeReport, setActiveReport] = useState('student')
  const [studentPageIndex, setStudentPageIndex] = useState(0)
  const [studentCursorHistory, setStudentCursorHistory] = useState([null])
  const [competitionPageIndex, setCompetitionPageIndex] = useState(0)
  const [competitionCursorHistory, setCompetitionCursorHistory] = useState([null])
  const [attendanceValidationError, setAttendanceValidationError] = useState('')
  const [trainerValidationError, setTrainerValidationError] = useState('')
  const [competitionValidationError, setCompetitionValidationError] = useState('')
  const role = profile.role
  const userId = session.user.id
  const studentCursor = studentCursorHistory[studentPageIndex]
  const competitionCursor = competitionCursorHistory[competitionPageIndex]
  const attendanceTableDateValidation = validateReportRange(attendanceApplied)
  const attendanceChartDateValidation = activeReport === 'group'
    ? validateReportRange(attendanceApplied, { requireChartRange: true })
    : ''
  const trainerDateValidation = validateReportRange(trainerApplied)
  const competitionTableDateValidation = validateReportRange(competitionApplied)
  const competitionChartDateValidation = activeReport === 'competition'
    ? validateReportRange(competitionApplied, { requireChartRange: true })
    : ''

  const groupsQuery = useQuery({ queryKey: ['reports', userId, role, 'groups'], queryFn: listGroups, staleTime: fiveMinutes })
  const studentQuery = useQuery({
    enabled: !attendanceTableDateValidation && activeReport === 'student',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getStudentAttendanceReport({ afterCursor: studentCursor, endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, pageSize, startDate: attendanceApplied.startDate }),
    queryKey: reportsQueryKey({ cursor: studentCursor, endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, pageSize, reportType: 'student-attendance', role, startDate: attendanceApplied.startDate, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })
  const groupQuery = useQuery({
    enabled: !attendanceTableDateValidation && activeReport === 'group',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getGroupAttendanceReport({ endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, startDate: attendanceApplied.startDate }),
    queryKey: reportsQueryKey({ endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, reportType: 'group-attendance', role, startDate: attendanceApplied.startDate, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })
  const trendQuery = useQuery({
    enabled: !attendanceChartDateValidation && activeReport === 'group',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getAttendanceTrendSeries({ endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, startDate: attendanceApplied.startDate }),
    queryKey: reportsQueryKey({ endDate: attendanceApplied.endDate, groupId: attendanceApplied.groupId, reportType: 'attendance-trend', role, startDate: attendanceApplied.startDate, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })

  const trainerQuery = useQuery({
    enabled: !trainerDateValidation && activeReport === 'trainer',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getTrainerActivityReport({ endDate: trainerApplied.endDate, startDate: trainerApplied.startDate }),
    queryKey: reportsQueryKey({ endDate: trainerApplied.endDate, pageSize: null, reportType: 'trainer-activity', role, startDate: trainerApplied.startDate, trainerId: null, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })

  const competitionQuery = useQuery({
    enabled: !competitionTableDateValidation && activeReport === 'competition',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getCompetitionResultsReport({ afterCursor: competitionCursor, competitionId: competitionApplied.competitionId, endDate: competitionApplied.endDate, pageSize, resultType: competitionApplied.resultType, startDate: competitionApplied.startDate, status: competitionApplied.status }),
    queryKey: reportsQueryKey({ competitionId: competitionApplied.competitionId, cursor: competitionCursor, endDate: competitionApplied.endDate, pageSize, reportType: 'competition-results', resultType: competitionApplied.resultType, role, startDate: competitionApplied.startDate, status: competitionApplied.status, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })

  const competitionTrendQuery = useQuery({
    enabled: !competitionChartDateValidation && activeReport === 'competition',
    gcTime: 15 * 60 * 1000,
    queryFn: () => getCompetitionParticipationSeries({ endDate: competitionApplied.endDate, startDate: competitionApplied.startDate, status: competitionApplied.status }),
    queryKey: reportsQueryKey({ endDate: competitionApplied.endDate, reportType: 'competition-participation', role, startDate: competitionApplied.startDate, status: competitionApplied.status, userId }),
    refetchInterval: false, refetchOnWindowFocus: false, staleTime: fiveMinutes,
  })

  function applyAttendanceFilters(event) {
    event.preventDefault()
    const validationError = validateReportRange(attendanceDraft)
    setAttendanceValidationError(validationError)
    if (validationError) return
    setAttendanceApplied(attendanceDraft)
    setStudentPageIndex(0)
    setStudentCursorHistory([null])
  }

  function resetAttendanceFilters() {
    const range = { ...defaultReportRange(), groupId: null }
    setAttendanceDraft(range)
    setAttendanceApplied(range)
    setAttendanceValidationError('')
    setStudentPageIndex(0)
    setStudentCursorHistory([null])
  }

  function applyTrainerFilters(event) {
    event.preventDefault()
    const validationError = validateReportRange(trainerDraft)
    setTrainerValidationError(validationError)
    if (validationError) return
    setTrainerApplied(trainerDraft)
  }

  function resetTrainerFilters() {
    const range = defaultReportRange()
    setTrainerDraft(range)
    setTrainerApplied(range)
    setTrainerValidationError('')
  }

  function applyCompetitionFilters(event) {
    event.preventDefault()
    const validationError = validateReportRange(competitionDraft)
    setCompetitionValidationError(validationError)
    if (validationError) return
    setCompetitionApplied(competitionDraft)
    setCompetitionPageIndex(0)
    setCompetitionCursorHistory([null])
  }

  function resetCompetitionFilters() {
    const range = { ...defaultReportRange(), competitionId: null, resultType: null, status: null }
    setCompetitionDraft(range)
    setCompetitionApplied(range)
    setCompetitionValidationError('')
    setCompetitionPageIndex(0)
    setCompetitionCursorHistory([null])
  }

  function changeReport(report) {
    setActiveReport(report)
  }

  function nextStudentPage() {
    const cursor = studentQuery.data?.at(-1)?.next_cursor
    if (!cursor) return
    setStudentCursorHistory((history) => [...history.slice(0, studentPageIndex + 1), cursor])
    setStudentPageIndex((index) => index + 1)
  }

  function nextCompetitionPage() {
    const cursor = competitionQuery.data?.at(-1)?.next_cursor
    if (!cursor) return
    setCompetitionCursorHistory((history) => [...history.slice(0, competitionPageIndex + 1), cursor])
    setCompetitionPageIndex((index) => index + 1)
  }

  const activeQuery = activeReport === 'student'
    ? studentQuery
    : activeReport === 'group'
      ? groupQuery
      : activeReport === 'trainer'
        ? trainerQuery
        : competitionQuery

  return (
    <AppShell title="Reports">
      <section className="page-intro" aria-labelledby="reports-title"><p className="eyebrow">Reporting</p><h2 id="reports-title">Attendance reports</h2><p>School-local, server-aggregated reporting for recorded attendance.</p></section>
      <div className="reports-tabs" role="tablist" aria-label="Report sections">
        <button aria-selected={activeReport === 'student'} className={activeReport === 'student' ? 'reports-tab reports-tab--active' : 'reports-tab'} onClick={() => changeReport('student')} role="tab" type="button">Student Attendance</button>
        <button aria-selected={activeReport === 'group'} className={activeReport === 'group' ? 'reports-tab reports-tab--active' : 'reports-tab'} onClick={() => changeReport('group')} role="tab" type="button">Group Attendance</button>
        <button aria-selected={activeReport === 'trainer'} className={activeReport === 'trainer' ? 'reports-tab reports-tab--active' : 'reports-tab'} onClick={() => changeReport('trainer')} role="tab" type="button">Trainer Activity</button>
        <button aria-selected={activeReport === 'competition'} className={activeReport === 'competition' ? 'reports-tab reports-tab--active' : 'reports-tab'} onClick={() => changeReport('competition')} role="tab" type="button">Competition Results</button>
      </div>
      {(activeReport === 'student' || activeReport === 'group') && <><>{groupsQuery.error && <ErrorState description="Groups could not be loaded. You can still run an unfiltered report." title="Unable to load group filter" />}</><ReportFilters draft={attendanceDraft} groups={groupsQuery.data ?? []} onApply={applyAttendanceFilters} onReset={resetAttendanceFilters} onUpdate={(values) => setAttendanceDraft((current) => ({ ...current, ...values }))} validationError={attendanceValidationError} /></>}
      {activeReport === 'trainer' && <TrainerActivityFilters draft={trainerDraft} onApply={applyTrainerFilters} onReset={resetTrainerFilters} onUpdate={(values) => setTrainerDraft((current) => ({ ...current, ...values }))} validationError={trainerValidationError} />}
      {activeReport === 'competition' && <CompetitionFilters draft={competitionDraft} onApply={applyCompetitionFilters} onReset={resetCompetitionFilters} onUpdate={(values) => setCompetitionDraft((current) => ({ ...current, ...values }))} validationError={competitionValidationError} />}
      {activeQuery.isLoading && <LoadingState label="Loading attendance report" />}
      {activeQuery.error && <ErrorState action={<Button onClick={() => void activeQuery.refetch()} variant="secondary">Retry</Button>} description={activeReport === 'trainer' && activeQuery.error?.code === '22023' ? 'Too many trainers match this period. Please narrow your filters.' : reportError(activeQuery.error, 'The report could not be loaded.')} title="Unable to load report" />}
      {activeReport === 'student' && activeQuery.data && <StudentReport data={activeQuery.data} onNext={nextStudentPage} onPrevious={() => setStudentPageIndex((index) => index - 1)} page={studentPageIndex + 1} />}
      {activeReport === 'group' && activeQuery.data && <GroupReport data={activeQuery.data} />}
      {activeReport === 'trainer' && activeQuery.data && <TrainerActivityReport data={activeQuery.data} />}
      {activeReport === 'competition' && activeQuery.data && <CompetitionResultsReport data={activeQuery.data} onNext={nextCompetitionPage} onPrevious={() => setCompetitionPageIndex((index) => index - 1)} page={competitionPageIndex + 1} />}
      {activeReport === 'group' && trendQuery.isLoading && <LoadingState label="Loading attendance trend" />}
      {activeReport === 'group' && trendQuery.error && <ErrorState action={<Button onClick={() => void trendQuery.refetch()} variant="secondary">Retry</Button>} description={reportError(trendQuery.error, 'The trend could not be loaded.')} title="Unable to load attendance trend" />}
      {activeReport === 'group' && attendanceChartDateValidation && !attendanceTableDateValidation && <ErrorState description={attendanceChartDateValidation} title="Attendance trend unavailable for this range" />}
      {activeReport === 'group' && trendQuery.data && <TrendChart rows={trendQuery.data} />}
      {activeReport === 'competition' && competitionTrendQuery.isLoading && <LoadingState label="Loading competition participation trend" />}
      {activeReport === 'competition' && competitionTrendQuery.error && <ErrorState action={<Button onClick={() => void competitionTrendQuery.refetch()} variant="secondary">Retry</Button>} description={reportError(competitionTrendQuery.error, 'The competition trend could not be loaded.')} title="Unable to load competition trend" />}
      {activeReport === 'competition' && competitionChartDateValidation && !competitionTableDateValidation && <ErrorState description={competitionChartDateValidation} title="Competition trend unavailable for this range" />}
      {activeReport === 'competition' && competitionTrendQuery.data && <CompetitionTrend rows={competitionTrendQuery.data} />}
    </AppShell>
  )
}
