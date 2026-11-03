import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TemporalPickerField } from './TemporalPickerField'

afterEach(cleanup)

describe('TemporalPickerField', () => {
  it('renders a formatted date while retaining an accessible native input', () => {
    render(<TemporalPickerField id="activity-date" label="Activity date" type="date" value="2026-11-03" />)

    expect(screen.getByLabelText('Activity date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Activity date')).toHaveValue('2026-11-03')
    expect(screen.getByText('3 Nov 2026')).toBeInTheDocument()
  })

  it('uses the native input change event to update form state', () => {
    const onChange = vi.fn()
    render(<TemporalPickerField id="activity-time" label="Start time" onChange={onChange} type="time" />)

    const input = screen.getByLabelText('Start time')
    expect(screen.getByText('Select time')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '18:00' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByText('18:00')).toBeInTheDocument()
  })

  it('opens the native picker from the pointer-down user gesture', () => {
    render(<TemporalPickerField id="activity-date" label="Activity date" type="date" />)

    const input = screen.getByLabelText('Activity date')
    const showPicker = vi.fn()
    Object.defineProperty(input, 'showPicker', { configurable: true, value: showPicker })
    fireEvent.pointerDown(screen.getByText('Select date'))

    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  it('formats month values without timezone conversion', () => {
    render(<TemporalPickerField id="attendance-month" label="Month" type="month" value="2026-11" />)

    expect(screen.getByText('November 2026')).toBeInTheDocument()
  })
})
