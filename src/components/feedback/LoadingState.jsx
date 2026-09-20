export function LoadingState({ label = 'Loading' }) {
  return (
    <div aria-label={label} className="loading-state" role="status">
      <span aria-hidden="true" className="loading-state__spinner" />
      <span>{label}</span>
    </div>
  )
}
