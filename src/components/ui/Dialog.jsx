import { X } from 'lucide-react'

import { Button } from './Button'

export function Dialog({ children, onClose, open, title }) {
  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="dialog"
        role="dialog"
      >
        <header className="dialog__header">
          <h2 id="dialog-title">{title}</h2>
          <Button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
            variant="tertiary"
          >
            <X aria-hidden="true" size={20} />
          </Button>
        </header>
        <div className="dialog__body">{children}</div>
      </section>
    </div>
  )
}
