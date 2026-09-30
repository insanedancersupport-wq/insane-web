import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
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
import { createStudent, listStudents, updateStudent } from './studentsApi'

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

function StudentForm({ onCancel, onSubmit, saving, student }) {
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: student
      ? { ...student, birth_date: student.birth_date ?? '' }
      : emptyStudent,
    resolver: zodResolver(studentSchema),
  })

  return (
    <form className="entity-form" onSubmit={handleSubmit((values) => onSubmit({
      ...values,
      birth_date: values.birth_date || null,
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
      <div className="form-actions">
        <Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save student'}</Button>
        <Button disabled={saving} onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </form>
  )
}

export function StudentsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editingStudent, setEditingStudent] = useState(null)
  const [error, setError] = useState('')
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: listStudents })
  const mutation = useMutation({
    mutationFn: (values) => (editingStudent?.id
      ? updateStudent({ id: editingStudent.id, values })
      : createStudent(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setEditingStudent(null)
    },
  })
  const isAdmin = profile.role === 'admin'

  async function saveStudent(values) {
    setError('')
    try {
      await mutation.mutateAsync(values)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <AppShell title="Students">
      <section className="page-intro" aria-labelledby="students-title">
        <p className="eyebrow">Training</p>
        <h2 id="students-title">Students</h2>
        <p>{isAdmin ? 'Maintain student records and current group memberships.' : 'View students in your assigned groups.'}</p>
      </section>
      {isAdmin && <Button onClick={() => setEditingStudent({})}>Add student</Button>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {studentsQuery.isLoading && <LoadingState label="Loading students" />}
      {studentsQuery.error && <ErrorState title="Unable to load students" />}
      {studentsQuery.data?.length === 0 && <EmptyState description="No students are available to your account." title="No students yet" />}
      <section aria-label="Students" className="entity-list">
        {studentsQuery.data?.map((student) => (
          <Card className="entity-row" key={student.id}>
            <div>
              <h3>{student.first_name} {student.last_name}</h3>
              <p>{student.email || student.phone || 'No contact details'}</p>
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
          <StudentForm
            onCancel={() => setEditingStudent(null)}
            onSubmit={saveStudent}
            saving={mutation.isPending}
            student={editingStudent?.id ? editingStudent : null}
          />
        </Dialog>
      )}
    </AppShell>
  )
}
