import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Card } from '../../components/ui/Card'
import { schoolDateBoundaryToIso, schoolDateFromInstant, schoolTimeFromInstant, todayInSchoolTimezone } from '../../utils/scheduleDateTime'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'
import { listGroups } from '../groups/groupsApi'
import { getMonthlyAttendance } from './attendanceApi'

const emptyRecords = []
const emptyRoster = []

function nextMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthlyRange(month, timezone) {
  const startDate = `${month}-01`
  const endDate = `${nextMonth(month)}-01`

  return {
    endIso: schoolDateBoundaryToIso(endDate, timezone),
    startIso: schoolDateBoundaryToIso(startDate, timezone),
  }
}

export function attendanceStatistics(records, rowCount, entryCount) {
  const counts = { absent: 0, present: 0, recovery: 0 }

  records.forEach((record) => {
    if (counts[record.status] !== undefined) {
      counts[record.status] += 1
    }
  })

  const recorded = counts.present + counts.absent + counts.recovery
  return {
    ...counts,
    participation: recorded === 0 ? 0 : Math.round(((counts.present + counts.recovery) / recorded) * 100),
    unmarked: Math.max((rowCount * entryCount) - recorded, 0),
  }
}

function matrixStudents(roster, records) {
  const students = new Map(roster.map((student) => [student.id, student]))
  records.forEach((record) => {
    if (record.student) {
      students.set(record.student_id, record.student)
    }
  })

  return [...students.values()].sort((left, right) => (
    `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`)
  ))
}

function statusLabel(status) {
  return status ? status[0].toUpperCase() : '—'
}

export function attendanceColumnHeader(entry, timezone) {
  const [year, month, day] = schoolDateFromInstant(entry.starts_at, timezone).split('-')
  const startTime = schoolTimeFromInstant(entry.starts_at, timezone)
  const endTime = schoolTimeFromInstant(entry.ends_at, timezone)
  const timeRange = `${startTime}–${endTime}`
  const date = `${day}.${month}`

  return {
    accessibleLabel: `${date}.${year}, ${timeRange}`,
    date,
    timeRange,
  }
}

export function AttendanceMatrixPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState('')
  const schoolSettingsQuery = useQuery({
    queryKey: ['school-settings', 'authoritative'],
    queryFn: getAuthoritativeSchoolSettings,
  })
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups })
  const timezone = schoolSettingsQuery.data?.timezone
  const groupId = searchParams.get('groupId') ?? ''

  useEffect(() => {
    if (timezone && !month) {
      setMonth(todayInSchoolTimezone(timezone).slice(0, 7))
    }
  }, [month, timezone])

  const range = useMemo(() => (month && timezone ? monthlyRange(month, timezone) : null), [month, timezone])
  const matrixQuery = useQuery({
    enabled: Boolean(groupId && range),
    queryKey: ['monthly-attendance', groupId, month],
    queryFn: () => getMonthlyAttendance({ groupId, rangeEnd: range.endIso, rangeStart: range.startIso }),
  })
  const records = matrixQuery.data?.records ?? emptyRecords
  const entries = matrixQuery.data?.entries ?? emptyRecords
  const students = useMemo(
    () => matrixStudents(matrixQuery.data?.roster ?? emptyRoster, records),
    [matrixQuery.data?.roster, records],
  )
  const recordsByCell = useMemo(
    () => new Map(records.map((record) => [`${record.student_id}:${record.schedule_entry_id}`, record])),
    [records],
  )
  const statistics = attendanceStatistics(records, students.length, entries.length)

  function selectGroup(event) {
    const value = event.target.value
    setSearchParams(value ? { groupId: value } : {})
  }

  return (
    <AppShell title="Attendance history">
      <section className="page-intro" aria-labelledby="attendance-history-title">
        <p className="eyebrow">Attendance</p>
        <h2 id="attendance-history-title">Monthly attendance</h2>
        <p>Attendance is recorded against each concrete class occurrence.</p>
      </section>
      <section aria-label="Attendance filters" className="list-filters">
        <label className="field" htmlFor="attendance-group">
          <span className="field__label">Group</span>
          <select className="field__input" id="attendance-group" onChange={selectGroup} value={groupId}>
            <option value="">Select a group</option>
            {groupsQuery.data?.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="attendance-month">
          <span className="field__label">Month</span>
          <input className="field__input" id="attendance-month" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
        </label>
      </section>
      {schoolSettingsQuery.isLoading || groupsQuery.isLoading || (groupId && matrixQuery.isLoading) ? <LoadingState label="Loading attendance history" /> : null}
      {schoolSettingsQuery.error || groupsQuery.error || matrixQuery.error ? <ErrorState title="Unable to load attendance history" /> : null}
      {!groupId && !groupsQuery.isLoading && <EmptyState description="Select a group to view its class attendance." title="Choose a group" />}
      {groupId && !matrixQuery.isLoading && !matrixQuery.error && entries.length === 0 && (
        <EmptyState description="There are no non-cancelled class occurrences in this month." title="No classes this month" />
      )}
      {groupId && !matrixQuery.isLoading && !matrixQuery.error && entries.length > 0 && (
        <>
          <section aria-label="Attendance statistics" className="attendance-statistics">
            {[
              ['Present', statistics.present],
              ['Absent', statistics.absent],
              ['Recovery', statistics.recovery],
              ['Unmarked', statistics.unmarked],
              ['Participation', `${statistics.participation}%`],
            ].map(([label, value]) => <Card key={label}><strong>{value}</strong><span>{label}</span></Card>)}
          </section>
          <div className="attendance-matrix-scroll">
            <table className="attendance-matrix">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  {entries.map((entry) => {
                    const header = attendanceColumnHeader(entry, timezone)
                    return (
                      <th aria-label={header.accessibleLabel} key={entry.id} scope="col">
                        <span className="attendance-matrix__date">{header.date}</span>
                        <span className="attendance-matrix__time">{header.timeRange}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <th scope="row">{student.first_name} {student.last_name}</th>
                    {entries.map((entry) => {
                      const record = recordsByCell.get(`${student.id}:${entry.id}`)
                      return (
                        <td key={entry.id}>
                          <Link aria-label={`${student.first_name} ${student.last_name}, ${schoolDateFromInstant(entry.starts_at, timezone)}: ${record?.status ?? 'unmarked'}`} className={`attendance-cell attendance-cell--${record?.status ?? 'unmarked'}`} to={`/app/attendance/entries/${entry.id}`}>
                            {statusLabel(record?.status)}
                          </Link>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  )
}
