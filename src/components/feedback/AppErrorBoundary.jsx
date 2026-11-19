import { Component } from 'react'

import { ErrorState } from './ErrorState'

export class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-page">
          <ErrorState
            action={<button type="button" onClick={this.handleReload}>Reload application</button>}
            description="The application encountered an unexpected error. Reload the page to try again."
            title="The application could not continue"
          />
        </main>
      )
    }

    return this.props.children
  }
}
