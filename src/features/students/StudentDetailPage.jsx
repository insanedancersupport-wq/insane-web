import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import { deleteStudent, getStudent, listStudentGroups } from './studentsApi'

export function StudentDetailPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { studentId } = useParams()
  const queryClient = useQueryClient()
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const studentQuery = useQuery({ queryKey: ['students', studentId], queryFn: () => getStudent(studentId) })
  const membershipsQuery = useQuery({
    queryKey: ['student-groups', studentId],
    queryFn: () => listStudentGroups(studentId),
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: listGroups,
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteStudent(studentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['students-with-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['student-groups', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['groups-with-details'] }),
      ])
      navigate('/app/students', {
        state: { message: 'Student permanently deleted.' },
      })
    },
  })

  if (studentQuery.isLoading) {
    return <AppShell title="Student"><LoadingState label="Loading student" /></AppShell>
  }

  if (studentQuery.error) {
    return <AppShell title="Student"><ErrorState title="Unable to load student" /></AppShell>
  }

  const student = studentQuery.data
  const groupsById = new Map(groupsQuery.data?.map((group) => [group.id, group]))
  const isAdmin = profile.role === 'admin'

  function closeDeleteDialog() {
    if (!deleteMutation.isPending) {
      setDeleteDialogOpen(false)
      setDeleteConfirmation('')
    }
  }

  function confirmDelete(event) {
    event.preventDefault()
    if (deleteConfirmation === 'DELETE') {
      deleteMutation.mutate()
    }
  }

  return (
    <AppShell title="Student details">
      <Link className="back-link" to="/app/students">Back to students</Link>
      <section className="page-intro" aria-labelledby="student-detail-title">
        <p className="eyebrow">Student</p>
        <h2 id="student-detail-title">{student.first_name} {student.last_name}</h2>
        <p>{student.notes || 'No notes provided.'}</p>
      </section>
      <Card className="detail-card">
        <h3>Student information</h3>
        <dl className="detail-list">
          <div><dt>Status</dt><dd><Badge tone={student.status === 'active' ? 'success' : student.status === 'trial' ? 'warning' : 'danger'}>{student.status}</Badge></dd></div>
          <div><dt>Email</dt><dd>{student.email || 'Not set'}</dd></div>
          <div><dt>Phone</dt><dd>{student.phone || 'Not set'}</dd></div>
          <div><dt>Birth date</dt><dd>{student.birth_date || 'Not set'}</dd></div>
        </dl>
      </Card>
      {isAdmin && (
        <Card className="detail-card">
          <h3>Permanent deletion</h3>
          <p>Delete this student only when the record must be permanently removed.</p>
          <Button onClick={() => setDeleteDialogOpen(true)} variant="tertiary">Permanently delete student</Button>
        </Card>
      )}
      {membershipsQuery.isLoading && <LoadingState label="Loading group memberships" />}
      {membershipsQuery.error && <ErrorState title="Unable to load group memberships" />}
      {groupsQuery.error && <ErrorState title="Unable to load groups" />}
      {membershipsQuery.data && groupsQuery.data && (
        <Card className="detail-card">
          <h3>Current groups</h3>
          {membershipsQuery.data.length === 0 ? (
            <p>This student is not assigned to any groups.</p>
          ) : (
            <ul className="assigned-trainer-list">
              {membershipsQuery.data.map((membership) => (
                <li key={membership.group_id}>{groupsById.get(membership.group_id)?.name || 'Unavailable group'}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Dialog
        onClose={closeDeleteDialog}
        open={deleteDialogOpen}
        title="Permanently delete student"
      >
        <form className="entity-form" onSubmit={confirmDelete}>
          <p className="form-error">
            This cannot be undone. Related memberships and attendance records affected by database cascade rules may also be permanently removed.
          </p>
          <Input
            label='Type DELETE to confirm'
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            value={deleteConfirmation}
          />
          {deleteMutation.error && <p className="form-error" role="alert">{deleteMutation.error.message}</p>}
          <div className="form-actions">
            <Button disabled={deleteConfirmation !== 'DELETE' || deleteMutation.isPending} type="submit">
              {deleteMutation.isPending ? 'Deleting...' : 'Permanently delete'}
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={closeDeleteDialog} variant="tertiary">Cancel</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  )
}
