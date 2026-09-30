import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/layout/AppShell'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'
import { getStudent, listStudentGroups, reconcileStudentGroups } from './studentsApi'

function GroupMemberships({ groups, memberships, studentId }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const mutation = useMutation({
    mutationFn: reconcileStudentGroups,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-groups', studentId] }),
  })

  useEffect(() => {
    setSelectedIds(memberships.map((membership) => membership.group_id))
  }, [memberships])

  function toggleGroup(groupId) {
    setSelectedIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ))
  }

  async function saveMemberships(event) {
    event.preventDefault()
    setError('')
    try {
      await mutation.mutateAsync({ groupIds: selectedIds, studentId })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <Card className="detail-card">
      <h3>Current group memberships</h3>
      <p>Removing a group deletes the current membership. Historical membership is not recorded here.</p>
      <form className="entity-form" onSubmit={saveMemberships}>
        <fieldset className="assignment-list">
          <legend>Groups</legend>
          {groups.filter((group) => group.active).map((group) => (
            <label className="assignment-option" key={group.id}>
              <input
                checked={selectedIds.includes(group.id)}
                onChange={() => toggleGroup(group.id)}
                type="checkbox"
              />
              {group.name}
            </label>
          ))}
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? 'Saving memberships...' : 'Save group memberships'}
        </Button>
      </form>
    </Card>
  )
}

export function StudentDetailPage() {
  const { profile } = useAuth()
  const { studentId } = useParams()
  const studentQuery = useQuery({ queryKey: ['students', studentId], queryFn: () => getStudent(studentId) })
  const membershipsQuery = useQuery({
    enabled: profile.role === 'admin',
    queryKey: ['student-groups', studentId],
    queryFn: () => listStudentGroups(studentId),
  })
  const groupsQuery = useQuery({
    enabled: profile.role === 'admin',
    queryKey: ['groups'],
    queryFn: listGroups,
  })

  if (studentQuery.isLoading) {
    return <AppShell title="Student"><LoadingState label="Loading student" /></AppShell>
  }

  if (studentQuery.error) {
    return <AppShell title="Student"><ErrorState title="Unable to load student" /></AppShell>
  }

  const student = studentQuery.data
  const isAdmin = profile.role === 'admin'

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
      {isAdmin && membershipsQuery.isLoading && <LoadingState label="Loading group memberships" />}
      {isAdmin && membershipsQuery.error && <ErrorState title="Unable to load group memberships" />}
      {isAdmin && groupsQuery.error && <ErrorState title="Unable to load groups" />}
      {isAdmin && membershipsQuery.data && groupsQuery.data && (
        <GroupMemberships groups={groupsQuery.data} memberships={membershipsQuery.data} studentId={studentId} />
      )}
    </AppShell>
  )
}
