import { forwardRef, useId } from 'react'

import { TemporalPickerField } from './TemporalPickerField'

const temporalInputTypes = new Set(['date', 'time', 'month', 'datetime-local'])

export const Input = forwardRef(function Input({ label, id, type = 'text', ...props }, ref) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  if (temporalInputTypes.has(type)) {
    return <TemporalPickerField {...props} id={inputId} label={label} ref={ref} type={type} />
  }

  return (
    <label className="field" htmlFor={inputId}>
      {label && <span className="field__label">{label}</span>}
      <input className="field__input" id={inputId} ref={ref} type={type} {...props} />
    </label>
  )
})
