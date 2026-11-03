import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CalendarTemporalPicker } from './CalendarTemporalPicker'

afterEach(cleanup)

describe('CalendarTemporalPicker', () => {
  it('opens, navigates, and selects a date intentionally', () => {
    const onChange = vi.fn()
    render(<CalendarTemporalPicker id="activity-date" label="Date" onChange={onChange} type="date" value="2026-11-03" />)

    fireEvent.click(screen.getByRole('button', { name: 'Date' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next Month'))
    expect(document.querySelector('.react-datepicker__current-month')).toHaveTextContent('December 2026')
    fireEvent.click(document.querySelector('.react-datepicker__day--005'))

    expect(onChange).toHaveBeenCalledWith('2026-12-05')
    expect(screen.queryByRole('dialog', { name: 'Choose Date' })).not.toBeInTheDocument()
  })

  it('opens and selects minute-precision times', () => {
    const onChange = vi.fn()
    render(<CalendarTemporalPicker id="activity-time" label="Start time" onChange={onChange} type="time" value="18:00" />)

    fireEvent.click(screen.getByRole('button', { name: 'Start time' }))
    fireEvent.click(screen.getByText('12:01 AM'))

    expect(onChange).toHaveBeenCalledWith('00:01')
    expect(screen.queryByRole('dialog', { name: 'Choose Time' })).not.toBeInTheDocument()
  })
})
