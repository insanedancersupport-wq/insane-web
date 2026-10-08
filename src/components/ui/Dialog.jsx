import { X } from 'lucide-react'

import { Button } from './Button'

export function Dialog({ children, footer, onClose, open, scrollable = false, title }) {
  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="dialog-title"
        aria-modal="true"
        className={`dialog${scrollable ? ' dialog--scrollable' : ''}`}
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
        <div className={`dialog__body${scrollable ? ' dialog__body--scrollable' : ''}`}>{children}</div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </section>
    </div>
  )
}
