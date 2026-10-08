import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { App } from './App'
import { MorePage } from './MorePage'
import { AuthProvider } from '../features/auth/AuthContext'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '../features/auth/RouteGuards'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { UsersPage } from '../features/users/UsersPage'
import { TrainersPage } from '../features/trainers/TrainersPage'
import { TrainerDetailPage } from '../features/trainers/TrainerDetailPage'
import { RoomsPage } from '../features/rooms/RoomsPage'
import { GroupsPage } from '../features/groups/GroupsPage'
import { GroupDetailPage } from '../features/groups/GroupDetailPage'
import { StudentsPage } from '../features/students/StudentsPage'
import { StudentDetailPage } from '../features/students/StudentDetailPage'
import { CalendarPage } from '../features/calendar/CalendarPage'

export const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AdminRoute />,
            children: [
              { path: '/app/users', element: <UsersPage /> },
              { path: '/app/trainers', element: <TrainersPage /> },
              { path: '/app/trainers/:trainerId', element: <TrainerDetailPage /> },
              { path: '/app/rooms', element: <RoomsPage /> },
            ],
          },
          { path: '/app/groups', element: <GroupsPage /> },
          { path: '/app/groups/:groupId', element: <GroupDetailPage /> },
          { path: '/app/students', element: <StudentsPage /> },
          { path: '/app/students/:studentId', element: <StudentDetailPage /> },
          { path: '/app/calendar', element: <CalendarPage /> },
          { path: '/app/more', element: <MorePage /> },
          { path: '/app/*', element: <App /> },
        ],
      },
      { path: '*', element: <Navigate replace to="/app" /> },
    ],
  },
])
