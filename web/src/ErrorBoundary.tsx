import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('React Error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-critical/30 bg-critical-soft/40 p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-critical" />
              <h1 className="text-lg font-semibold text-critical">Erro na aplicação</h1>
            </div>
            <p className="text-sm text-critical/80 mb-4">
              {this.state.error?.message || 'Algo deu errado. Tente recarregar a página.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-critical text-white rounded hover:bg-critical/90 text-sm font-medium"
            >
              Recarregar Página
            </button>
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-mono hover:text-foreground">Stack trace</summary>
              <pre className="mt-2 overflow-auto bg-muted p-2 rounded text-xs">
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
