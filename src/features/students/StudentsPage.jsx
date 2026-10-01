import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
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
import { useAuth } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import {
  createStudent,
  listStudentGroups,
  listStudentsWithGroups,
  reconcileStudentGroups,
  updateStudent,
} from './studentsApi'

const studentSchema = z.object({
  birth_date: z.string(),
  email: z.string().email('Enter a valid email address.').or(z.literal('')),
  first_name: z.string().trim().min(1, 'First name is required.'),
  last_name: z.string().trim().min(1, 'Last name is required.'),
  notes: z.string(),
  phone: z.string(),
  status: z.enum(['active', 'trial', 'inactive']),
})

const emptyStudent = {
  birth_date: '',
  email: '',
  first_name: '',
  last_name: '',
  notes: '',
  phone: '',
  status: 'active',
}

function StudentForm({ groups, memberships, onCancel, onSubmit, saving, student }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: student
      ? { ...student, birth_date: student.birth_date ?? '' }
      : emptyStudent,
    resolver: zodResolver(studentSchema),
  })
  const [selectedGroupIds, setSelectedGroupIds] = useState([])

  useEffect(() => {
    setSelectedGroupIds(memberships.map((membership) => membership.group_id))
  }, [memberships, student?.id])

  function toggleGroup(groupId) {
    setSelectedGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ))
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit((values) => onSubmit({
      groupIds: selectedGroupIds,
      values: {
        ...values,
        birth_date: values.birth_date || null,
      },
    }))}>
      <Input label="First name" {...register('first_name')} />
      {errors.first_name && <p className="form-error" role="alert">{errors.first_name.message}</p>}
      <Input label="Last name" {...register('last_name')} />
      {errors.last_name && <p className="form-error" role="alert">{errors.last_name.message}</p>}
      <Input label="Phone" type="tel" {...register('phone')} />
      <Input label="Email" type="email" {...register('email')} />
      {errors.email && <p className="form-error" role="alert">{errors.email.message}</p>}
      <Input label="Birth date" type="date" {...register('birth_date')} />
      <label className="field" htmlFor="student-status">
        <span className="field__label">Status</span>
        <select className="field__input" id="student-status" {...register('status')}>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="field" htmlFor="student-notes">
        <span className="field__label">Notes</span>
        <textarea className="field__input field__textarea" id="student-notes" {...register('notes')} />
      </label>
      <fieldset className="assignment-list">
        <legend>Current groups</legend>
        {groups.filter((group) => group.active).map((group) => (
          <label className="assignment-option" key={group.id}>
            <input
              checked={selectedGroupIds.includes(group.id)}
              onChange={() => toggleGroup(group.id)}
              type="checkbox"
            />
            {group.name}
          </label>
        ))}
      </fieldset>
      <div className="form-actions">
        <Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save student'}</Button>
        <Button disabled={saving} onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </form>
  )
}

