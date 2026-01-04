import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    if (window.electron) {
      window.electron.log('error', `Renderer Error: ${error.toString()}`);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-app)',
          color: 'var(--color-text-main)'
        }}>
          <div className="glass-panel" style={{ padding: '2rem', maxWidth: '500px' }}>
            <h1 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Critical System Failure</h1>
            <p style={{ marginBottom: '1rem' }}>The application has encountered an unrecoverable error.</p>
            <pre style={{ 
              background: 'rgba(0,0,0,0.5)', 
              padding: '1rem', 
              borderRadius: '8px', 
              overflow: 'auto',
              marginBottom: '1rem'
            }}>
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--color-primary)',
                border: 'none',
                padding: '0.8rem 1.5rem',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              System Reboot
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
