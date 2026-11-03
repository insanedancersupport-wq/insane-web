import { CalendarDays, Clock3 } from 'lucide-react'
import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'

function parseDate(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

function parseTime(value) {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isInteger(hours) && Number.isInteger(minutes) ? new Date(2000, 0, 1, hours, minutes) : null
}

function formatDateValue(date) {
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatTimeValue(date) {
  if (!date) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const PickerButton = forwardRef(function PickerButton({ disabled, onClick, pickerType, placeholder, value, ...props }, ref) {
  return (
    <button {...props} className="calendar-temporal-picker__trigger" disabled={disabled} onClick={onClick} ref={ref} type="button">
      {pickerType === 'time' ? <Clock3 aria-hidden="true" size={20} /> : <CalendarDays aria-hidden="true" size={20} />}
      <span>{value || placeholder}</span>
    </button>
  )
})

export function CalendarTemporalPicker({ disabled = false, id, label, onChange, type, value }) {
  const isTime = type === 'time'
  const selected = isTime ? parseTime(value) : parseDate(value)
  const placeholder = isTime ? 'Select time' : 'Select date'

  function handleChange(nextValue) {
    onChange(isTime ? formatTimeValue(nextValue) : formatDateValue(nextValue))
  }

  return (
    <label className="field calendar-temporal-picker" htmlFor={id}>
      <span className="field__label">{label}</span>
      <DatePicker
        calendarStartDay={1}
        customInput={<PickerButton pickerType={type} placeholder={placeholder} />}
        dateFormat={isTime ? 'HH:mm' : 'd MMM yyyy'}
        disabled={disabled}
        id={id}
        onChange={handleChange}
        portalId="calendar-temporal-picker-portal"
        selected={selected}
        showTimeSelect={isTime}
        showTimeSelectOnly={isTime}
        showYearDropdown={!isTime}
        timeCaption="Time"
        timeIntervals={1}
        withPortal
      />
    </label>
  )
}
