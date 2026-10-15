import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { formatSchoolDate, formatSchoolTime } from '../../utils/scheduleDateTime'
import { useAuth } from '../auth/AuthContext'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'
import { listTrainers } from '../trainers/trainersApi'
import {
  getAttendanceEntry,
  listAttendanceRecords,
  listAttendanceRoster,
  saveAttendanceRecords,
} from './attendanceApi'

const statusOptions = [
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Recovery', value: 'recovery' },
]
const emptyRecords = []
const emptyRoster = []

function studentName(student) {
  return `${student.first_name} ${student.last_name}`
}

function attendanceRows(roster, records) {
  const studentsById = new Map(roster.map((student) => [student.id, student]))

  records.forEach((record) => {
    if (record.student) {
      studentsById.set(record.student_id, record.student)
    }
  })

  return [...studentsById.values()].sort((left, right) => studentName(left).localeCompare(studentName(right)))
}

export function AttendancePage() {
  const { profile } = useAuth()
  const { scheduleEntryId } = useParams()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const entryQuery = useQuery({
    queryKey: ['attendance-entry', scheduleEntryId],
    queryFn: () => getAttendanceEntry(scheduleEntryId),
  })
  const schoolSettingsQuery = useQuery({
    queryKey: ['school-settings', 'authoritative'],
    queryFn: getAuthoritativeSchoolSettings,
  })
  const trainersQuery = useQuery({
    enabled: profile.role !== 'admin',
    queryKey: ['trainers'],
    queryFn: listTrainers,
  })
  const rosterQuery = useQuery({
    enabled: Boolean(entryQuery.data?.group_id) && entryQuery.data?.entry_type === 'class',
    queryKey: ['attendance-roster', entryQuery.data?.group_id],
    queryFn: () => listAttendanceRoster(entryQuery.data.group_id),
  })
  const recordsQuery = useQuery({
    enabled: Boolean(entryQuery.data?.id) && entryQuery.data?.entry_type === 'class',
    queryKey: ['attendance-records', scheduleEntryId],
    queryFn: () => listAttendanceRecords([scheduleEntryId]),
  })

  const entry = entryQuery.data
  const records = recordsQuery.data ?? emptyRecords
  const recordsByStudentId = useMemo(
    () => new Map(records.map((record) => [record.student_id, record])),
    [records],
  )
  const rows = useMemo(
    () => attendanceRows(rosterQuery.data ?? emptyRoster, records),
    [records, rosterQuery.data],
  )
  const ownTrainer = trainersQuery.data?.find((trainer) => trainer.profile_id === profile.id)
  const canEdit = profile.role === 'admin' || entry?.trainer_id === ownTrainer?.id

  useEffect(() => {
    if (!recordsQuery.data || hasUnsavedChanges) {
      return
    }

    setDraft(Object.fromEntries(records.map((record) => [record.student_id, {
      notes: record.notes ?? '',
      status: record.status,
    }])))
  }, [hasUnsavedChanges, records, recordsQuery.data])

  const saveMutation = useMutation({
    mutationFn: (recordsToSave) => saveAttendanceRecords({ records: recordsToSave, scheduleEntryId }),
    onSuccess: async () => {
      setHasUnsavedChanges(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance-records', scheduleEntryId] }),
        queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] }),
      ])
    },
  })

  function updateDraft(studentId, field, value) {
    setHasUnsavedChanges(true)
    setDraft((current) => ({
      ...current,
      [studentId]: {
        notes: current[studentId]?.notes ?? recordsByStudentId.get(studentId)?.notes ?? '',
        status: current[studentId]?.status ?? recordsByStudentId.get(studentId)?.status ?? '',
        [field]: value,
      },
    }))
  }

  async function saveAttendance() {
    const changed = Object.entries(draft)
      .filter(([studentId, value]) => (
        (
          value.status !== recordsByStudentId.get(studentId)?.status
          || value.notes !== (recordsByStudentId.get(studentId)?.notes ?? '')
        )
        && (value.status || recordsByStudentId.has(studentId))
      ))
      .map(([studentId, value]) => ({ ...value, studentId }))

    await saveMutation.mutateAsync(changed)
  }

  if (entryQuery.isLoading || schoolSettingsQuery.isLoading) {
    return <AppShell title="Attendance"><LoadingState label="Loading attendance" /></AppShell>
  }

  if (entryQuery.error || schoolSettingsQuery.error) {
    return <AppShell title="Attendance"><ErrorState title="Unable to load attendance" /></AppShell>
  }

  if (entry.entry_type !== 'class') {
    return <AppShell title="Attendance"><ErrorState description="Attendance is available only for class entries." title="Attendance unavailable" /></AppShell>
  }

  if (entry.status === 'cancelled') {
    return <AppShell title="Attendance"><ErrorState description="Attendance cannot be changed for a cancelled class." title="Attendance unavailable" /></AppShell>
  }

  const hasStarted = new Date(entry.starts_at) <= new Date()
  const isLoading = rosterQuery.isLoading || recordsQuery.isLoading
  const hasError = rosterQuery.error || recordsQuery.error

  return (
    <AppShell title="Attendance">
      <Link className="back-link" to="/app/calendar">Back to calendar</Link>
      <section className="page-intro" aria-labelledby="attendance-title">
        <p className="eyebrow">Class attendance</p>
        <h2 id="attendance-title">{entry.title}</h2>
        <p>
          {entry.group?.name || 'Unassigned group'} · {formatSchoolDate(entry.starts_at, schoolSettingsQuery.data.timezone, { weekday: 'long' })}
          {' · '}{formatSchoolTime(entry.starts_at, schoolSettingsQuery.data.timezone)}–{formatSchoolTime(entry.ends_at, schoolSettingsQuery.data.timezone)}
        </p>
      </section>
      {!canEdit && <p className="form-error" role="alert">Only the responsible trainer or an administrator can edit attendance.</p>}
      {!hasStarted && <p className="form-error" role="alert">Attendance can be marked once the class has started.</p>}
      {isLoading && <LoadingState label="Loading class roster" />}
      {hasError && <ErrorState title="Unable to load class attendance" />}
      {!isLoading && !hasError && rows.length === 0 && (
        <EmptyState description="There are no currently assigned students or recorded attendance for this class." title="No students to mark" />
      )}
      {!isLoading && !hasError && rows.length > 0 && (
        <>
          <section aria-label="Class roster" className="attendance-roster">
            {rows.map((student) => {
              const record = recordsByStudentId.get(student.id)
              const value = draft[student.id] ?? { notes: record?.notes ?? '', status: record?.status ?? '' }

              return (
                <Card className="attendance-row" key={student.id}>
                  <div>
                    <h3>{studentName(student)}</h3>
                    {record ? <Badge tone="success">Marked</Badge> : <Badge>Unmarked</Badge>}
                  </div>
                  <label className="field" htmlFor={`attendance-status-${student.id}`}>
                    <span className="field__label">Attendance status</span>
                    <select
                      disabled={!canEdit || !hasStarted || saveMutation.isPending}
                      id={`attendance-status-${student.id}`}
                      onChange={(event) => updateDraft(student.id, 'status', event.target.value)}
                      value={value.status}
                    >
                      <option value="">Not marked</option>
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="field" htmlFor={`attendance-notes-${student.id}`}>
                    <span className="field__label">Notes</span>
                    <input
                      className="field__input"
                      disabled={!canEdit || !hasStarted || saveMutation.isPending}
                      id={`attendance-notes-${student.id}`}
                      onChange={(event) => updateDraft(student.id, 'notes', event.target.value)}
                      value={value.notes}
                    />
                  </label>
                </Card>
              )
            })}
          </section>
          {canEdit && hasStarted && (
            <div className="form-actions attendance-actions">
              <Button disabled={saveMutation.isPending} onClick={saveAttendance}>
                {saveMutation.isPending ? 'Saving attendance...' : 'Save attendance'}
              </Button>
            </div>
          )}
          {saveMutation.error && <p className="form-error" role="alert">{saveMutation.error.message}</p>}
        </>
      )}
    </AppShell>
  )
}
