import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { queryClient } from './app/queryClient'
import { router } from './app/router'
import 'react-datepicker/dist/react-datepicker.css'
import './styles/globals.css'
import { QueryClientProvider } from '@tanstack/react-query'

import { AppErrorBoundary } from './components/feedback/AppErrorBoundary'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
