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
        <div id="critical-error-overlay" style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-app)',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999,
          cursor: 'default' // Force system cursor
        }}>
          <div className="glass-panel" style={{
            padding: '2.5rem',
            maxWidth: '600px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            boxShadow: '0 0 50px rgba(255, 0, 0, 0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem',
                filter: 'drop-shadow(0 0 10px #ef4444)'
              }}>
                ⚠️
              </div>
              <h1 style={{
                color: '#ef4444',
                marginBottom: '0.5rem',
                fontSize: '2rem',
                textShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
              }}>
                Critical System Failure
              </h1>
              <p style={{ color: 'var(--color-text-dim)', lineHeight: '1.6' }}>
                Please <b>copy the error report</b> below and share it in our <b>Discord Support Server</b> so we can help you fix it.
              </p>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.5)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Error Details</span>
                <button
                  onClick={() => {
                    if (this.state.error) {
                      navigator.clipboard.writeText(this.state.error.toString() + '\n\n' + (this.state.error.stack || ''));
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textDecoration: 'underline'
                  }}
                >
                  Copy Error Report
                </button>
              </div>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: '#fca5a5',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0
              }}>
                {this.state.error?.toString()}
                {this.state.error?.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <button
                onClick={() => window.open('https://discord.gg/eDKC5yEQJN', '_blank')}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '1rem',
                  color: 'white',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                Join Support Server
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'var(--color-primary)',
                  border: 'none',
                  padding: '1rem',
                  color: 'black',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 0 20px var(--color-primary-glow)'
                }}
              >
                System Reboot
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