export function StudentsPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [editingStudent, setEditingStudent] = useState(null)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const studentsQuery = useQuery({ queryKey: ['students-with-groups'], queryFn: listStudentsWithGroups })
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups })
  const membershipsQuery = useQuery({
    enabled: Boolean(editingStudent?.id),
    queryKey: ['student-groups', editingStudent?.id],
    queryFn: () => listStudentGroups(editingStudent.id),
  })
  const mutation = useMutation({
    mutationFn: async ({ groupIds, values }) => {
      let studentId
      let scalarSaveCompleted = false

      try {
        studentId = editingStudent?.id
          ? editingStudent.id
          : (await createStudent(values)).id

        if (editingStudent?.id) {
          await updateStudent({ id: studentId, values })
        }

        scalarSaveCompleted = true
        await reconcileStudentGroups({ groupIds, studentId })
        return studentId
      } catch (saveError) {
        if (scalarSaveCompleted) {
          const reconciliationError = new Error(
            'Student details were saved, but group memberships could not be saved. Edit the student to retry the memberships.',
          )
          reconciliationError.entitySaved = true
          throw reconciliationError
        }

        throw saveError
      }
    },
    onSuccess: (studentId) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['students-with-groups'] })
      queryClient.invalidateQueries({ queryKey: ['student-groups', studentId] })
      queryClient.invalidateQueries({ queryKey: ['groups-with-details'] })
      setEditingStudent(null)
    },
  })

  async function saveStudent(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      if (saveError.entitySaved) {
        await queryClient.invalidateQueries({ queryKey: ['students'] })
        await queryClient.invalidateQueries({ queryKey: ['students-with-groups'] })
        await queryClient.invalidateQueries({ queryKey: ['groups-with-details'] })
        setEditingStudent(null)
      }
      setError(saveError.message)
    }
  }

  const filteredStudents = studentsQuery.data?.filter((student) => {
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter
    const matchesGroup = groupFilter === 'all'
      || student.student_groups?.some((membership) => membership.group?.id === groupFilter)

    return matchesStatus && matchesGroup
  }) ?? []
  const isAdmin = profile.role === 'admin'

  return (
    <AppShell title="Students">
      <section className="page-intro" aria-labelledby="students-title">
        <p className="eyebrow">Training</p>
        <h2 id="students-title">Students</h2>
        <p>{isAdmin ? 'Maintain student records and current group memberships.' : 'View students in your assigned groups.'}</p>
      </section>
      {isAdmin && <Button onClick={() => setEditingStudent({})}>Add student</Button>}
      {location.state?.message && <p className="success-message" role="status">{location.state.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {studentsQuery.isLoading && <LoadingState label="Loading students" />}
      {studentsQuery.error && <ErrorState title="Unable to load students" />}
      {studentsQuery.data?.length === 0 && <EmptyState description="No students are available to your account." title="No students yet" />}
      {studentsQuery.data?.length > 0 && (
        <section aria-label="Student filters" className="list-filters">
          <label className="field" htmlFor="student-status-filter">
            <span className="field__label">Status</span>
            <select
              className="field__input"
              id="student-status-filter"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="field" htmlFor="student-group-filter">
            <span className="field__label">Group</span>
            <select
              className="field__input"
              id="student-group-filter"
              onChange={(event) => setGroupFilter(event.target.value)}
              value={groupFilter}
            >
              <option value="all">All groups</option>
              {groupsQuery.data?.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
        </section>
      )}
      <section aria-label="Students" className="entity-list">
        {studentsQuery.data?.length > 0 && filteredStudents.length === 0 && (
          <EmptyState description="Adjust the status or group filters to see students." title="No matching students" />
        )}
        {filteredStudents.map((student) => (
          <Card className="entity-row" key={student.id}>
            <div>
              <h3>{student.first_name} {student.last_name}</h3>
              <p>{student.email || student.phone || 'No contact details'}</p>
              <p>
                Groups: {student.student_groups?.map((membership) => membership.group?.name)
                  .filter(Boolean)
                  .join(', ') || 'No current groups'}
              </p>
              <Badge tone={student.status === 'active' ? 'success' : student.status === 'trial' ? 'warning' : 'danger'}>
                {student.status}
              </Badge>
            </div>
            <div className="entity-row__actions">
              <Link className="button button--tertiary" to={`/app/students/${student.id}`}>View details</Link>
              {isAdmin && <Button onClick={() => setEditingStudent(student)} variant="secondary">Edit</Button>}
            </div>
          </Card>
        ))}
      </section>
      {isAdmin && (
        <Dialog
          onClose={() => !mutation.isPending && setEditingStudent(null)}
          open={editingStudent !== null}
          title={editingStudent?.id ? 'Edit student' : 'Add student'}
        >
          {editingStudent?.id && membershipsQuery.isLoading && <LoadingState label="Loading group memberships" />}
          {editingStudent?.id && membershipsQuery.error && <ErrorState title="Unable to load group memberships" />}
          {groupsQuery.error && <ErrorState title="Unable to load groups" />}
          {(!editingStudent?.id || membershipsQuery.data) && !groupsQuery.error && (
            <StudentForm
              groups={groupsQuery.data ?? []}
              memberships={membershipsQuery.data ?? []}
              onCancel={() => setEditingStudent(null)}
              onSubmit={saveStudent}
              saving={mutation.isPending}
              student={editingStudent?.id ? editingStudent : null}
            />
          )}
        </Dialog>
      )}
    </AppShell>
  )
}
