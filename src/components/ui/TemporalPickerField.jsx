import { CalendarDays, Clock3 } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'

function assignRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return ''

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatMonth(value) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return ''

  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

function displayValue(type, value) {
  if (!value) {
    return {
      date: 'Select date',
      time: 'Select time',
      month: 'Select month',
      'datetime-local': 'Select date and time',
    }[type]
  }

  if (type === 'date') return formatDate(value)
  if (type === 'month') return formatMonth(value)
  if (type === 'datetime-local') {
    const [date, time] = value.split('T')
    return `${formatDate(date)} ${time ?? ''}`.trim()
  }

  return value
}

function Icon({ type }) {
  return type === 'time' ? <Clock3 aria-hidden="true" size={20} /> : <CalendarDays aria-hidden="true" size={20} />
}

export const TemporalPickerField = forwardRef(function TemporalPickerField({
  className = '',
  defaultValue,
  disabled = false,
  id,
  label,
  onChange,
  type,
  value,
  ...inputProps
}, forwardedRef) {
  const inputRef = useRef(null)
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '')
  const currentValue = value ?? uncontrolledValue

  useEffect(() => {
    if (value === undefined && inputRef.current?.value !== uncontrolledValue) {
      setUncontrolledValue(inputRef.current.value)
    }
  }, [uncontrolledValue, value])

  const setInputRef = useCallback((node) => {
    inputRef.current = node
    assignRef(forwardedRef, node)
  }, [forwardedRef])

  function handleChange(event) {
    setUncontrolledValue(event.target.value)
    onChange?.(event)
  }

  function openNativePicker(event) {
    const input = inputRef.current
    if (!input || input.disabled) {
      return
    }

    input.focus({ preventScroll: true })
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        event.preventDefault()
        return
      } catch {
        // Some browsers reject showPicker() for transparent inputs; preserve the native click below.
      }
    }

    if (event.target !== input) {
      input.click()
    }
  }

  return (
    <label className={`field temporal-picker-field ${className}`.trim()} htmlFor={id}>
      {label && <span className="field__label">{label}</span>}
      <span className={`temporal-picker${disabled ? ' temporal-picker--disabled' : ''}${currentValue ? '' : ' temporal-picker--empty'}`} onPointerDown={openNativePicker}>
        <Icon type={type} />
        <span aria-hidden="true" className="temporal-picker__value">{displayValue(type, currentValue)}</span>
        <input
          {...inputProps}
          aria-label={label}
          className="temporal-picker__native"
          defaultValue={defaultValue}
          disabled={disabled}
          id={id}
          onChange={handleChange}
          ref={setInputRef}
          type={type}
          value={value}
        />
      </span>
    </label>
  )
})
