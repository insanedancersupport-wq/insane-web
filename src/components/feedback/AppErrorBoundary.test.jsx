import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary } from './AppErrorBoundary'

function BrokenChild() {
  throw new Error('test-only render failure')
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows a safe recovery action when a child throws during render', () => {
    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'The application could not continue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeInTheDocument()
    expect(screen.queryByText('test-only render failure')).not.toBeInTheDocument()
  })

  it('reloads the page when recovery is requested', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    )

    screen.getByRole('button', { name: 'Reload application' }).click()

    expect(reload).toHaveBeenCalledOnce()
  })
})
