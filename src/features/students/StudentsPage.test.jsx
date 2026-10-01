import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StudentDetailPage } from './StudentDetailPage'
import { StudentsPage } from './StudentsPage'
import {
  createStudent,
  deleteStudent,
  getStudent,
  listStudentGroups,
  listStudentsWithGroups,
  reconcileStudentGroups,
  updateStudent,
} from './studentsApi'
import { AuthContext } from '../auth/AuthContext'
import { listGroups } from '../groups/groupsApi'

vi.mock('./studentsApi', () => ({
  createStudent: vi.fn(),
  deleteStudent: vi.fn(),
  getStudent: vi.fn(),
  listStudentGroups: vi.fn(),
  listStudentsWithGroups: vi.fn(),
  reconcileStudentGroups: vi.fn(),
  updateStudent: vi.fn(),
}))

vi.mock('../groups/groupsApi', () => ({
  listGroups: vi.fn(),
}))

const groups = [
  { active: true, id: 'group-a', name: 'Junior Crew' },
  { active: true, id: 'group-b', name: 'Senior Crew' },
]

afterEach(cleanup)

function renderWithQueryClient(children, initialEntries = ['/app/students'], role = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ profile: { role } }}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

function renderStudentsPage() {
  return renderWithQueryClient(<StudentsPage />)
}

function enterStudentDetails() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Dance' } })
}

describe('StudentsPage group memberships', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createStudent.mockResolvedValue({ id: 'new-student-id' })
    deleteStudent.mockResolvedValue({ id: 'student-id' })
    listGroups.mockResolvedValue(groups)
    listStudentGroups.mockResolvedValue([])
    reconcileStudentGroups.mockResolvedValue()
    updateStudent.mockResolvedValue()
  })

  it('creates a student and reconciles multiple selected groups', async () => {
    listStudentsWithGroups.mockResolvedValue([])
    renderStudentsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add student' }))
    enterStudentDetails()
    fireEvent.click(screen.getByLabelText('Junior Crew'))
    fireEvent.click(screen.getByLabelText('Senior Crew'))
    fireEvent.click(screen.getByRole('button', { name: 'Save student' }))

    await waitFor(() => {
      expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({
        first_name: 'Maya',
        last_name: 'Dance',
      }))
      expect(reconcileStudentGroups).toHaveBeenCalledWith({
        groupIds: ['group-a', 'group-b'],
        studentId: 'new-student-id',
      })
    })
  })

  it('loads existing memberships and reconciles the exact set after a group is removed', async () => {
    listStudentsWithGroups.mockResolvedValue([{
      birth_date: null,
      email: '',
      first_name: 'Maya',
      id: 'student-id',
      last_name: 'Dance',
      notes: '',
      phone: '',
      status: 'active',
    }])
    listStudentGroups.mockResolvedValue([{ group_id: 'group-a' }, { group_id: 'group-b' }])
    renderStudentsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(await screen.findByLabelText('Junior Crew')).toBeChecked()
    expect(screen.getByLabelText('Senior Crew')).toBeChecked()

    fireEvent.click(screen.getByLabelText('Senior Crew'))
    fireEvent.click(screen.getByRole('button', { name: 'Save student' }))

    await waitFor(() => {
      expect(updateStudent).toHaveBeenCalledWith({
        id: 'student-id',
        values: expect.objectContaining({ first_name: 'Maya' }),
      })
      expect(reconcileStudentGroups).toHaveBeenCalledWith({
        groupIds: ['group-a'],
        studentId: 'student-id',
      })
    })
  })

  it('reconciles an empty membership set when no groups are selected', async () => {
    listStudentsWithGroups.mockResolvedValue([])
    renderStudentsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add student' }))
    enterStudentDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Save student' }))

    await waitFor(() => {
      expect(reconcileStudentGroups).toHaveBeenCalledWith({
        groupIds: [],
        studentId: 'new-student-id',
      })
    })
  })

  it('displays current groups and combines status and group filters', async () => {
    listStudentsWithGroups.mockResolvedValue([
      {
        first_name: 'Maya',
        id: 'student-a',
        last_name: 'Dance',
        status: 'active',
        student_groups: [{ group: groups[0] }],
      },
      {
        first_name: 'Alex',
        id: 'student-b',
        last_name: 'Rhythm',
        status: 'trial',
        student_groups: [{ group: groups[1] }],
      },
      {
        first_name: 'Taylor',
        id: 'student-c',
        last_name: 'Motion',
        status: 'inactive',
        student_groups: [{ group: groups[0] }, { group: groups[1] }],
      },
    ])
    renderStudentsPage()

    expect(await screen.findByText('Groups: Junior Crew')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'trial' } })
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'group-b' } })

    expect(screen.getByText('Alex Rhythm')).toBeInTheDocument()
    expect(screen.queryByText('Maya Dance')).not.toBeInTheDocument()
    expect(screen.queryByText('Taylor Motion')).not.toBeInTheDocument()
  })

  it('explains how to recover when memberships fail after saving student details', async () => {
    listStudentsWithGroups.mockResolvedValue([])
    reconcileStudentGroups.mockRejectedValueOnce(new Error('RPC failed'))
    renderStudentsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Add student' }))
    enterStudentDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Save student' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Student details were saved, but group memberships could not be saved',
    )
  })
})

describe('StudentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudent.mockResolvedValue({
      birth_date: null,
      email: '',
      first_name: 'Maya',
      id: 'student-id',
      last_name: 'Dance',
      notes: '',
      phone: '',
      status: 'active',
    })
    listGroups.mockResolvedValue(groups)
    listStudentGroups.mockResolvedValue([{ group_id: 'group-a' }, { group_id: 'group-b' }])
  })

  it('displays current group memberships', async () => {
    renderWithQueryClient(
      <Routes>
        <Route element={<StudentDetailPage />} path="/app/students/:studentId" />
      </Routes>,
      ['/app/students/student-id'],
    )

    expect(await screen.findByRole('heading', { name: 'Current groups' })).toBeInTheDocument()
    expect(screen.getByText('Junior Crew')).toBeInTheDocument()
    expect(screen.getByText('Senior Crew')).toBeInTheDocument()
  })

  it('requires typed confirmation before permanently deleting a student', async () => {
    listStudentsWithGroups.mockResolvedValue([])
    renderWithQueryClient(
      <Routes>
        <Route element={<StudentDetailPage />} path="/app/students/:studentId" />
        <Route element={<StudentsPage />} path="/app/students" />
      </Routes>,
      ['/app/students/student-id'],
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Permanently delete student' }))
    const confirmationButton = screen.getByRole('button', { name: 'Permanently delete' })
    expect(confirmationButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })
    fireEvent.click(confirmationButton)

    await waitFor(() => {
      expect(deleteStudent).toHaveBeenCalledWith('student-id')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Student permanently deleted.')
  })

  it('does not show permanent deletion controls to trainers', async () => {
    renderWithQueryClient(
      <Routes>
        <Route element={<StudentDetailPage />} path="/app/students/:studentId" />
      </Routes>,
      ['/app/students/student-id'],
      'trainer',
    )

    await screen.findByRole('heading', { name: 'Maya Dance' })
    expect(screen.queryByRole('button', { name: 'Permanently delete student' })).not.toBeInTheDocument()
  })
})
