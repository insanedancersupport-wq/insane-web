import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import { todayInSchoolTimezone } from '../../utils/scheduleDateTime'
import { useAuth } from '../auth/AuthContext'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'
import { createTask, deleteTask, getEligibleTaskAssignees, getTasks, updateTask, updateTaskStatus } from './tasksApi'

const taskSchema = z.object({
  assigned_to: z.string().min(1, 'Select an assignee.'),
  description: z.string(),
  due_date: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'in_progress', 'done']),
  title: z.string().trim().min(1, 'Task title is required.'),
})

const emptyTask = {
  assigned_to: '',
  description: '',
  due_date: '',
  priority: 'medium',
  status: 'todo',
  title: '',
}

function profileName(profile) {
  return profile?.full_name || 'Unavailable user'
}

function taskPermissions(task, profile) {
  const isAdmin = profile.role === 'admin'
  const isAssignee = task.assigned_to === profile.id
  const isCreator = task.created_by === profile.id

  return {
    canDelete: isAdmin || isCreator,
    canEditDetails: isAdmin || isCreator,
    canEditStatus: isAdmin || isAssignee,
    canReassign: isAdmin,
  }
}

export function sortTasks(tasks, today) {
  return [...tasks].sort((left, right) => {
    const rank = (task) => {
      if (task.status === 'done') return 3
      if (task.due_date && task.due_date < today) return 0
      if (task.due_date) return 1
      return 2
    }
    const rankDifference = rank(left) - rank(right)
    if (rankDifference !== 0) return rankDifference
    if (left.due_date !== right.due_date) return (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31')
    return left.created_at.localeCompare(right.created_at)
  })
}

export function changedTaskValues(task, values, permissions) {
  const candidates = {
    ...(permissions.canEditDetails ? {
      description: values.description,
      due_date: values.due_date,
      priority: values.priority,
      title: values.title,
    } : {}),
    ...(permissions.canEditStatus ? { status: values.status } : {}),
    ...(permissions.canReassign ? { assigned_to: values.assigned_to } : {}),
  }

  return Object.fromEntries(
    Object.entries(candidates).filter(([key, value]) => (
      value !== (task[key] ?? '')
    )),
  )
}

function TaskForm({ assignees, canEditDetails, canEditStatus, canReassign, formId, onSubmit, profile, task }) {
  const defaults = task
    ? { ...task, description: task.description ?? '', due_date: task.due_date ?? '' }
    : { ...emptyTask, assigned_to: profile.id }
  const { formState: { errors }, handleSubmit, register } = useForm({
    defaultValues: defaults,
    resolver: zodResolver(taskSchema),
  })

  return (
    <form className="entity-form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Input disabled={!canEditDetails} label="Title" {...register('title')} />
      {errors.title && <p className="form-error" role="alert">{errors.title.message}</p>}
      <label className="field" htmlFor={`${formId}-description`}>
        <span className="field__label">Description</span>
        <textarea className="field__input field__textarea" disabled={!canEditDetails} id={`${formId}-description`} {...register('description')} />
      </label>
      <label className="field" htmlFor={`${formId}-assignee`}>
        <span className="field__label">Assigned to</span>
        <select className="field__input" disabled={!canReassign} id={`${formId}-assignee`} {...register('assigned_to')}>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{profileName(assignee)}</option>)}
        </select>
      </label>
      <Input disabled={!canEditDetails} label="Due date" type="date" {...register('due_date')} />
      <label className="field" htmlFor={`${formId}-priority`}>
        <span className="field__label">Priority</span>
        <select className="field__input" disabled={!canEditDetails} id={`${formId}-priority`} {...register('priority')}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="field" htmlFor={`${formId}-status`}>
        <span className="field__label">Status</span>
        <select className="field__input" disabled={!canEditStatus} id={`${formId}-status`} {...register('status')}>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </label>
    </form>
  )
}

