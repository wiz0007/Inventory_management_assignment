import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTab?: (tab: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.fallbackTab) {
      this.props.fallbackTab('items');
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 700, margin: '4rem auto', padding: '0 1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
              <AlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              An unexpected error occurred in this view
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: 480, margin: '0 auto 1.5rem auto' }}>
              {this.state.error?.message || 'Something went wrong while rendering this section.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })} 
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                <RefreshCw size={16} />
                <span>Retry View</span>
              </button>
              <button 
                onClick={this.handleReset} 
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                <Home size={16} />
                <span>Return to Inventory</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
