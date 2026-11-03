import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('provides an accessible close control and locks background scrolling while open', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <Dialog onClose={onClose} open title="Edit activity">
        <p>Dialog content</p>
      </Dialog>,
    )

    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveClass('dialog__close-button')
    expect(document.body).toHaveClass('dialog-open')
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(document.body).not.toHaveClass('dialog-open')
  })
})
