import { CircleAlert } from 'lucide-react'

export function ErrorState({ action, description = 'Please try again.', title = 'Something went wrong' }) {
  return (
    <section className="feedback-state feedback-state--error" role="alert">
      <CircleAlert aria-hidden="true" size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  )
}
