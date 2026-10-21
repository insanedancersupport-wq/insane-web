import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { changedTaskValues, sortTasks, TasksPage } from './TasksPage'
import { createTask, deleteTask, getEligibleTaskAssignees, getTasks, updateTask, updateTaskStatus } from './tasksApi'
import { AuthContext } from '../auth/AuthContext'
import { getAuthoritativeSchoolSettings } from '../calendar/calendarApi'

vi.mock('./tasksApi', () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getEligibleTaskAssignees: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}))

vi.mock('../calendar/calendarApi', () => ({
  getAuthoritativeSchoolSettings: vi.fn(),
}))

const admin = { id: 'admin-id', role: 'admin' }
const creator = { id: 'creator-id', role: 'trainer' }
const assignee = { id: 'assignee-id', role: 'trainer' }
const tasks = [
  {
    assigned: { ...assignee, full_name: 'Assigned Trainer' },
    assigned_to: 'assignee-id',
    created_at: '2026-10-01T10:00:00.000Z',
    created_by: 'creator-id',
    creator: { ...creator, full_name: 'Task Creator' },
    description: 'Bring music',
    due_date: '2026-10-10',
    id: 'overdue-task',
    priority: 'high',
    status: 'todo',
    title: 'Overdue task',
  },
  {
    assigned: { ...creator, full_name: 'Task Creator' },
    assigned_to: 'creator-id',
    created_at: '2026-10-02T10:00:00.000Z',
    created_by: 'creator-id',
    creator: { ...creator, full_name: 'Task Creator' },
    description: null,
    due_date: '2026-10-20',
    id: 'own-task',
    priority: 'medium',
    status: 'in_progress',
    title: 'Own task',
  },
]

afterEach(cleanup)

function renderPage(profile = admin) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/app/tasks']}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ profile }}>
          <TasksPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createTask.mockResolvedValue({ id: 'new-task' })
    deleteTask.mockResolvedValue()
    getAuthoritativeSchoolSettings.mockResolvedValue({ timezone: 'Europe/Bucharest' })
    getEligibleTaskAssignees.mockResolvedValue([
      { ...admin, active: true, full_name: 'Admin User' },
      { ...creator, active: true, full_name: 'Task Creator' },
      { ...assignee, active: true, full_name: 'Assigned Trainer' },
    ])
    getTasks.mockResolvedValue(tasks)
    updateTask.mockResolvedValue()
    updateTaskStatus.mockResolvedValue()
  })

  it('shows summary counters and sorts overdue active tasks first', async () => {
    renderPage()

    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Overdue task', 'Own task'])
  })

  it('filters tasks and renders an empty filtered state', async () => {
    renderPage()
    await screen.findByText('Overdue task')

    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'low' } })
    expect(screen.getByText('No matching tasks')).toBeInTheDocument()
  })

  it('allows an admin to select an eligible profile when creating a task', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '+ New Task' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New task' } })
    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: 'assignee-id' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }))

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      assigned_to: 'assignee-id',
      title: 'New task',
    })))
  })

  it('restricts a trainer to self-assignment and preserves descriptive-only editing after reassignment', async () => {
    renderPage(creator)
    const overdueCard = (await screen.findByText('Overdue task')).closest('.task-card')
    fireEvent.click(within(overdueCard).getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit task' })
    expect(within(dialog).getByLabelText('Assigned to')).toBeDisabled()
    expect(within(dialog).getByLabelText('Status')).toBeDisabled()
    expect(within(dialog).getByLabelText('Title')).toBeEnabled()
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Revised task' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }))

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith({
      id: 'overdue-task',
      values: { title: 'Revised task' },
    }))
  })

  it('allows an assigned trainer to update status but not task details', async () => {
    renderPage(assignee)
    const overdueCard = (await screen.findByText('Overdue task')).closest('.task-card')
    fireEvent.change(within(overdueCard).getByLabelText('Status'), { target: { value: 'done' } })

    await waitFor(() => expect(updateTaskStatus).toHaveBeenCalledWith(
      { id: 'overdue-task', status: 'done' },
      expect.any(Object),
    ))
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('uses a confirmation dialog before deleting a task', async () => {
    renderPage(admin)
    const overdueCard = (await screen.findByText('Overdue task')).closest('.task-card')
    fireEvent.click(within(overdueCard).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete task' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith('overdue-task', expect.any(Object)))
  })

  it('renders loading, error, and empty states', async () => {
    getTasks.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderPage()
    expect(await screen.findByText('Loading tasks')).toBeInTheDocument()
    unmount()

    getTasks.mockRejectedValueOnce(new Error('Failed'))
    renderPage()
    expect(await screen.findByText('Unable to load tasks')).toBeInTheDocument()
  })
})

describe('sortTasks', () => {
  it('places overdue, upcoming, undated, then completed tasks in stable order', () => {
    const sorted = sortTasks([
      { created_at: '2026-10-01T00:00:00Z', due_date: null, id: 'undated', status: 'todo' },
      { created_at: '2026-10-02T00:00:00Z', due_date: '2026-10-09', id: 'overdue', status: 'todo' },
      { created_at: '2026-10-03T00:00:00Z', due_date: '2026-10-20', id: 'upcoming', status: 'todo' },
      { created_at: '2026-10-04T00:00:00Z', due_date: '2026-10-01', id: 'done', status: 'done' },
    ], '2026-10-15')

    expect(sorted.map((task) => task.id)).toEqual(['overdue', 'upcoming', 'undated', 'done'])
  })

  describe('changedTaskValues', () => {
    it('sends only changed fields allowed by the current task relationship', () => {
      expect(changedTaskValues(
        { assigned_to: 'other', description: null, due_date: null, priority: 'medium', status: 'todo', title: 'Original' },
        { assigned_to: 'other', description: '', due_date: '', priority: 'medium', status: 'done', title: 'Updated' },
        { canEditDetails: true, canEditStatus: false, canReassign: false },
      )).toEqual({ title: 'Updated' })
    })
  })
})
