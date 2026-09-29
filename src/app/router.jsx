import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { App } from './App'
import { AuthProvider } from '../features/auth/AuthContext'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute, PublicOnlyRoute } from '../features/auth/RouteGuards'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'

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
          { path: '/app/*', element: <App /> },
        ],
      },
      { path: '*', element: <Navigate replace to="/app" /> },
    ],
  },
])
