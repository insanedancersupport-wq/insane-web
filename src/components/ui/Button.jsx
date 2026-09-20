export function Button({
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