export function TasksPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editingTask, setEditingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [filters, setFilters] = useState({ assignedTo: 'all', priority: 'all', status: 'all' })
  const [message, setMessage] = useState('')
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const assigneesQuery = useQuery({ queryKey: ['task-assignees'], queryFn: getEligibleTaskAssignees })
  const schoolSettingsQuery = useQuery({ queryKey: ['school-settings', 'authoritative'], queryFn: getAuthoritativeSchoolSettings })
  const today = schoolSettingsQuery.data ? todayInSchoolTimezone(schoolSettingsQuery.data.timezone) : ''

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  const saveMutation = useMutation({
    mutationFn: ({ id, values }) => id ? updateTask({ id, values }) : createTask(values),
    onSuccess: async (_, { id }) => {
      await invalidateTasks()
      setEditingTask(null)
      setMessage(id ? 'Task updated.' : 'Task created.')
    },
  })
  const statusMutation = useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: async () => {
      await invalidateTasks()
      setMessage('Task status updated.')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await invalidateTasks()
      setDeletingTask(null)
      setMessage('Task deleted.')
    },
  })

  const visibleTasks = useMemo(() => {
    const filtered = (tasksQuery.data ?? []).filter((task) => (
      (filters.status === 'all' || task.status === filters.status)
      && (filters.priority === 'all' || task.priority === filters.priority)
      && (filters.assignedTo === 'all' || task.assigned_to === filters.assignedTo)
    ))
    return sortTasks(filtered, today)
  }, [filters, tasksQuery.data, today])
  const counts = (tasksQuery.data ?? []).reduce((current, task) => ({
    active: current.active + (task.status !== 'done' ? 1 : 0),
    completed: current.completed + (task.status === 'done' ? 1 : 0),
    overdue: current.overdue + (task.status !== 'done' && task.due_date && task.due_date < today ? 1 : 0),
  }), { active: 0, completed: 0, overdue: 0 })
  const editingPermissions = editingTask?.id ? taskPermissions(editingTask, profile) : {
    canEditDetails: true,
    canEditStatus: true,
    canReassign: profile.role === 'admin',
  }
  const assignees = profile.role === 'admin'
    ? assigneesQuery.data ?? []
    : (assigneesQuery.data ?? []).filter((assignee) => assignee.id === profile.id)

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function saveTask(values) {
    const permissions = editingTask?.id ? taskPermissions(editingTask, profile) : editingPermissions
    const allowedValues = editingTask?.id
      ? changedTaskValues(editingTask, values, permissions)
      : {
        assigned_to: profile.role === 'admin' ? values.assigned_to : profile.id,
        description: values.description,
        due_date: values.due_date,
        priority: values.priority,
        status: values.status,
        title: values.title,
      }

    if (editingTask?.id && Object.keys(allowedValues).length === 0) {
      setEditingTask(null)
      setMessage('No changes to save.')
      return
    }

    saveMutation.mutate({ id: editingTask?.id, values: allowedValues })
  }

  return (
    <AppShell title="Tasks">
      <section className="page-intro" aria-labelledby="tasks-title">
        <p className="eyebrow">Collaboration</p>
        <h2 id="tasks-title">Tasks</h2>
        <p>Track work assigned across the school team.</p>
      </section>
      <Button onClick={() => { setMessage(''); setEditingTask({}) }}>+ New Task</Button>
      {message && <p className="success-message" role="status">{message}</p>}
      {(saveMutation.error || statusMutation.error || deleteMutation.error) && <p className="form-error" role="alert">{(saveMutation.error || statusMutation.error || deleteMutation.error).message}</p>}
      {tasksQuery.isLoading || schoolSettingsQuery.isLoading ? <LoadingState label="Loading tasks" /> : null}
      {tasksQuery.error || schoolSettingsQuery.error ? <ErrorState title="Unable to load tasks" /> : null}
      {!tasksQuery.isLoading && !tasksQuery.error && schoolSettingsQuery.data && (
        <>
          <section aria-label="Task summary" className="task-summary">
            <Card><strong>{counts.active}</strong><span>Active tasks</span></Card>
            <Card><strong>{counts.completed}</strong><span>Completed tasks</span></Card>
            <Card><strong>{counts.overdue}</strong><span>Overdue tasks</span></Card>
          </section>
          <section aria-label="Task filters" className="list-filters">
            <label className="field" htmlFor="task-status-filter"><span className="field__label">Status</span><select className="field__input" id="task-status-filter" onChange={(event) => updateFilter('status', event.target.value)} value={filters.status}><option value="all">All statuses</option><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option></select></label>
            <label className="field" htmlFor="task-priority-filter"><span className="field__label">Priority</span><select className="field__input" id="task-priority-filter" onChange={(event) => updateFilter('priority', event.target.value)} value={filters.priority}><option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label className="field" htmlFor="task-assignee-filter"><span className="field__label">Assigned user</span><select className="field__input" id="task-assignee-filter" onChange={(event) => updateFilter('assignedTo', event.target.value)} value={filters.assignedTo}><option value="all">All visible users</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{profileName(assignee)}</option>)}</select></label>
          </section>
          {tasksQuery.data?.length === 0 && <EmptyState description="Create a task to start collaborating." title="No tasks yet" />}
          {tasksQuery.data?.length > 0 && visibleTasks.length === 0 && <EmptyState description="Adjust the filters to see matching tasks." title="No matching tasks" />}
          <section aria-label="Tasks" className="entity-list">
            {visibleTasks.map((task) => {
              const permissions = taskPermissions(task, profile)
              const isUpdatingStatus = statusMutation.isPending && statusMutation.variables?.id === task.id
              return (
                <Card className="task-card" key={task.id}>
                  <div className="task-card__content">
                    <div><h3>{task.title}</h3><Badge tone={`task-${task.priority}`}>{task.priority}</Badge></div>
                    {task.description && <p>{task.description}</p>}
                    <p>Assigned to: {profileName(task.assigned)}</p>
                    <p>Created by: {profileName(task.creator)}</p>
                    <p>Due: {task.due_date ?? 'No due date'}</p>
                  </div>
                  <div className="task-card__actions">
                    {permissions.canEditStatus ? (
                      <label className="field" htmlFor={`task-status-${task.id}`}><span className="field__label">Status</span><select className="field__input" disabled={isUpdatingStatus} id={`task-status-${task.id}`} onChange={(event) => statusMutation.mutate({ id: task.id, status: event.target.value })} value={task.status}><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option></select></label>
                    ) : <Badge>{task.status.replace('_', ' ')}</Badge>}
                    {(permissions.canEditDetails || permissions.canEditStatus || permissions.canReassign) && <Button onClick={() => { setMessage(''); setEditingTask(task) }} variant="secondary">Edit</Button>}
                    {permissions.canDelete && <Button onClick={() => setDeletingTask(task)} variant="tertiary">Delete</Button>}
                  </div>
                </Card>
              )
            })}
          </section>
        </>
      )}
      <Dialog
        footer={<div className="form-actions"><Button disabled={saveMutation.isPending} form="task-form" type="submit">{saveMutation.isPending ? 'Saving...' : 'Save task'}</Button><Button disabled={saveMutation.isPending} onClick={() => setEditingTask(null)} variant="tertiary">Cancel</Button></div>}
        onClose={() => !saveMutation.isPending && setEditingTask(null)}
        open={editingTask !== null}
        scrollable
        title={editingTask?.id ? 'Edit task' : 'New task'}
      >
        {assigneesQuery.isLoading ? <LoadingState label="Loading assignees" /> : <TaskForm assignees={assignees} canEditDetails={editingPermissions.canEditDetails} canEditStatus={editingPermissions.canEditStatus} canReassign={editingPermissions.canReassign} formId="task-form" key={editingTask?.id ?? 'new'} onSubmit={saveTask} profile={profile} task={editingTask?.id ? editingTask : null} />}
      </Dialog>
      <Dialog footer={<div className="form-actions"><Button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingTask.id)}>{deleteMutation.isPending ? 'Deleting...' : 'Delete task'}</Button><Button disabled={deleteMutation.isPending} onClick={() => setDeletingTask(null)} variant="tertiary">Cancel</Button></div>} onClose={() => !deleteMutation.isPending && setDeletingTask(null)} open={deletingTask !== null} title="Delete task">
        <p>Delete “{deletingTask?.title}”? This cannot be undone.</p>
      </Dialog>
    </AppShell>
  )
}
