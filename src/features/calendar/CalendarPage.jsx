import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { AppShell } from '../../components/layout/AppShell'
import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import {
  addSchoolDays,
  formatSchoolDate,
  formatSchoolTime,
  scheduleRangeForView,
  schoolDateFromInstant,
  schoolDateTimeToIso,
  schoolTimeFromInstant,
  todayInSchoolTimezone,
} from '../../utils/scheduleDateTime'
import { useAuth } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import { listRooms } from '../rooms/roomsApi'
import { listTrainers } from '../trainers/trainersApi'
import {
  cancelScheduleEntry,
  createScheduleEntry,
  createWeeklyScheduleEntries,
  deleteScheduleEntry,
  getAuthoritativeSchoolSettings,
  listScheduleEntries,
  updateScheduleEntry,
} from './calendarApi'

const scheduleTypes = ['class', 'workshop', 'meeting', 'event', 'unavailable']

const entryFields = {
  date: z.string().min(1, 'Date is required.'),
  end_time: z.string().min(1, 'End time is required.'),
  entry_type: z.enum(scheduleTypes),
  group_id: z.string(),
  is_extra: z.boolean(),
  notes: z.string(),
  room_id: z.string(),
  start_time: z.string().min(1, 'Start time is required.'),
  title: z.string().trim().min(1, 'Title is required.'),
  trainer_id: z.string(),
}

function validateEntry(values, context) {
  if (values.end_time <= values.start_time) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time on the same date.',
      path: ['end_time'],
    })
  }

  if (values.entry_type === 'class') {
    for (const field of ['group_id', 'trainer_id', 'room_id']) {
      if (!values[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Classes require a group, responsible trainer, and room.',
          path: [field],
        })
      }
    }
  }
}

const entrySchema = z.object(entryFields).superRefine(validateEntry)

const weeklySchema = z.object({
  ...entryFields,
  first_date: z.string().min(1, 'First date is required.'),
  iso_weekday: z.coerce.number().int().min(1).max(7),
  last_date: z.string().min(1, 'Last date is required.'),
}).superRefine((values, context) => {
  validateEntry(values, context)

  if (values.last_date < values.first_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The final date must be on or after the first date.',
      path: ['last_date'],
    })
  }
})

function entryFormValues(entry, timezone, selectedDate) {
  if (!entry?.id) {
    return {
      date: selectedDate,
      end_time: '',
      entry_type: 'class',
      group_id: '',
      is_extra: false,
      notes: '',
      room_id: '',
      start_time: '',
      title: '',
      trainer_id: '',
    }
  }

  return {
    date: schoolDateFromInstant(entry.starts_at, timezone),
    end_time: schoolTimeFromInstant(entry.ends_at, timezone),
    entry_type: entry.entry_type,
    group_id: entry.group_id ?? '',
    is_extra: entry.is_extra,
    notes: entry.notes ?? '',
    room_id: entry.room_id ?? '',
    start_time: schoolTimeFromInstant(entry.starts_at, timezone),
    title: entry.title,
    trainer_id: entry.trainer_id ?? '',
  }
}

function entryPayload(values, timezone, profileId) {
  return {
    created_by: profileId,
    ends_at: schoolDateTimeToIso({ date: values.date, time: values.end_time, timezone }),
    entry_type: values.entry_type,
    group_id: values.group_id || null,
    is_extra: values.is_extra,
    notes: values.notes.trim() || null,
    room_id: values.room_id || null,
    starts_at: schoolDateTimeToIso({ date: values.date, time: values.start_time, timezone }),
    title: values.title.trim(),
    trainer_id: values.trainer_id || null,
  }
}

function ResourceSelect({ children, id, label, register }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select className="field__input" id={id} {...register}>
        {children}
      </select>
    </label>
  )
}

