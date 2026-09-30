import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { AppShell } from '../../components/layout/AppShell'
import { useAuth } from '../auth/AuthContext'
import { listUsers, manageUser } from './usersApi'

export function UsersPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('trainer')
  const { data: users, error: usersError, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })
  const mutation = useMutation({
    mutationFn: manageUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  async function runAction(payload) {
    setError('')

    try {
      await mutation.mutateAsync(payload)
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function handleInvite(event) {
    event.preventDefault()
    await runAction({ action: 'invite', email, fullName, role })
    setEmail('')
    setFullName('')
    setRole('trainer')
  }

  function handleDelete(user) {
    if (window.confirm(`Permanently delete ${user.full_name}'s account?`)) {
      void runAction({ action: 'delete', userId: user.id })
    }
  }

  return (
    <AppShell title="Users">
      <section className="page-intro" aria-labelledby="users-title">
        <p className="eyebrow">Administration</p>
        <h2 id="users-title">Application users</h2>
        <p>Invite accounts and manage their roles or access status.</p>
      </section>

      <Card className="users-card">
        <h3>Invite user</h3>
        <form className="users-invite-form" onSubmit={handleInvite}>
          <Input
            autoComplete="name"
            label="Full name"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
          <Input
            autoComplete="email"
            label="Email address"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label className="field" htmlFor="user-role">
            <span className="field__label">Role</span>
            <select
              className="field__input"
              id="user-role"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option value="trainer">Trainer</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Sending invitation...' : 'Send invitation'}
          </Button>
        </form>
      </Card>

      {error && <p className="users-error" role="alert">{error}</p>}
      {isLoading && <LoadingState label="Loading users" />}
      {usersError && <ErrorState description="Users could not be loaded." title="Unable to load users" />}
      {users && (
        <section aria-label="Application users" className="users-list">
          {users.map((user) => {
            const isCurrentUser = user.id === profile.id

            return (
              <Card className="user-row" key={user.id}>
                <div>
                  <h3>{user.full_name}</h3>
                  <div className="user-row__badges">
                    <Badge tone={user.role === 'admin' ? 'warning' : 'default'}>{user.role}</Badge>
                    <Badge tone={user.active ? 'success' : 'danger'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="user-row__actions">
                  <Button
                    disabled={isCurrentUser || mutation.isPending}
                    onClick={() => void runAction({
                      action: 'update',
                      role: user.role === 'admin' ? 'trainer' : 'admin',
                      userId: user.id,
                    })}
                    variant="tertiary"
                  >
                    Make {user.role === 'admin' ? 'trainer' : 'admin'}
                  </Button>
                  <Button
                    disabled={isCurrentUser || mutation.isPending}
                    onClick={() => void runAction({
                      action: 'set-active',
                      active: !user.active,
                      userId: user.id,
                    })}
                    variant="secondary"
                  >
                    {user.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    disabled={isCurrentUser || mutation.isPending}
                    onClick={() => handleDelete(user)}
                    variant="tertiary"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            )
          })}
        </section>
      )}
    </AppShell>
  )
}
