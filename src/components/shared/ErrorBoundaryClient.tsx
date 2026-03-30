'use client'

import { Component, type ReactNode } from 'react'
import { ErrorAlert } from './ErrorAlert'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundaryClient extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4">
          <ErrorAlert
            message={this.state.message || 'Er is een onverwachte fout opgetreden.'}
            onRetry={this.reset}
          />
        </div>
      )
    }
    return this.props.children
  }
}
