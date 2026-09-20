import { useId } from 'react'

export function Input({ label, id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="field" htmlFor={inputId}>
      {label && <span className="field__label">{label}</span>}
      <input className="field__input" id={inputId} {...props} />
    </label>
  )
}
