import { Inbox } from 'lucide-react'

export function EmptyState({
  action,
  description,
  icon: Icon = Inbox,
  title,
}) {
  return (
    <section className="feedback-state feedback-state--empty">
      <Icon aria-hidden="true" size={28} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  )
}