function EntryForm({ entry, formId, groups, onSubmit, rooms, selectedDate, timezone, trainers }) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: entryFormValues(entry, timezone, selectedDate),
    resolver: zodResolver(entrySchema),
  })

  async function submit(values) {
    try {
      await onSubmit(values)
    } catch (error) {
      setError('root', { message: error.message })
    }
  }

  return (
    <form className="entity-form" id={formId} onSubmit={handleSubmit(submit)}>
      <Input label="Title" {...register('title')} />
      {errors.title && <p className="form-error" role="alert">{errors.title.message}</p>}
      <ResourceSelect id="schedule-entry-type" label="Type" register={register('entry_type')}>
        {scheduleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </ResourceSelect>
      <Input label="Date" type="date" {...register('date')} />
      {errors.date && <p className="form-error" role="alert">{errors.date.message}</p>}
      <div className="calendar-form-times">
        <Input label="Start time" type="time" {...register('start_time')} />
        <Input label="End time" type="time" {...register('end_time')} />
      </div>
      {(errors.start_time || errors.end_time) && (
        <p className="form-error" role="alert">{errors.start_time?.message || errors.end_time?.message}</p>
      )}
      <ResourceSelect id="schedule-entry-group" label="Group" register={register('group_id')}>
        <option value="">No group</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </ResourceSelect>
      {errors.group_id && <p className="form-error" role="alert">{errors.group_id.message}</p>}
      <ResourceSelect id="schedule-entry-trainer" label="Responsible trainer" register={register('trainer_id')}>
        <option value="">No responsible trainer</option>
        {trainers.map((trainer) => (
          <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>
        ))}
      </ResourceSelect>
      {errors.trainer_id && <p className="form-error" role="alert">{errors.trainer_id.message}</p>}
      <ResourceSelect id="schedule-entry-room" label="Room" register={register('room_id')}>
        <option value="">No room</option>
        {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </ResourceSelect>
      {errors.room_id && <p className="form-error" role="alert">{errors.room_id.message}</p>}
      <label className="assignment-option" htmlFor="schedule-entry-extra">
        <input id="schedule-entry-extra" type="checkbox" {...register('is_extra')} />
        Extra activity
      </label>
      <label className="field" htmlFor="schedule-entry-notes">
        <span className="field__label">Notes</span>
        <textarea className="field__input field__textarea" id="schedule-entry-notes" {...register('notes')} />
      </label>
      {errors.root && <p className="form-error" role="alert">{errors.root.message}</p>}
    </form>
  )
}

function WeeklyEntryForm({ formId, groups, onSubmit, rooms, selectedDate, trainers }) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: {
      date: selectedDate,
      end_time: '',
      entry_type: 'class',
      first_date: selectedDate,
      group_id: '',
      iso_weekday: 1,
      is_extra: false,
      last_date: selectedDate,
      notes: '',
      room_id: '',
      start_time: '',
      title: '',
      trainer_id: '',
    },
    resolver: zodResolver(weeklySchema),
  })

  async function submit(values) {
    try {
      await onSubmit(values)
    } catch (error) {
      setError('root', { message: error.message })
    }
  }

  return (
    <form className="entity-form" id={formId} onSubmit={handleSubmit(submit)}>
      <Input label="Title" {...register('title')} />
      {errors.title && <p className="form-error" role="alert">{errors.title.message}</p>}
      <ResourceSelect id="weekly-entry-type" label="Type" register={register('entry_type')}>
        {scheduleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </ResourceSelect>
      <ResourceSelect id="weekly-entry-weekday" label="Every" register={register('iso_weekday')}>
        <option value="1">Monday</option>
        <option value="2">Tuesday</option>
        <option value="3">Wednesday</option>
        <option value="4">Thursday</option>
        <option value="5">Friday</option>
        <option value="6">Saturday</option>
        <option value="7">Sunday</option>
      </ResourceSelect>
      <div className="calendar-form-times">
        <Input label="Start time" type="time" {...register('start_time')} />
        <Input label="End time" type="time" {...register('end_time')} />
      </div>
      {(errors.start_time || errors.end_time) && (
        <p className="form-error" role="alert">{errors.start_time?.message || errors.end_time?.message}</p>
      )}
      <div className="calendar-form-times">
        <Input label="First date" type="date" {...register('first_date')} />
        <Input label="Final date" type="date" {...register('last_date')} />
      </div>
      {(errors.first_date || errors.last_date) && (
        <p className="form-error" role="alert">{errors.first_date?.message || errors.last_date?.message}</p>
      )}
      <ResourceSelect id="weekly-entry-group" label="Group" register={register('group_id')}>
        <option value="">No group</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </ResourceSelect>
      {errors.group_id && <p className="form-error" role="alert">{errors.group_id.message}</p>}
      <ResourceSelect id="weekly-entry-trainer" label="Responsible trainer" register={register('trainer_id')}>
        <option value="">No responsible trainer</option>
        {trainers.map((trainer) => (
          <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>
        ))}
      </ResourceSelect>
      {errors.trainer_id && <p className="form-error" role="alert">{errors.trainer_id.message}</p>}
      <ResourceSelect id="weekly-entry-room" label="Room" register={register('room_id')}>
        <option value="">No room</option>
        {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </ResourceSelect>
      {errors.room_id && <p className="form-error" role="alert">{errors.room_id.message}</p>}
      <label className="assignment-option" htmlFor="weekly-entry-extra">
        <input id="weekly-entry-extra" type="checkbox" {...register('is_extra')} />
        Extra activity
      </label>
      <label className="field" htmlFor="weekly-entry-notes">
        <span className="field__label">Notes</span>
        <textarea className="field__input field__textarea" id="weekly-entry-notes" {...register('notes')} />
      </label>
      {errors.root && <p className="form-error" role="alert">{errors.root.message}</p>}
    </form>
  )
}

function EntryCard({ entry, onClick, timezone }) {
  const trainerName = entry.trainer ? `${entry.trainer.first_name} ${entry.trainer.last_name}` : null

  return (
    <button
      className={`calendar-entry${entry.status === 'cancelled' ? ' calendar-entry--cancelled' : ''}`}
      onClick={() => onClick(entry)}
      type="button"
    >
      <strong>{entry.title}</strong>
      <span>{formatSchoolTime(entry.starts_at, timezone)}–{formatSchoolTime(entry.ends_at, timezone)}</span>
      <span>{[entry.group?.name, trainerName].filter(Boolean).join(' · ') || entry.entry_type}</span>
      <span className="calendar-entry__badges">
        {entry.is_extra && <Badge tone="warning">Extra</Badge>}
        {entry.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
      </span>
    </button>
  )
}

function DayCalendar({ entries, onEntryClick, rooms, timezone }) {
  const roomLanes = new Map((rooms ?? []).map((room) => [room.id, { ...room, entries: [] }]))
  const otherLane = { entries: [], id: 'other', name: 'Other activities' }

  entries.forEach((entry) => {
    const lane = entry.room_id ? roomLanes.get(entry.room_id) : null
    if (lane) {
      lane.entries.push(entry)
    } else {
      otherLane.entries.push(entry)
    }
  })

  const lanes = [...roomLanes.values(), otherLane].filter((lane) => lane.entries.length > 0 || lane.id !== 'other')

  return (
    <section aria-label="Day schedule" className="calendar-day">
      {lanes.map((lane) => (
        <Card className="calendar-lane" key={lane.id}>
          <h3>{lane.name}</h3>
          {lane.entries.length === 0 ? (
            <p>No activities in this room.</p>
          ) : (
            <div className="calendar-lane__entries">
              {lane.entries.map((entry) => (
                <EntryCard entry={entry} key={entry.id} onClick={onEntryClick} timezone={timezone} />
              ))}
            </div>
          )}
        </Card>
      ))}
    </section>
  )
}

function WeekCalendar({ entries, onEntryClick, range, selectedDate, setSelectedDate, timezone }) {
  const days = Array.from({ length: 7 }, (_, index) => addSchoolDays(range.startDate, index))

  return (
    <>
      <div aria-label="Week day selector" className="calendar-week-strip">
        {days.map((date) => (
          <Button
            className={selectedDate === date ? 'calendar-week-strip__day calendar-week-strip__day--active' : 'calendar-week-strip__day'}
            key={date}
            onClick={() => setSelectedDate(date)}
            variant="tertiary"
          >
            {formatSchoolDate(`${date}T12:00:00Z`, timezone, { day: 'numeric', weekday: 'short' })}
          </Button>
        ))}
      </div>
      <section aria-label="Week schedule" className="calendar-week">
        {days.map((date) => {
          const dayEntries = entries.filter((entry) => schoolDateFromInstant(entry.starts_at, timezone) === date)

          return (
            <Card
              className={`calendar-week__day${selectedDate === date ? ' calendar-week__day--selected' : ''}`}
              key={date}
            >
              <h3>{formatSchoolDate(`${date}T12:00:00Z`, timezone, { day: 'numeric', weekday: 'short' })}</h3>
              {dayEntries.length === 0 ? (
                <p>No activities.</p>
              ) : (
                <div className="calendar-lane__entries">
                  {dayEntries.map((entry) => (
                    <EntryCard entry={entry} key={entry.id} onClick={onEntryClick} timezone={timezone} />
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </section>
    </>
  )
}

export function CalendarPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editingEntry, setEditingEntry] = useState(null)
  const [filter, setFilter] = useState({ entryType: '', groupId: '', roomId: '', trainerId: '' })
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [deleteEntry, setDeleteEntry] = useState(null)
  const [view, setView] = useState('day')
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false)
  const schoolSettingsQuery = useQuery({
    queryKey: ['school-settings', 'authoritative'],
    queryFn: getAuthoritativeSchoolSettings,
  })
  const timezone = schoolSettingsQuery.data?.timezone

  useEffect(() => {
    if (timezone && !selectedDate) {
      setSelectedDate(todayInSchoolTimezone(timezone))
    }
  }, [selectedDate, timezone])

  const range = useMemo(
    () => (timezone && selectedDate ? scheduleRangeForView({ date: selectedDate, timezone, view }) : null),
    [selectedDate, timezone, view],
  )
  const entriesQuery = useQuery({
    enabled: Boolean(range),
    queryKey: ['calendar', 'entries', { ...filter, rangeEnd: range?.endIso, rangeStart: range?.startIso }],
    queryFn: () => listScheduleEntries({
      ...filter,
      rangeEnd: range.endIso,
      rangeStart: range.startIso,
    }),
  })
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups })
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: listRooms })
  const trainersQuery = useQuery({ queryKey: ['trainers'], queryFn: listTrainers })
  const isAdmin = profile.role === 'admin'

  function invalidateCalendar() {
    return queryClient.invalidateQueries({ queryKey: ['calendar', 'entries'] })
  }

  const entryMutation = useMutation({
    mutationFn: ({ entry, values }) => (entry?.id
      ? updateScheduleEntry({ id: entry.id, values })
      : createScheduleEntry(values)),
    onSuccess: async () => {
      await invalidateCalendar()
      setEditingEntry(null)
    },
  })
  const cancelMutation = useMutation({
    mutationFn: cancelScheduleEntry,
    onSuccess: async () => {
      await invalidateCalendar()
      setSelectedEntry(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteScheduleEntry,
    onSuccess: async () => {
      await invalidateCalendar()
      setDeleteEntry(null)
      setSelectedEntry(null)
    },
  })
  const weeklyMutation = useMutation({
    mutationFn: createWeeklyScheduleEntries,
    onSuccess: async () => {
      await invalidateCalendar()
      setWeeklyDialogOpen(false)
    },
  })

  async function saveEntry(values) {
    const valuesToSave = entryPayload(values, timezone, profile.id)
    if (editingEntry?.id) {
      delete valuesToSave.created_by
    }
    await entryMutation.mutateAsync({ entry: editingEntry, values: valuesToSave })
  }

  async function saveWeeklyEntries(values) {
    if (values.end_time <= values.start_time) {
      throw new Error('End time must be after start time on the same date.')
    }

    await weeklyMutation.mutateAsync({
      first_date: values.first_date,
      last_date: values.last_date,
      target_end_time: values.end_time,
      target_entry_type: values.entry_type,
      target_group_id: values.group_id || null,
      target_is_extra: values.is_extra,
      target_iso_weekday: values.iso_weekday,
      target_notes: values.notes.trim() || null,
      target_room_id: values.room_id || null,
      target_start_time: values.start_time,
      target_title: values.title.trim(),
      target_trainer_id: values.trainer_id || null,
    })
  }

  function changeDate(direction) {
    setSelectedDate((current) => addSchoolDays(current, direction * (view === 'week' ? 7 : 1)))
  }

  function resetToday() {
    if (timezone) {
      setSelectedDate(todayInSchoolTimezone(timezone))
    }
  }

  if (schoolSettingsQuery.isLoading || !range) {
    return <AppShell title="Calendar"><LoadingState label="Loading calendar" /></AppShell>
  }

  if (schoolSettingsQuery.error) {
    return <AppShell title="Calendar"><ErrorState title="Unable to load calendar settings" /></AppShell>
  }

  const visibleEntries = entriesQuery.data ?? []
  const rangeLabel = view === 'day'
    ? formatSchoolDate(range.startIso, timezone, { weekday: 'long' })
    : `${formatSchoolDate(range.startIso, timezone, { day: 'numeric', month: 'short' })} – ${formatSchoolDate(addSchoolDays(range.endDate, -1) + 'T12:00:00Z', timezone, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const selectableGroups = groupsQuery.data?.filter((group) => group.active) ?? []
  const selectableRooms = roomsQuery.data?.filter((room) => room.active) ?? []
  const selectableTrainers = trainersQuery.data?.filter((trainer) => trainer.active) ?? []

  return (
    <AppShell title="Calendar">
      <section className="page-intro calendar-intro" aria-labelledby="calendar-title">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2 id="calendar-title">Calendar</h2>
          <p>{isAdmin ? 'Manage the studio schedule and concrete weekly classes.' : 'View your relevant schedule.'}</p>
        </div>
        {isAdmin && (
          <div className="calendar-intro__actions">
            <Button onClick={() => setEditingEntry({})}><Plus aria-hidden="true" size={18} />Add activity</Button>
            <Button onClick={() => setWeeklyDialogOpen(true)} variant="secondary">Create weekly class</Button>
          </div>
        )}
      </section>
      <section aria-label="Calendar navigation" className="calendar-controls">
        <div className="calendar-controls__views">
          <Button onClick={() => setView('day')} variant={view === 'day' ? 'primary' : 'tertiary'}>Day</Button>
          <Button onClick={() => setView('week')} variant={view === 'week' ? 'primary' : 'tertiary'}>Week</Button>
        </div>
        <div className="calendar-controls__dates">
          <Button aria-label="Previous period" onClick={() => changeDate(-1)} variant="tertiary"><ChevronLeft aria-hidden="true" size={20} /></Button>
          <Button onClick={resetToday} variant="secondary">Today</Button>
          <Button aria-label="Next period" onClick={() => changeDate(1)} variant="tertiary"><ChevronRight aria-hidden="true" size={20} /></Button>
        </div>
        <p className="calendar-controls__range" role="status">{rangeLabel}</p>
      </section>
      <section aria-label="Calendar filters" className="calendar-filters">
        <ResourceSelect id="calendar-filter-type" label="Type" register={{ onChange: (event) => setFilter((current) => ({ ...current, entryType: event.target.value })), value: filter.entryType }}>
          <option value="">All types</option>
          {scheduleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </ResourceSelect>
        <ResourceSelect id="calendar-filter-group" label="Group" register={{ onChange: (event) => setFilter((current) => ({ ...current, groupId: event.target.value })), value: filter.groupId }}>
          <option value="">All groups</option>
          {selectableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </ResourceSelect>
        <ResourceSelect id="calendar-filter-trainer" label="Trainer" register={{ onChange: (event) => setFilter((current) => ({ ...current, trainerId: event.target.value })), value: filter.trainerId }}>
          <option value="">All trainers</option>
          {selectableTrainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>)}
        </ResourceSelect>
        <ResourceSelect id="calendar-filter-room" label="Room" register={{ onChange: (event) => setFilter((current) => ({ ...current, roomId: event.target.value })), value: filter.roomId }}>
          <option value="">All rooms</option>
          {selectableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </ResourceSelect>
      </section>
      {entriesQuery.isLoading && <LoadingState label="Loading schedule entries" />}
      {entriesQuery.error && <ErrorState title="Unable to load schedule entries" />}
      {!entriesQuery.isLoading && !entriesQuery.error && visibleEntries.length === 0 && (
        <EmptyState description="There are no activities in this range with the selected filters." title="No scheduled activities" />
      )}
      {!entriesQuery.isLoading && !entriesQuery.error && visibleEntries.length > 0 && (
        view === 'day'
          ? <DayCalendar entries={visibleEntries} onEntryClick={setSelectedEntry} rooms={selectableRooms} timezone={timezone} />
          : <WeekCalendar entries={visibleEntries} onEntryClick={setSelectedEntry} range={range} selectedDate={selectedDate} setSelectedDate={setSelectedDate} timezone={timezone} />
      )}
      <Dialog
        footer={(
          <div className="form-actions">
            <Button disabled={entryMutation.isPending} form="calendar-entry-form" type="submit">
              {entryMutation.isPending ? 'Saving...' : 'Save activity'}
            </Button>
            <Button disabled={entryMutation.isPending} onClick={() => setEditingEntry(null)} variant="tertiary">Cancel</Button>
          </div>
        )}
        onClose={() => !entryMutation.isPending && setEditingEntry(null)}
        open={editingEntry !== null}
        scrollable
        title={editingEntry?.id ? 'Edit activity' : 'Add activity'}
      >
        <EntryForm
          entry={editingEntry}
          formId="calendar-entry-form"
          groups={selectableGroups}
          key={editingEntry?.id ?? 'new'}
          onSubmit={saveEntry}
          rooms={selectableRooms}
          selectedDate={selectedDate}
          timezone={timezone}
          trainers={selectableTrainers}
        />
      </Dialog>
      <Dialog
        footer={(
          <div className="form-actions">
            <Button disabled={weeklyMutation.isPending} form="weekly-calendar-entry-form" type="submit">
              {weeklyMutation.isPending ? 'Creating...' : 'Create weekly activities'}
            </Button>
            <Button disabled={weeklyMutation.isPending} onClick={() => setWeeklyDialogOpen(false)} variant="tertiary">Cancel</Button>
          </div>
        )}
        onClose={() => !weeklyMutation.isPending && setWeeklyDialogOpen(false)}
        open={weeklyDialogOpen}
        scrollable
        title="Create weekly class"
      >
        <WeeklyEntryForm
          formId="weekly-calendar-entry-form"
          groups={selectableGroups}
          onSubmit={saveWeeklyEntries}
          rooms={selectableRooms}
          selectedDate={selectedDate}
          trainers={selectableTrainers}
        />
      </Dialog>
      <Dialog onClose={() => setSelectedEntry(null)} open={selectedEntry !== null} title="Schedule activity">
        {selectedEntry && (
          <div className="entity-form">
            <div className="calendar-entry-details">
              <h3>{selectedEntry.title}</h3>
              <p>{formatSchoolDate(selectedEntry.starts_at, timezone, { weekday: 'long' })}</p>
              <p>{formatSchoolTime(selectedEntry.starts_at, timezone)}–{formatSchoolTime(selectedEntry.ends_at, timezone)}</p>
              <p>Type: {selectedEntry.entry_type}</p>
              <p>Group: {selectedEntry.group?.name || 'Not assigned'}</p>
              <p>Trainer: {selectedEntry.trainer ? `${selectedEntry.trainer.first_name} ${selectedEntry.trainer.last_name}` : 'Not assigned'}</p>
              <p>Room: {selectedEntry.room?.name || 'Not assigned'}</p>
              {selectedEntry.notes && <p>Notes: {selectedEntry.notes}</p>}
              {selectedEntry.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
            </div>
            {isAdmin && (
              <div className="form-actions">
                <Button onClick={() => { setEditingEntry(selectedEntry); setSelectedEntry(null) }} variant="secondary">Edit</Button>
                {selectedEntry.status !== 'cancelled' && (
                  <Button disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(selectedEntry.id)} variant="tertiary">
                    {cancelMutation.isPending ? 'Cancelling...' : 'Cancel activity'}
                  </Button>
                )}
                <Button onClick={() => { setDeleteEntry(selectedEntry); setSelectedEntry(null) }} variant="tertiary">Delete permanently</Button>
              </div>
            )}
            {cancelMutation.error && <p className="form-error" role="alert">{cancelMutation.error.message}</p>}
          </div>
        )}
      </Dialog>
      <Dialog onClose={() => !deleteMutation.isPending && setDeleteEntry(null)} open={deleteEntry !== null} title="Permanently delete activity">
        <div className="entity-form">
          <p className="form-error">This permanently removes the schedule entry. Any related attendance records created in a later milestone may also be removed by database cascade rules.</p>
          {deleteMutation.error && <p className="form-error" role="alert">{deleteMutation.error.message}</p>}
          <div className="form-actions">
            <Button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteEntry.id)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Permanently delete'}
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={() => setDeleteEntry(null)} variant="tertiary">Cancel</Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  )
}
