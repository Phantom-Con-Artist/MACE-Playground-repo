import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }
      return (
        <div
          role="alert"
          style={{
            padding: '1.5rem',
            margin: '1rem',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #f87171',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Rendering Error</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#991b1b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
